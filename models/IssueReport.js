const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const IssueReport = sequelize.define(
  "IssueReport",
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

    reportedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reported_by",
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
      defaultValue: "Submitted",
      validate: {
        isIn: [
          [
            "Submitted",
            "Under Review",
            "Confirmed",
            "Feature Request",
            "Rejected",
          ],
        ],
      },
    },

    classification: {
      type: DataTypes.STRING(20),
      allowNull: true,
      validate: {
        isIn: [["Bug", "Feature Request"]],
      },
    },

    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "reviewed_by",
    },

    reviewNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "review_notes",
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "reviewed_at",
    },
  },
  {
    tableName: "issue_reports",
    timestamps: true,
    underscored: true,
  },
);

module.exports = IssueReport;
