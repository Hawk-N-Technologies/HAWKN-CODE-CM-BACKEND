"use strict";

const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectBug = sequelize.define(
  "ProjectBug",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
    },

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "project_id",
    },

    moduleId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "module_id",
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    severity: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Medium",
      validate: {
        isIn: [["Low", "Medium", "High", "Critical"]],
      },
    },

    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Open",
      validate: {
        isIn: [
          [
            "Open",
            "Assigned",
            "In Progress",
            "Fixed",
            "Ready for Retest",
            "Reopened",
            "Closed",
            "Rejected",
          ],
        ],
      },
    },

    discoverySource: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Client",
      field: "discovery_source",
      validate: {
        isIn: [
          [
            "Client",
            "Testing",
            "Development",
            "Code Review",
            "Production",
            "Retesting",
          ],
        ],
      },
    },

    reportedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reported_by",
    },

    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_to",
    },

    fixedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "fixed_by",
    },

    fixNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "fix_notes",
    },

    fixedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "fixed_at",
    },

    verifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "verified_by",
    },

    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "verified_at",
    },
  },
  {
    tableName: "project_bugs",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    underscored: true,
    indexes: [
      {
        name: "idx_project_bugs_project",
        fields: ["project_id"],
      },
      {
        name: "idx_project_bugs_module",
        fields: ["module_id"],
      },
      {
        name: "idx_project_bugs_status",
        fields: ["status"],
      },
      {
        name: "idx_project_bugs_assigned_to",
        fields: ["assigned_to"],
      },
      {
        name: "idx_project_bugs_reported_by",
        fields: ["reported_by"],
      },
    ],
  },
);

module.exports = ProjectBug;
