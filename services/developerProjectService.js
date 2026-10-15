const { Project, Client, Employee, User } = require("../models/associations");
const logger = require("../utils/logger");

/**
 * Developer → My Projects (READ-ONLY).
 * A developer sees every project where THEY are the project lead:
 *   projects.project_lead_id → employees.id → employees.user_id = logged-in user
 * Uses the existing Sequelize models + associations only — no raw SQL.
 */

const MAX_ROWS = 500; // safety cap until the list gets pagination
const DUE_SOON_DAYS = 14;
const CLOSED_STATUSES = ["Completed", "Cancelled"];

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

// Whole days between two "YYYY-MM-DD" dates (UTC → no daylight-saving drift)
const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const fullName = (user) => [user?.firstName, user?.lastName].filter(Boolean).join(" ");
const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);

// Only safe, useful fields go to the frontend — never internal integer ids
function toResponse(project) {
  const deadline = dateOnly(project.deadline);
  const isOpen = !CLOSED_STATUSES.includes(project.status);
  const daysLeft = isOpen && deadline ? daysBetween(todayIst(), deadline) : null;
  const clientUser = project.client?.user;

  return {
    uuid: project.uuid,
    name: project.name,
    tier: project.tier,
    status: project.status,
    progress: Number(project.progress),
    description: project.description,
    startDate: dateOnly(project.startDate),
    deadline,
    internalDeadline: dateOnly(project.internalDeadline),
    // Only open projects with a deadline can be late
    daysLeft,
    isOverdue: daysLeft !== null && daysLeft < 0,
    isDueSoon: daysLeft !== null && daysLeft >= 0 && daysLeft <= DUE_SOON_DAYS,
    client: {
      uuid: project.client?.uuid ?? null,
      // A client IS a user (clients.user_id) → name + email live on users
      name: fullName(clientUser) || "—",
      email: clientUser?.email ?? null,
      phone: project.client?.phone ?? null,
    },
  };
}

async function listMyProjects(userId, companyId) {
  try {
    const projects = await Project.findAll({
      where: { companyId },
      include: [
        {
          // required: true → only projects led by THIS user's employee record
          model: Employee,
          as: "projectLead",
          required: true,
          attributes: ["uuid"],
          where: { userId, companyId },
        },
        {
          model: Client,
          as: "client",
          attributes: ["uuid", "phone"],
          include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "email"] }],
        },
      ],
      // Postgres puts empty deadlines last for ASC
      order: [
        ["deadline", "ASC"],
        ["createdAt", "DESC"],
      ],
      limit: MAX_ROWS,
    });

    // Open projects first, then Completed / Cancelled (stable sort keeps deadline order)
    const rows = projects
      .map(toResponse)
      .sort((a, b) => Number(CLOSED_STATUSES.includes(a.status)) - Number(CLOSED_STATUSES.includes(b.status)));

    logger.info("Developer projects fetched", { companyId, userId, count: rows.length });
    return rows;
  } catch (error) {
    logger.error("Failed to fetch developer projects", {
      companyId,
      userId,
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  listMyProjects,
};