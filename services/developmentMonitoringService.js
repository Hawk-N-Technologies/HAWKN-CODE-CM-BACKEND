"use strict";

/**
 * Admin → Development Monitoring (READ-ONLY).
 *
 * For every open project of the company (not Completed / Cancelled):
 *   - progress, deadline, tasks done / open / overdue, open bugs
 * Plus:
 *   - overdue tasks (due date passed, not Done), oldest first
 *   - developer workload: open tasks, overdue tasks and open bugs per developer
 *
 * Nothing here changes data.
 */

const { Op } = require("@sequelize/core");
const {
  Project,
  Client,
  Employee,
  User,
  Role,
  ProjectTask,
  ProjectTaskDeveloper,
  ProjectBug,
} = require("../models/associations");

const CLOSED_PROJECT_STATUSES = ["Completed", "Cancelled"];
// Still needs work by someone (not Closed / Rejected)
const OPEN_BUG_STATUSES = ["Open", "Assigned", "In Progress", "Fixed", "Ready for Retest", "Reopened"];
// On a developer's plate right now
const DEVELOPER_BUG_STATUSES = ["Open", "Assigned", "In Progress", "Reopened"];
const MAX_PROJECTS = 500;
const MAX_OVERDUE_ROWS = 100;

// Today in India as "YYYY-MM-DD" (the company works in IST)
const todayIst = () => new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

const daysBetween = (from, to) =>
  Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86400000);

const dateOnly = (value) => (value ? String(value).slice(0, 10) : null);
const fullName = (user) =>
  [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "—";

async function getMonitoring(companyId) {
  const today = todayIst();

  const projects = await Project.findAll({
    where: { companyId, status: { [Op.notIn]: CLOSED_PROJECT_STATUSES } },
    attributes: ["id", "uuid", "name", "status", "progress", "deadline"],
    include: [
      {
        model: Client,
        as: "client",
        attributes: ["id"],
        include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "email"] }],
      },
      {
        model: Employee,
        as: "projectLead",
        attributes: ["id"],
        include: [{ model: User, as: "user", attributes: ["firstName", "lastName", "email"] }],
      },
    ],
    order: [["deadline", "ASC"], ["createdAt", "DESC"]],
    limit: MAX_PROJECTS,
  });

  const projectIds = projects.map((project) => project.id);
  const inProjects = { projectId: { [Op.in]: projectIds.length ? projectIds : [0] } };

  const [tasks, bugs, developers] = await Promise.all([
    ProjectTask.findAll({
      where: inProjects,
      attributes: ["id", "uuid", "title", "status", "priority", "dueDate", "assignedTo", "projectId"],
      raw: true,
    }),
    ProjectBug.findAll({
      where: { ...inProjects, status: { [Op.in]: OPEN_BUG_STATUSES } },
      attributes: ["projectId", "assignedTo", "status", "severity"],
      raw: true,
    }),
    Employee.findAll({
      where: { companyId, employmentStatus: "Active" },
      attributes: ["id", "uuid"],
      include: [
        {
          model: User,
          as: "user",
          required: true,
          attributes: ["firstName", "lastName", "email"],
          include: [
            { model: Role, as: "role", required: true, attributes: [], where: { name: "developer" } },
          ],
        },
      ],
    }),
  ]);

  // Developers linked to each task (assignee + task developer links)
  const taskDevLinks = tasks.length
    ? await ProjectTaskDeveloper.findAll({
        where: { taskId: { [Op.in]: tasks.map((task) => task.id) } },
        attributes: ["taskId", "employeeId"],
        raw: true,
      })
    : [];

  const developersOfTask = new Map();
  for (const task of tasks) {
    developersOfTask.set(task.id, new Set(task.assignedTo ? [Number(task.assignedTo)] : []));
  }
  for (const link of taskDevLinks) {
    developersOfTask.get(link.taskId)?.add(Number(link.employeeId));
  }

  const isOverdueTask = (task) =>
    task.status !== "Done" && task.dueDate && dateOnly(task.dueDate) < today;

  const projectById = new Map(projects.map((project) => [project.id, project]));
  const developerById = new Map(developers.map((dev) => [Number(dev.id), dev]));

  // ---- Projects --------------------------------------------------------------
  const projectRows = projects.map((project) => {
    const own = tasks.filter((task) => task.projectId === project.id);
    const done = own.filter((task) => task.status === "Done").length;
    const deadline = dateOnly(project.deadline);
    const daysLeft = deadline ? daysBetween(today, deadline) : null;

    return {
      uuid: project.uuid,
      name: project.name,
      clientName: fullName(project.client?.user),
      leadName: project.projectLead ? fullName(project.projectLead.user) : "Not assigned",
      status: project.status,
      progress: Number(project.progress) || 0,
      deadline,
      daysLeft,
      isOverdue: daysLeft !== null && daysLeft < 0,
      tasks: {
        total: own.length,
        done,
        open: own.length - done,
        overdue: own.filter(isOverdueTask).length,
      },
      openBugs: bugs.filter((bug) => bug.projectId === project.id).length,
      criticalBugs: bugs.filter((bug) => bug.projectId === project.id && bug.severity === "Critical").length,
    };
  });

  // ---- Overdue tasks ---------------------------------------------------------
  const overdue = tasks.filter(isOverdueTask);
  const overdueTasks = overdue
    .map((task) => {
      const names = [...(developersOfTask.get(task.id) || [])]
        .map((id) => developerById.get(id))
        .filter(Boolean)
        .map((dev) => fullName(dev.user));

      return {
        uuid: task.uuid,
        title: task.title,
        projectName: projectById.get(task.projectId)?.name ?? "—",
        assignees: names.length ? names.join(", ") : "Unassigned",
        status: task.status,
        priority: task.priority,
        dueDate: dateOnly(task.dueDate),
        daysOverdue: daysBetween(dateOnly(task.dueDate), today),
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
    .slice(0, MAX_OVERDUE_ROWS);

  // ---- Developer workload ----------------------------------------------------
  const workload = developers
    .map((dev) => {
      const id = Number(dev.id);
      const mine = tasks.filter(
        (task) => task.status !== "Done" && developersOfTask.get(task.id)?.has(id),
      );

      return {
        uuid: dev.uuid,
        name: fullName(dev.user),
        email: dev.user?.email ?? null,
        openTasks: mine.length,
        overdueTasks: mine.filter(isOverdueTask).length,
        openBugs: bugs.filter(
          (bug) => Number(bug.assignedTo) === id && DEVELOPER_BUG_STATUSES.includes(bug.status),
        ).length,
      };
    })
    .sort((a, b) => b.openTasks + b.openBugs - (a.openTasks + a.openBugs) || a.name.localeCompare(b.name));

  return {
    summary: {
      activeProjects: projectRows.length,
      overdueProjects: projectRows.filter((row) => row.isOverdue).length,
      overdueTasks: overdue.length,
      openBugs: bugs.length,
      criticalBugs: bugs.filter((bug) => bug.severity === "Critical").length,
      developers: workload.length,
    },
    projects: projectRows,
    overdueTasks,
    workload,
  };
}

module.exports = { getMonitoring };
