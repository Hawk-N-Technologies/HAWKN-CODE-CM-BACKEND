const { Op } = require("@sequelize/core");

const Employee = require("../models/Employee");
const Project = require("../models/Project");
const Client = require("../models/Client");
const BRD = require("../models/BRD");
const Notification = require("../models/Notification");

const PROJECT_DUE_SOON_DAYS = 14;
const ACTIVE_PROJECT_STATUSES = ["Planning", "In Development", "Testing"];

const getToday = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
};

const addDays = (dateString, days) => {
  const date = new Date(`${dateString}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

const companyWhere = (companyId) =>
  companyId == null ? {} : { companyId: Number(companyId) };

const dateOnly = (value) => {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).slice(0, 10);
};

/**
 * Fetch the data used by the admin overview.
 *
 * The current controller calls this function without a company ID, so the
 * no-argument form aggregates the existing data across companies. A company
 * ID can also be supplied by callers that need a company-scoped overview.
 */
async function fetchAdminOverview(companyId = null) {
  const where = companyWhere(companyId);
  const today = getToday();
  const dueSoonThrough = addDays(today, PROJECT_DUE_SOON_DAYS);

  const [
    totalEmployees,
    activeProjects,
    activeClients,
    pendingApprovals,
    projectsNearDeadline,
    approvalRows,
    activityRows,
  ] = await Promise.all([
    Employee.count({ where }),
    Project.count({
      where: {
        ...where,
        status: { [Op.in]: ACTIVE_PROJECT_STATUSES },
      },
    }),
    Client.count({
      where: { ...where, isActive: true },
    }),
    BRD.count({
      where: { ...where, status: "PENDING_ADMIN_APPROVAL" },
    }),
    Project.count({
      where: {
        ...where,
        status: { [Op.in]: ACTIVE_PROJECT_STATUSES },
        deadline: { [Op.gte]: today, [Op.lte]: dueSoonThrough },
      },
    }),
    BRD.findAll({
      where: { ...where, status: "PENDING_ADMIN_APPROVAL" },
      attributes: ["id", "uuid", "title", "projectId", "createdAt"],
      order: [["createdAt", "ASC"], ["id", "ASC"]],
    }),
    Notification.findAll({
      where,
      attributes: ["id", "uuid", "message", "link", "createdAt"],
      order: [["createdAt", "DESC"], ["id", "DESC"]],
      limit: 10,
    }),
  ]);

  const projectIds = approvalRows
    .map((approval) => approval.projectId)
    .filter((id) => id != null);

  const projects = projectIds.length
    ? await Project.findAll({
        where: { id: { [Op.in]: projectIds } },
        attributes: ["id", "uuid", "name"],
      })
    : [];

  const projectById = new Map(
    projects.map((project) => [String(project.id), project]),
  );

  return {
    cards: {
      totalEmployees: Number(totalEmployees),
      activeProjects: Number(activeProjects),
      activeClients: Number(activeClients),
      pendingApprovals: Number(pendingApprovals),
      projectsNearDeadline: Number(projectsNearDeadline),
    },
    pendingApprovals: approvalRows.map((approval) => {
      const project = projectById.get(String(approval.projectId));

      return {
        id: approval.uuid || approval.id,
        name: approval.title || project?.name || "BRD approval",
        date: dateOnly(approval.createdAt),
        link: "/admin/brd",
      };
    }),
    activityFeed: activityRows.map((activity) => ({
      id: activity.uuid || activity.id,
      message: activity.message,
      ...(activity.createdAt ? { date: activity.createdAt } : {}),
      ...(activity.link ? { link: activity.link } : {}),
    })),
  };
}

module.exports = { fetchAdminOverview };
