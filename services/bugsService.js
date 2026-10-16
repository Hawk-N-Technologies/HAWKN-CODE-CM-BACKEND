"use strict";

const ProjectBug = require("../models/ProjectBug");

async function createBug(userId, data) {
  const { projectId, moduleId, title, description, severity, discoverySource } =
    data;

  if (!projectId || !title?.trim()) {
    throw new Error("Project and bug title are required.");
  }

  const bug = await ProjectBug.create({
    projectId,
    moduleId: moduleId || null,
    title: title.trim(),
    description: description?.trim() || null,
    severity: severity || "Medium",
    discoverySource: discoverySource || "Client",
    reportedBy: userId,
  });

  return bug;
}

module.exports = {
  createBug,
};
