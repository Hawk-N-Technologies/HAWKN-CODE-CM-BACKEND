const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const BugTesting = sequelize.define(
  "BugTesting",
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

    bugId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "bug_id",
    },

    attemptNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      field: "attempt_number",
      validate: {
        min: 1,
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
    tableName: "bug_testing",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        unique: true,
        fields: ["bug_id", "attempt_number"],
        name: "uq_bug_testing_attempt",
      },
    ],
  },
);

module.exports = BugTesting;
