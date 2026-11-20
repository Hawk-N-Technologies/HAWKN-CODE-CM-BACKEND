"use strict";

/**
 * BD Dashboard (read-only) for the BDE (and Admin):
 *   - leads vs converted clients (+ conversion rate, new leads this month)
 *   - BRDs by status
 *   - projects created this month (+ active / total)
 *   - latest leads and latest BRD activity
 * "This month" is the calendar month in India (Asia/Kolkata).
 */

const { Op } = require("@sequelize/core");
const { Client, User, Project, BRD } = require("../models/associations");

const BRD_STATUSES = [
  "DRAFT",
  "PENDING_ADMIN_APPROVAL",
  "ADMIN_REJECTED",
  "PENDING_CLIENT_APPROVAL",
  "CLIENT_REJECTED",
  "APPROVED",
];

// Midnight on the 1st of this month in IST, as a real instant
function startOfMonthIst(now = new Date()) {
  const [year, month] = now
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" })
    .split("-")
    .map(Number);
  return new Date(`${year}-${String(month).padStart(2, "0")}-01T00:00:00+05:30`);
}

const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";

async function getDashboard(companyId) {
  const monthStart = startOfMonthIst();
  const activeClients = { companyId, isActive: true };

  const [
    leads,
    converted,
    newLeadsThisMonth,
    brdRows,
    projectsThisMonth,
    activeProjects,
    totalProjects,
    recentLeads,
    recentBrds,
  ] = await Promise.all([
    Client.count({ where: { ...activeClients, type: "lead" } }),
    Client.count({ where: { ...activeClients, type: "converted" } }),
    Client.count({ where: { ...activeClients, type: "lead", createdAt: { [Op.gte]: monthStart } } }),
    BRD.findAll({
      where: { companyId },
      attributes: ["status"],
      raw: true,
    }),
    Project.count({ where: { companyId, createdAt: { [Op.gte]: monthStart } } }),
    Project.count({ where: { companyId, status: { [Op.notIn]: ["Completed", "Cancelled"] } } }),
    Project.count({ where: { companyId } }),
    Client.findAll({
      where: { ...activeClients, type: "lead" },
      attributes: ["uuid", "createdAt"],
      include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "email"] }],
      order: [["createdAt", "DESC"]],
      limit: 5,
    }),
    BRD.findAll({
      where: { companyId },
      attributes: ["uuid", "title", "status", "updatedAt"],
      include: [{ model: Project, as: "project", attributes: ["name"] }],
      order: [["updatedAt", "DESC"]],
      limit: 5,
    }),
  ]);

  const brdsByStatus = Object.fromEntries(BRD_STATUSES.map((status) => [status, 0]));
  for (const row of brdRows) {
    if (row.status in brdsByStatus) brdsByStatus[row.status] += 1;
  }

  const totalClients = leads + converted;

  return {
    clients: {
      leads,
      converted,
      total: totalClients,
      conversionRate: totalClients ? Math.round((converted / totalClients) * 100) : 0,
      newLeadsThisMonth,
    },
    brds: { total: brdRows.length, byStatus: brdsByStatus },
    projects: { createdThisMonth: projectsThisMonth, active: activeProjects, total: totalProjects },
    recentLeads: recentLeads.map((lead) => ({
      uuid: lead.uuid,
      name: fullName(lead.user),
      email: lead.user?.email ?? null,
      createdAt: lead.createdAt,
    })),
    recentBrds: recentBrds.map((brd) => ({
      uuid: brd.uuid,
      title: brd.title,
      status: brd.status,
      projectName: brd.project?.name ?? "—",
      updatedAt: brd.updatedAt,
    })),
  };
}

module.exports = { getDashboard, startOfMonthIst };
