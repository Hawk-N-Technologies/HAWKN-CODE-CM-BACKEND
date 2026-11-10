"use strict";

const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const TaskTesting = sequelize.define(
  "TaskTesting",
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

    taskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "task_id",
    },

    testTaskTesterId: {
      type: DataTypes.BIGINT,
      allowNull: false,
      field: "test_task_tester_id",
    },

    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: "attempt_number",
      validate: {
        min: 1,
        isInt: true,
      },
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
      validate: {
        isIn: [["Pending", "In Progress", "Passed", "Failed"]],
      },
    },

    testNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "test_notes",
    },

    testedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "tested_at",
    },
  },
  {
    tableName: "task_testing",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        name: "uq_task_testing_attempt",
        unique: true,
        fields: ["test_task_tester_id", "attempt_number"],
      },
      {
        name: "idx_task_testing_assignment_status",
        fields: ["test_task_tester_id", "status"],
      },
      {
        name: "idx_task_testing_task",
        fields: ["task_id"],
      },
      {
        name: "idx_task_testing_project",
        fields: ["project_id"],
      },
    ],
  },
);

module.exports = TaskTesting;
