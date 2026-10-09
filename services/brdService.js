const BRD = require("../models/BRD");
const BRDVersion = require("../models/BRDVersion");
const BRDReview = require("../models/BRDReview");
const Project = require("../models/Project");
const Client = require("../models/Client");
const User = require("../models/User");
const Company = require("../models/Company");
const sequelize = require("../config/db");
const logger = require("../utils/logger");
const { Op, Transaction } = require("@sequelize/core");

const ADMIN_ROLE = "admin";
async function uploadBRD({ projectUuid, companyId, userId, file }) {
  const transaction = await sequelize.startUnmanagedTransaction();

  try {
    if (!projectUuid) {
      const error = new Error("Project UUID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!userId) {
      const error = new Error("User ID is required");
      error.statusCode = 400;
      throw error;
    }

    if (!file) {
      const error = new Error("BRD file is required");
      error.statusCode = 400;
      throw error;
    }

    const project = await Project.findOne({
      where: {
        uuid: projectUuid,
        companyId,
      },
      attributes: ["id", "uuid", "name", "clientId", "companyId"],
      transaction,
      lock: "UPDATE",
    });

    if (!project) {
      const error = new Error("Project not found");
      error.statusCode = 404;
      throw error;
    }

    let brd = await BRD.findOne({
      where: {
        projectId: project.id,
        companyId,
      },
      transaction,
      lock: "UPDATE",
    });

    let versionNumber = 1;

    if (!brd) {
      brd = await BRD.create(
        {
          projectId: project.id,
          clientId: project.clientId,
          companyId,
          title: `${project.name} BRD`,
          description: null,
          status: "PENDING_ADMIN_APPROVAL",
          createdBy: userId,
        },
        {
          transaction,
        },
      );
    } else {
      const latestVersion = await BRDVersion.findOne({
        where: {
          brdId: brd.id,
        },
        attributes: ["id", "version"],
        order: [["version", "DESC"]],
        transaction,
        lock: "UPDATE",
      });

      versionNumber = latestVersion ? latestVersion.version + 1 : 1;

      const allowedStatuses = ["CLIENT_REJECTED", "ADMIN_REJECTED", "DRAFT"];

      if (!allowedStatuses.includes(brd.status)) {
        const error = new Error("BRD cannot be uploaded in its current status");

        error.statusCode = 400;
        throw error;
      }

      brd.status = "PENDING_ADMIN_APPROVAL";

      await brd.save({
        transaction,
      });
    }

    const brdVersion = await BRDVersion.create(
      {
        brdId: brd.id,
        version: versionNumber,
        fileName: file.originalname,
        fileUrl: `/uploads/brds/${file.filename}`,
        storageKey: file.filename,
        mimeType: file.mimetype,
        fileSize: file.size,
        uploadedBy: userId,
      },
      {
        transaction,
      },
    );

    await transaction.commit();

    logger.info("BRD uploaded successfully", {
      brdUuid: brd.uuid,
      projectUuid,
      version: versionNumber,
      uploadedBy: userId,
    });

    return {
      brd,
      version: brdVersion,
    };
  } catch (error) {
    await transaction.rollback();

    logger.error("Failed to upload BRD", {
      projectUuid,
      companyId,
      userId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getAllProjects({ companyId }) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const projects = await Project.findAll({
      where: {
        companyId,
      },
      attributes: ["id", "uuid", "name"],
      order: [["createdAt", "DESC"]],
    });

    logger.info("BRD projects fetched successfully", {
      companyId,
      count: projects.length,
    });

    return projects;
  } catch (error) {
    logger.error("Failed to fetch projects", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getBRDSummary(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const brds = await BRD.findAll({
      where: {
        companyId,
      },
      attributes: ["id", "status"],
    });

    const total = brds.length;

    const pending = brds.filter((brd) =>
      ["PENDING_ADMIN_APPROVAL", "PENDING_CLIENT_APPROVAL"].includes(
        brd.status,
      ),
    ).length;

    const approved = brds.filter((brd) => brd.status === "APPROVED").length;

    const rejected = brds.filter((brd) =>
      ["ADMIN_REJECTED", "CLIENT_REJECTED"].includes(brd.status),
    ).length;

    const currentStatus =
      pending > 0 ? `${pending} Pending Review` : "All BRDs Reviewed";

    logger.info("BRD summary fetched successfully", {
      companyId,
      total,
      pending,
      approved,
      rejected,
    });

    return {
      total,
      pending,
      approved,
      rejected,
      currentStatus,
    };
  } catch (error) {
    logger.error("Failed to fetch BRD summary", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

async function getBRDHistory(companyId) {
  try {
    if (!companyId) {
      const error = new Error("Company ID is required");
      error.statusCode = 400;
      throw error;
    }

    const brds = await BRD.findAll({
      where: {
        companyId,
      },

      attributes: ["id", "uuid", "title", "status", "createdBy", "createdAt"],

      include: [
        {
          model: Project,
          as: "project",
          attributes: ["id", "uuid", "name"],

          include: [
            {
              model: Client,
              as: "client",
              attributes: ["id", "uuid", "phone"],

              include: [
                {
                  model: User,
                  as: "user",
                  attributes: ["uuid", "firstName", "lastName"],
                },
              ],
            },
          ],
        },

        {
          model: User,
          as: "creator",
          attributes: ["uuid", "firstName", "lastName"],
        },

        {
          model: BRDVersion,
          as: "versions",

          attributes: [
            "id",
            "uuid",
            "version",
            "fileName",
            "fileUrl",
            "mimeType",
            "fileSize",
            "uploadedBy",
            "createdAt",
          ],

          include: [
            {
              model: User,
              as: "uploader",
              attributes: ["uuid", "firstName", "lastName"],
            },

            {
              model: BRDReview,
              as: "reviews",

              attributes: [
                "id",
                "uuid",
                "reviewerId",
                "reviewerRole",
                "action",
                "message",
                "reviewedAt",
              ],

              include: [
                {
                  model: User,
                  as: "reviewer",
                  attributes: ["uuid", "firstName", "lastName"],
                },
              ],

              separate: true,

              order: [["reviewedAt", "DESC"]],
            },
          ],

          order: [["version", "DESC"]],
        },
      ],

      order: [["createdAt", "DESC"]],
    });

    const history = [];

    for (const brd of brds) {
      for (const version of brd.versions || []) {
        const latestReview = version.reviews?.[0] || null;

        const clientUser = brd.project?.client?.user || null;

        const uploader = version.uploader || null;

        const reviewer = latestReview?.reviewer || null;

        history.push({
          id: version.uuid,

          brdUuid: brd.uuid,

          project: brd.project?.name || "—",

          client: clientUser
            ? `${clientUser.firstName || ""} ${
                clientUser.lastName || ""
              }`.trim()
            : "—",

          fileName: version.fileName,

          fileUrl: version.fileUrl,

          version: `v${version.version}`,

          uploadedBy: uploader
            ? `${uploader.firstName || ""} ${uploader.lastName || ""}`.trim()
            : "—",

          uploadedAt: version.createdAt,

          status: getHistoryStatus(brd.status, latestReview),

          reviewedBy: reviewer
            ? `${reviewer.firstName || ""} ${reviewer.lastName || ""}`.trim()
            : null,

          reviewedAt: latestReview?.reviewedAt || null,

          remarks: latestReview?.message || null,
        });
      }
    }

    logger.info("BRD history fetched successfully", {
      companyId,
      count: history.length,
    });

    return history;
  } catch (error) {
    logger.error("Failed to fetch BRD history", {
      companyId,
      error: error.message,
      stack: error.stack,
    });

    throw error;
  }
}

function getHistoryStatus(brdStatus, review) {
  if (review?.action === "APPROVED") {
    return "Approved";
  }

  if (review?.action === "REJECTED") {
    return "Rejected";
  }

  if (
    ["PENDING_ADMIN_APPROVAL", "PENDING_CLIENT_APPROVAL"].includes(brdStatus)
  ) {
    return "Pending";
  }

  if (["ADMIN_REJECTED", "CLIENT_REJECTED"].includes(brdStatus)) {
    return "Rejected";
  }

  if (brdStatus === "APPROVED") {
    return "Approved";
  }

  return "Pending";
}

const getLatestVersion = async (brdId, transaction) => {
  return BRDVersion.findOne({
    where: { brdId },
    order: [["version", "DESC"]],
    transaction,
  });
};

const getBRDIncludes = () => [
  {
    model: Project,
    as: "project",
    attributes: ["id", "uuid", "name"],
    required: false,
  },
  {
    model: Client,
    as: "client",
    attributes: ["id", "uuid", "userId"],
    required: false,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "uuid", "firstName", "email"],
        required: false,
      },
    ],
  },
  {
    model: Company,
    as: "company",
    attributes: ["id", "name"],
    required: false,
  },
  {
    model: User,
    as: "creator",
    attributes: ["id", "firstName", "lastName", "email"],
    required: false,
  },
  {
    model: BRDVersion,
    as: "versions",
    separate: true,
    order: [["version", "DESC"]],
    include: [
      {
        model: User,
        as: "uploader",
        attributes: ["id", "firstName", "lastName", "email"],
        required: false,
      },
      {
        model: BRDReview,
        as: "reviews",
        separate: true,
        order: [["reviewedAt", "DESC"]],
        include: [
          {
            model: User,
            as: "reviewer",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
        ],
      },
    ],
  },
];

// List BRDs for the admin approval UI.
const getAdminBRDs = async ({ status, search }) => {
  const where = {};

  if (status && status !== "ALL") {
    where.status = status;
  }

  if (search?.trim()) {
    const term = `%${search.trim()}%`;

    where[Op.or] = [
      { title: { [Op.iLike]: term } },
      { description: { [Op.iLike]: term } },
      { uuid: { [Op.iLike]: term } },
    ];
  }

  const brds = await BRD.findAll({
    where,
    include: getBRDIncludes(),
    order: [["updatedAt", "DESC"]],
  });

  return brds;
};

// Fetch one BRD with versions and review history.
const getAdminBRDById = async (brdId) => {
  const brd = await BRD.findByPk(brdId, {
    include: getBRDIncludes(),
  });

  if (!brd) {
    const error = new Error("BRD not found.");
    error.statusCode = 404;
    throw error;
  }

  return brd;
};

// Approve or reject a BRD atomically.
const decideBRD = async ({ brdId, reviewerId, action, message }) => {
  if (!["APPROVED", "REJECTED"].includes(action)) {
    const error = new Error("Action must be APPROVED or REJECTED.");
    error.statusCode = 400;
    throw error;
  }

  if (!reviewerId) {
    const error = new Error("Authenticated reviewer was not found.");
    error.statusCode = 401;
    throw error;
  }

  if (action === "REJECTED" && !message?.trim()) {
    const error = new Error("A rejection reason is required.");
    error.statusCode = 400;
    throw error;
  }

  return sequelize.transaction(
    {
      isolationLevel: Transaction.ISOLATION_LEVELS.READ_COMMITTED,
    },
    async (transaction) => {
      // Lock the BRD row so two admins cannot decide simultaneously.
      const brd = await BRD.findByPk(brdId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!brd) {
        const error = new Error("BRD not found.");
        error.statusCode = 404;
        throw error;
      }

      if (brd.status !== "PENDING_ADMIN_APPROVAL") {
        const error = new Error(
          `Cannot review a BRD with status ${brd.status}.`,
        );
        error.statusCode = 409;
        throw error;
      }

      const latestVersion = await getLatestVersion(brd.id, transaction);

      if (!latestVersion) {
        const error = new Error(
          "Cannot review a BRD without an uploaded version.",
        );
        error.statusCode = 409;
        throw error;
      }

      const review = await BRDReview.create(
        {
          brdId: brd.id,
          brdVersionId: latestVersion.id,
          reviewerId,
          reviewerRole: ADMIN_ROLE,
          action,
          message: message?.trim() || null,
        },
        { transaction },
      );

      // Admin approval sends the BRD to client approval.
      // Rejection returns it to the uploader for revision.
      const nextStatus =
        action === "APPROVED" ? "PENDING_CLIENT_APPROVAL" : "ADMIN_REJECTED";

      await brd.update({ status: nextStatus }, { transaction });

      return {
        brdId: brd.id,
        brdUuid: brd.uuid,
        status: nextStatus,
        action,
        version: latestVersion.version,
        review,
      };
    },
  );
};

const getClientBRDIncludes = () => [
  {
    model: Project,
    as: "project",
    attributes: ["id", "uuid", "name"],
    required: false,
  },
  {
    model: Client,
    as: "client",
    attributes: ["id", "uuid", "userId"],
    required: true,
    include: [
      {
        model: User,
        as: "user",
        attributes: ["id", "uuid", "firstName", "email"],
        required: false,
      },
    ],
  },
  {
    model: User,
    as: "creator",
    attributes: ["id", "firstName", "lastName", "email"],
    required: false,
  },
  {
    model: BRDVersion,
    as: "versions",
    separate: true,
    order: [["version", "DESC"]],
    include: [
      {
        model: User,
        as: "uploader",
        attributes: ["id", "firstName", "lastName", "email"],
        required: false,
      },
      {
        model: BRDReview,
        as: "reviews",
        separate: true,
        order: [["reviewedAt", "DESC"]],
        include: [
          {
            model: User,
            as: "reviewer",
            attributes: ["id", "firstName", "lastName", "email"],
            required: false,
          },
        ],
      },
    ],
  },
];

function createServiceError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

async function getClientForUser(userId, transaction) {
  if (!userId) {
    throw createServiceError("Authenticated user not found.", 401);
  }

  const client = await Client.findOne({
    where: { userId },
    transaction,
  });

  if (!client) {
    throw createServiceError(
      "No client account is associated with this user.",
      403,
    );
  }

  return client;
}

/**
 * CLIENT: List only this client's BRDs.
 */
async function getClientBRDs(userId) {
  const client = await getClientForUser(userId);

  return BRD.findAll({
    where: { clientId: client.id },
    include: getClientBRDIncludes(),
    order: [["updatedAt", "DESC"]],
  });
}

/**
 * CLIENT: Get one BRD, only if it belongs to this client.
 */
async function getClientBRDById({ brdId, userId }) {
  const client = await getClientForUser(userId);

  const brd = await BRD.findOne({
    where: {
      id: brdId,
      clientId: client.id,
    },
    include: getClientBRDIncludes(),
  });

  if (!brd) {
    throw createServiceError(
      "BRD not found or you do not have access to it.",
      404,
    );
  }

  return brd;
}

/**
 * CLIENT: Approve or reject the latest BRD version.
 *
 * Approval:
 *   status -> APPROVED
 *
 * Rejection:
 *   status -> CLIENT_REJECTED
 *
 * A review record and status update are committed atomically.
 */
async function decideClientBRD({ brdId, userId, action, message }) {
  if (!["APPROVED", "REJECTED"].includes(action)) {
    throw createServiceError("Action must be APPROVED or REJECTED.", 400);
  }

  if (
    action === "REJECTED" &&
    (typeof message !== "string" || !message.trim())
  ) {
    throw createServiceError("A rejection reason is required.", 400);
  }

  return sequelize.transaction(async (transaction) => {
    const client = await getClientForUser(userId, transaction);

    const brd = await BRD.findOne({
      where: {
        id: brdId,
        clientId: client.id,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!brd) {
      throw createServiceError(
        "BRD not found or you do not have access to it.",
        404,
      );
    }

    if (brd.status !== "PENDING_CLIENT_APPROVAL") {
      throw createServiceError(
        `This BRD cannot be reviewed while its status is ${brd.status}.`,
        409,
      );
    }

    const latestVersion = await BRDVersion.findOne({
      where: { brdId: brd.id },
      order: [["version", "DESC"]],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!latestVersion) {
      throw createServiceError(
        "This BRD has no uploaded version to review.",
        409,
      );
    }

    const review = await BRDReview.create(
      {
        brdId: brd.id,
        brdVersionId: latestVersion.id,
        reviewerId: userId,
        reviewerRole: "client",
        action,
        message: message?.trim() || null,
      },
      { transaction },
    );

    const nextStatus = action === "APPROVED" ? "APPROVED" : "CLIENT_REJECTED";

    await brd.update({ status: nextStatus }, { transaction });

    return {
      brdId: brd.id,
      brdUuid: brd.uuid,
      version: latestVersion.version,
      action,
      status: nextStatus,
      review,
    };
  });
}

module.exports = {
  uploadBRD,
  getAllProjects,
  getBRDSummary,
  getBRDHistory,
  getAdminBRDs,
  getAdminBRDById,
  decideBRD,
  getClientBRDs,
  getClientBRDById,
  decideClientBRD,
};
