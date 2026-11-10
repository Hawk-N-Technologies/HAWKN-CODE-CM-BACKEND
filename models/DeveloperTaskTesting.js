"use strict";

const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const DeveloperTaskTesting = sequelize.define(
  "DeveloperTaskTesting",
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
    taskId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "task_id",
    },
    developerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "developer_id",
    },
    result: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
      validate: {
        isIn: [["Pending", "Passed", "Failed"]],
      },
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    testedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "tested_at",
    },
  },
  {
    tableName: "developer_task_testing",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["task_id", "developer_id"],
        name: "uq_developer_task_testing_task_developer",
      },
    ],
  },
);

module.exports = DeveloperTaskTesting;