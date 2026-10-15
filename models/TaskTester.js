"use strict";

const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const TaskTester = sequelize.define(
  "TaskTester",
  {
    id: {
      type: DataTypes.BIGINT,
      primaryKey: true,
      autoIncrement: true,
    },

    uuid: {
      type: DataTypes.UUID,
      allowNull: false,
      unique: true,
      defaultValue: DataTypes.UUIDV4,
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
  },
  {
    tableName: "test_task_testers",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: false,
    underscored: true,
    indexes: [
      {
        name: "uq_test_task_testers_task_tester",
        unique: true,
        fields: ["task_id", "tester_id"],
      },
      {
        name: "idx_test_task_testers_tester",
        fields: ["tester_id"],
      },
      {
        name: "idx_test_task_testers_task",
        fields: ["task_id"],
      },
    ],
  },
);

module.exports = TaskTester;
