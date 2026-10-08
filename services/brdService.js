const BRD = require("../models/BRD");
const BRDVersion = require("../models/BRDVersion");
const BRDReview = require("../models/BRDReview");
const Project = require("../models/Project");
const Client = require("../models/Client");
const User = require("../models/User");
const sequelize = require("../config/db");
const logger = require("../utils/logger");

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

module.exports = {
  uploadBRD,
  getAllProjects,
  getBRDSummary,
  getBRDHistory,
};
