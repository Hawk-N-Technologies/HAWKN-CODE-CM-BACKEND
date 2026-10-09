const { Project, Client, Employee, User } = require("../models/associations");
const logger = require("../utils/logger");

/**
 * Client → Dashboard (READ-ONLY).
 * The logged-in user is a client (clients.user_id = user). They see only
 * THEIR company's projects for THEIR client record.
 * Uses the existing Sequelize models + associations only — no raw SQL.
 */

const MAX_ROWS = 200; // safety cap
const DUE_SOON_DAYS = 14;
const CLOSED_STATUSES = ["Completed", "Cancelled"];

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Whole days between two "YYYY-MM-DD" dates (UTC → no daylight-saving drift)
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ");
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

/**
 * What a CLIENT may see about a project. Deliberately leaves out internal
 * details (internal deadline = the team's private target, internal ids,
 * lead's email).
 */
function toResponse(project) {
  const deadline = dateOnly(project.deadline);
  const isOpen = !CLOSED_STATUSES.includes(project.status);
  const daysLeft = isOpen && deadline ? daysBetween(todayIst(), deadline) : null;

  return {
    uuid: project.uuid,
    name: project.name,
    status: project.status,
    progress: Number(project.progress),
    startDate: dateOnly(project.startDate),
    deadline,
    daysLeft,
    isOverdue: daysLeft !== null && daysLeft < 0,
    isDueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    leadName: fullName(project.projectLead?.user) || null,
  };
}

async function getDashboardProjects(userId, companyId) {
  try {
    // 1) Which client record belongs to this login?
    const client = await Client.findOne({
      where: { userId, companyId, isActive: true },
      attributes: ["id"],
    });

    // No (active) client profile linked → nothing to show, not an error
    if (!client) {
      logger.warn("Client dashboard: no active client profile for user", { userId, companyId });
      return { summary: { total: 0, active: 0, completed: 0 }, projects: [] };
    }

    // 2) That client's projects (+ project lead's name)
    const projects = await Project.findAll({
      where: { clientId: client.id, companyId },
      attributes: ["uuid", "name", "status", "progress", "startDate", "deadline", "createdAt"],
      include: [
        {
          model: Employee,
          as: "projectLead",
          required: false, // projects without a lead still show
          attributes: ["id"],
          include: [{ model: User, as: "user", attributes: ["firstName", "lastName"] }],
        },
      ],
      order: [
        ["deadline", "ASC"], // Postgres puts empty deadlines last
        ["createdAt", "DESC"],
      ],
      limit: MAX_ROWS,
    });

    // Open projects first, then Completed / Cancelled (stable sort keeps deadline order)
    const rows = projects
      .map(toResponse)
      .sort((a, b) => Number(CLOSED_STATUSES.includes(a.status)) - Number(CLOSED_STATUSES.includes(b.status)));

    const summary = {
      total: rows.length,
      active: rows.filter((p) => !CLOSED_STATUSES.includes(p.status)).length,
      completed: rows.filter((p) => p.status === "Completed").length,
    };

    logger.info("Client dashboard projects fetched", { userId, companyId, count: rows.length });
    return { summary, projects: rows };
  } catch (error) {
    logger.error("Failed to fetch client dashboard projects", {
      userId,
      companyId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  getDashboardProjects,
};