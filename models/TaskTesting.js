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

    testerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "tester_id",
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
  },
);

module.exports = TaskTesting;
