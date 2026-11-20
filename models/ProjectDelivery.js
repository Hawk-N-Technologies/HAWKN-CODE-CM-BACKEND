const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

/**
 * Delivery & Handover: one submission of a finished project to the client.
 * Holds the live link, how-to document links and the deliverables list —
 * never the codebase.
 */
const DELIVERY_STATUSES = [
  "Pending Admin Approval",
  "Sent Back",
  "Sent to Client",
  "Accepted",
  "Follow-up Requested",
];

const ProjectDelivery = sequelize.define(
  "ProjectDelivery",
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
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "company_id",
    },
    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "project_id",
    },
    versionLabel: {
      type: DataTypes.STRING(50),
      allowNull: true,
      columnName: "version_label",
    },
    liveUrl: {
      type: DataTypes.STRING(500),
      allowNull: false,
      columnName: "live_url",
    },
    deliverables: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    docs: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    status: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Pending Admin Approval",
      validate: {
        isIn: [DELIVERY_STATUSES],
      },
    },
    submittedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "submitted_by",
    },
    submittedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "submitted_at",
    },
    adminNote: {
      type: DataTypes.TEXT,
      allowNull: true,
      columnName: "admin_note",
    },
    reviewedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "reviewed_by",
    },
    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "reviewed_at",
    },
    clientRespondedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "client_responded_at",
    },
    followUpIssueId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "follow_up_issue_id",
    },
  },
  {
    tableName: "project_deliveries",
    timestamps: true,
    underscored: true,
  },
);

ProjectDelivery.STATUSES = DELIVERY_STATUSES;

module.exports = ProjectDelivery;
