"use strict";

const bugsService = require("../services/bugsService");
const logger = require("../utils/logger");

const SEVERITIES = ["Low", "Medium", "High", "Critical"];

const STATUSES = [
  "Open",
  "Assigned",
  "In Progress",
  "Fixed",
  "Ready for Retest",
  "Reopened",
  "Closed",
  "Rejected",
];

const DISCOVERY_SOURCES = [
  "Client",
  "Testing",
  "Development",
  "Code Review",
  "Production",
  "Retesting",
];

async function reportBug(req, res) {
  try {
    const {
      projectId,
      moduleId,
      title,
      severity,
      discoverySource,
      assignedTo,
    } = req.body;

    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (typeof title !== "string" || !title.trim()) {
      return res.status(400).json({
        success: false,
        message: "Bug title is required.",
      });
    }

    if (severity && !SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid severity.",
      });
    }

    if (discoverySource && !DISCOVERY_SOURCES.includes(discoverySource)) {
      return res.status(400).json({
        success: false,
        message: "Invalid discovery source.",
      });
    }

    if (
      assignedTo !== undefined &&
      assignedTo !== null &&
      assignedTo !== "" &&
      (!Number.isSafeInteger(Number(assignedTo)) || Number(assignedTo) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid developer ID.",
      });
    }

    if (
      moduleId !== undefined &&
      moduleId !== null &&
      moduleId !== "" &&
      (!Number.isSafeInteger(Number(moduleId)) || Number(moduleId) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID.",
      });
    }

    const bug = await bugsService.createBug(req.user, {
      ...req.body,
      title: title.trim(),
    });

    return res.status(201).json({
      success: true,
      message: "Bug reported successfully.",
      data: bug,
    });
  } catch (error) {
    logger.error("Report bug error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to report bug.",
    });
  }
}

async function fetchProjectBugs(req, res) {
  try {
    const { projectId } = req.params;
    const { status, severity, moduleId } = req.query;

    if (!projectId || typeof projectId !== "string") {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (status && !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bug status.",
      });
    }

    if (severity && !SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid severity.",
      });
    }

    if (
      moduleId &&
      (!Number.isSafeInteger(Number(moduleId)) || Number(moduleId) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID.",
      });
    }

    const bugs = await bugsService.getProjectBugs(projectId, {
      status,
      severity,
      moduleId,
    }, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Project bugs fetched successfully.",
      count: bugs.length,
      data: bugs,
    });
  } catch (error) {
    logger.error("Fetch bugs error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch project bugs.",
    });
  }
}

async function getDevelopers(req, res) {
  try {
    // Developers on the teams of the projects this lead leads
    const employees = await bugsService.getDevs(
      req.user.companyId,
      req.user.userId,
    );

    const developers = employees.map((employee) => ({
      id: employee.id,
      userId: employee.userId,
      name: [employee.user?.firstName, employee.user?.lastName]
        .filter(Boolean)
        .join(" "),
    }));

    return res.status(200).json({
      success: true,
      message: "Developers fetched successfully.",
      count: developers.length,
      data: developers,
    });
  } catch (error) {
    logger.error("Fetch developers error", { error: error?.message, stack: error?.stack });

    return res.status(500).json({
      success: false,
      message: "Failed to fetch developers.",
    });
  }
}

async function updateProjectBug(req, res) {
  try {
    const { bugId, projectId } = req.params;
    const { title, severity, status, discoverySource, moduleId, assignedTo } =
      req.body;

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

    if (!uuidRegex.test(bugId)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bug ID.",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    if (title !== undefined && (typeof title !== "string" || !title.trim())) {
      return res.status(400).json({
        success: false,
        message: "Bug title cannot be empty.",
      });
    }

    if (severity !== undefined && !SEVERITIES.includes(severity)) {
      return res.status(400).json({
        success: false,
        message: "Invalid severity.",
      });
    }

    if (status !== undefined && !STATUSES.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid bug status.",
      });
    }

    if (
      discoverySource !== undefined &&
      !DISCOVERY_SOURCES.includes(discoverySource)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid discovery source.",
      });
    }

    if (
      moduleId !== undefined &&
      moduleId !== null &&
      moduleId !== "" &&
      (!Number.isSafeInteger(Number(moduleId)) || Number(moduleId) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid module ID.",
      });
    }

    if (
      assignedTo !== undefined &&
      assignedTo !== null &&
      assignedTo !== "" &&
      (!Number.isSafeInteger(Number(assignedTo)) || Number(assignedTo) <= 0)
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid developer ID.",
      });
    }

    const bug = await bugsService.updateBug(bugId, projectId, req.body, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Bug updated successfully.",
      data: bug,
    });
  } catch (error) {
    logger.error("Update bug error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to update bug.",
    });
  }
}

async function fetchAssignedBugs(req, res) {
  try {
    const { projectId } = req.params;
    const employeeId = req.user.userId;

    if (!employeeId) {
      return res.status(400).json({
        success: false,
        message: "Employee ID is required.",
      });
    }

    if (!projectId) {
      return res.status(400).json({
        success: false,
        message: "Project ID is required.",
      });
    }

    const bugs = await bugsService.getAssignedBugs(
      employeeId,
      projectId,
      req.user.companyId
    );

    return res.status(200).json({
      success: true,
      message: "Assigned bugs fetched successfully.",
      count: bugs.length,
      data: bugs,
    });
  } catch (error) {
    logger.error("Fetch assigned bugs error", { error: error?.message, stack: error?.stack });

        return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Failed to fetch assigned bugs.",
    });
  }
}

async function projectsDropdown(req, res) {
  try {
    const data = await bugsService.projectsDropdown(req.user);

    return res.status(200).json({
      success: true,
      message: "Projects fetched successfully.",
      data,
    });
  } catch (error) {
    logger.error("Client projects dropdown error", { error: error?.message, stack: error?.stack });

    return res.status(500).json({
      success: false,
      message: error.message || "Failed to fetch projects.",
    });
  }
}

async function updateBugStatus(req, res) {
  try {
    const { uuid } = req.params;
    const { status } = req.body;

    const bug = await bugsService.updateStatusDEV(uuid, status, req.user);

    return res.status(200).json({
      success: true,
      message: "Bug status updated successfully.",
      data: bug,
    });
  } catch (error) {
    logger.error("Update bug status error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Failed to update bug status.",
    });
  }
}

async function getReportedIssues(req, res) {
  try {
    const data = await bugsService.getReportedIssues(req.user.userId);
    return res.status(200).json({
      success: true,
      message: "Bug issuess fetched successfully.",
      data: data,
    });
  } catch (talha) {
    logger.error("Update bug status error", { error: talha?.message, stack: talha?.stack });

    return res.status(talha.statusCode || 500).json({
      success: false,
      message:
        talha.statusCode && talha.statusCode < 500
          ? talha.message
          : "Failed to update bug status.",
    });
  }
}

async function getIssuesForTester(req, res) {
  try {
    const data = await bugsService.getIssuesForTester(req.user.userId, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Issues fetched successfully.",
      data: data,
    });
  } catch (error) {
    logger.error("Get issues for tester error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Failed to fetch issues.",
    });
  }
}

async function updateIssueStatus(req, res) {
  try {
    const { uuid } = req.params;
    const { status, classification } = req.body;

    const data = await bugsService.updateStatus(uuid, status, classification, req.user);

    return res.status(200).json({
      success: true,
      message: "Issue status updated successfully.",
      data,
    });
  } catch (error) {
    logger.error("Update issue status error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message:
        error.statusCode && error.statusCode < 500
          ? error.message
          : "Failed to update issue status.",
    });
  }
}

async function createBugByTester(req, res) {
  try {
    const data = await bugsService.createBugByTester(req.body, req.user);

    return res.status(201).json({
      success: true,
      message: "Bug created successfully.",
      data,
    });
  } catch (talha) {
    logger.error("Create bug controller error", { error: talha?.message, stack: talha?.stack });

    return res.status(talha.statusCode || 500).json({
      success: false,
      message:
        talha.statusCode && talha.statusCode < 500
          ? talha.message
          : "Failed to create bug.",
    });
  }
}

async function getBugsInTester(req, res) {
  try {
    const data = await bugsService.getBugsInTester(req.user.userId, req.user.companyId);

    return res.status(200).json({
      success: true,
      message: "Bugs fetched successfully.",
      data,
    });
  } catch (talha) {
    logger.error("Get bugs for tester error", { error: talha?.message, stack: talha?.stack });

    return res.status(talha.statusCode || 500).json({
      success: false,
      message:
        talha.statusCode && talha.statusCode < 500
          ? talha.message
          : "Failed to fetch bugs.",
    });
  }
}

async function updateBugByTester(req, res) {
  try {
    const { uuid } = req.params;
    const data = await bugsService.updateBugByTester(uuid, req.body, req.user);

    return res.status(200).json({
      success: true,
      message: "Bug updated successfully.",
      data,
    });
  } catch (talha) {
    logger.error("Update bug by tester error", { error: talha?.message, stack: talha?.stack });

    return res.status(talha.statusCode || 500).json({
      success: false,
      message:
        talha.statusCode && talha.statusCode < 500
          ? talha.message
          : "Failed to update bug.",
    });
  }
}

/**
 * POST /api/bugs
 * Create a client ticket.
 */
const createIssueReport = async (req, res) => {
  try {

    const issue = await bugsService.createIssueReport(req.user, req.body);

    return res.status(201).json({
      success: true,
      message: "Ticket submitted successfully.",
      data: {
        issue,
      },
    });
  } catch (error) {
    logger.error("Create issue report error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to submit ticket.",
    });
  }
};

/**
 * GET /api/bugs/issued-bugs
 * Get tickets belonging to the authenticated client.
 */
const getClientIssueReports = async (req, res) => {
  try {
    const issues = await bugsService.getClientIssueReports(req.user);

    return res.status(200).json({
      success: true,
      message: "Issue reports fetched successfully.",
      data: {
        issues,
      },
    });
  } catch (error) {
    logger.error("Get client issue reports error", { error: error?.message, stack: error?.stack });

    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Failed to fetch issue reports.",
    });
  }
};

module.exports = {
  reportBug,
  fetchProjectBugs,
  getDevelopers,
  fetchAssignedBugs,
  updateProjectBug,
  projectsDropdown,
  updateBugStatus,
  getReportedIssues,
  getIssuesForTester,
  updateIssueStatus,
  createBugByTester,
  getBugsInTester,
  updateBugByTester,
  createIssueReport,
  getClientIssueReports,
};
