const Employee = require("../models/Employee");
const EmployeeLeave = require("../models/EmployeeLeave");
const { Op } = require("@sequelize/core");
const User = require("../models/User");
const notificationService = require("./notificationService");
const Sequelize = require("../config/db");
async function getLeaveRequests(
  companyId,
  {
    status = "PENDING",
    search = "",
    page = 1,
    limit = 10,
    sortBy = "leaveDate",
    sortOrder = "DESC",
  } = {},
) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    // Pagination
    const currentPage = Math.max(1, Number(page) || 1);
    const pageSize = Math.max(1, Math.min(100, Number(limit) || 10));
    const offset = (currentPage - 1) * pageSize;

    // Status filter
    const where = { companyId };

    if (status === "PENDING") {
      where.leaveStatus = "PENDING";
    } else if (status === "HISTORY") {
      where.leaveStatus = {
        [Op.in]: ["APPROVED", "REJECTED"],
      };
    } else {
      const error = new Error("Invalid leave status");
      error.statusCode = 400;
      throw error;
    }

    // Search employee
    const searchTerm = search.trim();
    const hasSearch = Boolean(searchTerm);

    const userWhere = {};

    if (hasSearch) {
      const searchPattern = `%${searchTerm}%`;

      userWhere[Op.or] = [
        {
          firstName: {
            [Op.iLike]: searchPattern,
          },
        },
        {
          lastName: {
            [Op.iLike]: searchPattern,
          },
        },
        {
          email: {
            [Op.iLike]: searchPattern,
          },
        },
        // Full name search (e.g. "Talha Malek")
        Sequelize.where(
          Sequelize.fn(
            "CONCAT",
            Sequelize.col("employee.user.first_name"),
            " ",
            Sequelize.col("employee.user.last_name"),
          ),
          {
            [Op.iLike]: searchPattern,
          },
        ),
      ];
    }

    // Sorting whitelist
    const allowedSortFields = ["leaveDate", "createdAt", "updatedAt"];

    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "leaveDate";

    const sortDirection =
      String(sortOrder).toUpperCase() === "ASC" ? "ASC" : "DESC";

    // Fetch leave requests
    const { count, rows } = await EmployeeLeave.findAndCountAll({
      where,

      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "userId"],
          required: hasSearch,

          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "firstName", "lastName", "email"],
              required: hasSearch,
              where: hasSearch ? userWhere : undefined,
            },
          ],
        },
      ],

      limit: pageSize,
      offset,

      order: [[sortField, sortDirection]],

      distinct: true,
    });

    return {
      rows,
      pagination: {
        total: count,
        page: currentPage,
        limit: pageSize,
        totalPages: Math.ceil(count / pageSize),
      },
    };
  } catch (error) {
    console.error("Failed to fetch leave requests:", error);
    throw error;
  }
}

async function updateLeaveRequest(companyId, uuid, data) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!uuid) {
      const error = new Error("Leave UUID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!data || typeof data !== "object") {
      const error = new Error("Leave data is required");
      error.statusCode = 400;
      throw error;
    }

    const { leaveType, leaveDate, leaveSession, isPaid, status } = data;

    const validStatuses = ["PENDING", "APPROVED", "REJECTED"];

    if (status !== undefined && !validStatuses.includes(status)) {
      const error = new Error("Invalid leave status");
      error.statusCode = 400;
      throw error;
    }

    const leave = await EmployeeLeave.findOne({
      where: {
        companyId,
        uuid,
      },
    });

    if (!leave) {
      const error = new Error("Leave request not found");
      error.statusCode = 404;
      throw error;
    }

    // Only pending requests can be edited.
    if (leave.leaveStatus !== "PENDING") {
      const error = new Error("Only pending leave requests can be edited.");
      error.statusCode = 400;
      throw error;
    }

    const validLeaveTypes = ["CASUAL", "SICK", "ANNUAL", "UNPAID", "OTHER"];

    if (leaveType !== undefined && !validLeaveTypes.includes(leaveType)) {
      const error = new Error("Invalid leave type");
      error.statusCode = 400;
      throw error;
    }

    const validSessions = ["FULL_DAY", "FIRST_HALF", "SECOND_HALF"];

    if (leaveSession !== undefined && !validSessions.includes(leaveSession)) {
      const error = new Error("Invalid leave session");
      error.statusCode = 400;
      throw error;
    }

    if (leaveDate !== undefined) {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

      if (!dateRegex.test(leaveDate)) {
        const error = new Error("Invalid leave date format");
        error.statusCode = 400;
        throw error;
      }

      const today = new Date().toISOString().split("T")[0];

      if (leaveDate < today) {
        const error = new Error("Leave date cannot be in the past");
        error.statusCode = 400;
        throw error;
      }
    }

    const previousStatus = leave.leaveStatus;

    await leave.update({
      ...(leaveType !== undefined && { leaveType }),
      ...(leaveDate !== undefined && { leaveDate }),
      ...(leaveSession !== undefined && { leaveSession }),
      ...(isPaid !== undefined && { isPaid }),
      ...(status !== undefined && { leaveStatus: status }),
      ...(status !== undefined &&
        status !== "PENDING" && {
          reviewedAt: new Date(),
        }),
    });

    // Notify the employee when HR makes a final decision.
    if (
      status !== undefined &&
      status !== previousStatus &&
      ["APPROVED", "REJECTED"].includes(status)
    ) {
      try {
        const employee = await Employee.findOne({
          where: { id: leave.employeeId, companyId },
          attributes: ["userId"],
        });

        if (employee?.userId) {
          await notificationService.notifyUser({
            companyId,
            userId: employee.userId,
            type: `LEAVE_${status}`,
            title:
              status === "APPROVED"
                ? "Leave request approved"
                : "Leave request rejected",
            message: `Your ${leave.leaveType.toLowerCase()} leave request for ${leave.leaveDate} was ${status.toLowerCase()}.`,
            link: null,
            eventKey: `leave-${leave.uuid}-${status.toLowerCase()}`,
            metadata: {
              leaveUuid: leave.uuid,
              leaveDate: leave.leaveDate,
              status,
            },
          });
        }
      } catch (notificationError) {
        // Do not roll back a valid HR decision because a notification failed.
        console.error(
          "Failed to notify employee about leave decision:",
          notificationError,
        );
      }
    }

    return leave;
  } catch (error) {
    console.error("Failed to update leave request:", error);
    throw error;
  }
}

const createLeaveRequest = async ({
  userId,
  companyId,
  leaveDate,
  leaveType,
  leaveSession = "FULL_DAY",
  reason,
}) => {
  console.log(leaveDate);

  // Check employee.
  const employee = await Employee.findOne({
    where: {
      userId,
      companyId,
    },
  });

  if (!employee) {
    throw new Error("Employee not found");
  }

  // Check existing leave.
  const existingLeaves = await EmployeeLeave.findAll({
    where: {
      employee_id: employee.id,
      company_id: companyId,
      leave_date: leaveDate,
      leave_status: ["PENDING", "APPROVED"],
    },
  });

  for (const leave of existingLeaves) {
    // Full day conflicts with everything.
    if (leave.leave_session === "FULL_DAY" || leaveSession === "FULL_DAY") {
      throw new Error("Leave already exists for this date");
    }

    // Same half-day conflicts.
    if (leave.leave_session === leaveSession) {
      throw new Error(`Leave already exists for ${leaveSession}`);
    }

    // FIRST_HALF + SECOND_HALF is allowed.
  }

  console.log(employee, companyId);

  const leave = await EmployeeLeave.create({
    employeeId: employee.id,
    companyId,
    leaveDate,
    leaveType,
    leaveSession,
    leaveStatus: "PENDING",
    isPaid: null,
    reason: reason || null,
  });

  // Notify HR after the leave request is successfully saved.
  try {
    const applicant = await User.findOne({
      where: { id: userId, companyId },
      attributes: ["firstName", "lastName"],
    });

    const applicantName =
      [applicant?.firstName, applicant?.lastName].filter(Boolean).join(" ") ||
      "An employee";

    await notificationService.notifyHR({
      companyId,
      type: "LEAVE_REQUEST_SUBMITTED",
      title: "New leave request",
      message: `${applicantName} submitted a ${String(leaveType).toLowerCase()} leave request for ${leaveDate}.`,
      link: "/hr/leave",
      eventKey: `leave-${leave.uuid}-submitted`,
      metadata: {
        leaveUuid: leave.uuid,
        employeeUserId: userId,
        leaveDate,
        leaveType,
        leaveSession,
      },
    });
  } catch (notificationError) {
    // A notification outage must not make a successfully created leave appear to fail.
    console.error(
      "Failed to notify HR about leave request:",
      notificationError,
    );
  }

  return leave;
};

const getMyLeaves = async ({ userId, companyId, tab }) => {
  const employee = await Employee.findOne({
    where: {
      userId,
      companyId,
    },
    attributes: ["id"],
  });

  if (!employee) {
    throw new Error("Employee not found.");
  }

  // YYYY-MM-DD.
  const today = new Date();

  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");

  const todayDate = `${year}-${month}-${day}`;

  let where = {
    employeeId: employee.id,
    companyId,
  };

  if (tab === "PENDING") {
    where = {
      ...where,
      leaveStatus: "PENDING",
      leaveDate: {
        [Op.gte]: todayDate,
      },
    };
  } else if (tab === "HISTORY") {
    where = {
      ...where,
      [Op.or]: [
        {
          leaveStatus: "APPROVED",
        },
        {
          leaveStatus: "REJECTED",
        },
        {
          leaveStatus: "PENDING",
          leaveDate: {
            [Op.lt]: todayDate,
          },
        },
      ],
    };
  } else {
    throw new Error("Invalid tab. Use PENDING or HISTORY.");
  }

  const leaves = await EmployeeLeave.findAll({
    where,

    attributes: [
      "id",
      "uuid",
      "employeeId",
      "companyId",
      "leaveDate",
      "leaveType",
      "leaveSession",
      "leaveStatus",
      "isPaid",
      "reason",
      "reviewedBy",
      "reviewedAt",
      "createdAt",
      "updatedAt",
    ],

    order: [
      ["leaveDate", "DESC"],
      ["createdAt", "DESC"],
    ],
  });

  return leaves;
};

module.exports = {
  getLeaveRequests,
  updateLeaveRequest,
  createLeaveRequest,
  getMyLeaves,
};
