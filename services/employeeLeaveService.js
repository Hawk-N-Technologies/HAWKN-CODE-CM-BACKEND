const Employee = require("../models/Employee");
const EmployeeLeave = require("../models/EmployeeLeave");
const { Op } = require("@sequelize/core");
const User = require("../models/User");
async function getLeaveRequests(companyId, status) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const where = {
      companyId,
    };

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

    const leaves = await EmployeeLeave.findAll({
      where,
      include: [
        {
          model: Employee,
          as: "employee",
          attributes: ["id", "userId"],
          include: [
            {
              model: User,
              as: "user",
              attributes: ["id", "first_name", "last_name"],
            },
          ],
        },
      ],
      order: [["leaveDate", "DESC"]],
    });

    return leaves;
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

    // Validate status
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

    // Only pending requests can be edited
    if (leave.leaveStatus !== "PENDING") {
      const error = new Error("Only pending leave requests can be edited.");
      error.statusCode = 400;
      throw error;
    }

    // Validate leave type
    const validLeaveTypes = ["CASUAL", "SICK", "ANNUAL", "UNPAID", "OTHER"];

    if (leaveType !== undefined && !validLeaveTypes.includes(leaveType)) {
      const error = new Error("Invalid leave type");
      error.statusCode = 400;
      throw error;
    }

    // Validate session
    const validSessions = ["FULL_DAY", "FIRST_HALF", "SECOND_HALF"];

    if (leaveSession !== undefined && !validSessions.includes(leaveSession)) {
      const error = new Error("Invalid leave session");
      error.statusCode = 400;
      throw error;
    }

    // Validate date
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

    await leave.update({
      ...(leaveType !== undefined && {
        leaveType,
      }),

      ...(leaveDate !== undefined && {
        leaveDate,
      }),

      ...(leaveSession !== undefined && {
        leaveSession,
      }),

      ...(isPaid !== undefined && {
        isPaid,
      }),

      ...(status !== undefined && {
        leaveStatus: status,
      }),
    });

    return leave;
  } catch (error) {
    console.error("Failed to update leave request:", error);
    throw error;
  }
}

module.exports = { getLeaveRequests, updateLeaveRequest };
