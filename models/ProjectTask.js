const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectTask = sequelize.define(
  "ProjectTask",
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

    phaseId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "phase_id",
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    assignedTo: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_to",
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
    },

    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Medium",
      validate: {
        isIn: [["Low", "Medium", "High", "Critical"]],
      },
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Backlog",
      validate: {
        isIn: [
          ["Backlog", "To Do", "In Progress", "Code Review", "Testing", "Done"],
        ],
      },
    },

    isBlocked: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_blocked",
    },

    blockedReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "blocked_reason",
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "start_date",
    },

    dueDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "due_date",
    },

    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },

    estimatedHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      field: "estimated_hours",
      validate: {
        min: 0,
      },
    },

    actualHours: {
      type: DataTypes.DECIMAL(8, 2),
      allowNull: true,
      field: "actual_hours",
      validate: {
        min: 0,
      },
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
  },
  {
    tableName: "project_tasks",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id", "status"] },
      { fields: ["assigned_to", "status"] },
      { fields: ["module_id"] },
      { fields: ["phase_id"] },
      { fields: ["project_id", "due_date"] },
    ],
  },
);

module.exports = ProjectTask;
