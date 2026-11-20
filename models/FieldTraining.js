const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

/**
 * Field Training: a training session for the client, run by the tester
 * (date & time, Google Meet / walkthrough link, notes).
 */
const TRAINING_STATUSES = ["Scheduled", "Completed", "Rescheduled", "Cancelled"];

const FieldTraining = sequelize.define(
  "FieldTraining",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.INTEGER, allowNull: false, columnName: "company_id" },
    projectId: { type: DataTypes.INTEGER, allowNull: false, columnName: "project_id" },
    title: { type: DataTypes.STRING(150), allowNull: false },
    scheduledAt: { type: DataTypes.DATE, allowNull: false, columnName: "scheduled_at" },
    durationMinutes: { type: DataTypes.INTEGER, allowNull: true, columnName: "duration_minutes" },
    meetingLink: { type: DataTypes.STRING(500), allowNull: true, columnName: "meeting_link" },
    notes: { type: DataTypes.TEXT, allowNull: true },
    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Scheduled",
      validate: { isIn: [TRAINING_STATUSES] },
    },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, columnName: "created_by" },
  },
  {
    tableName: "field_trainings",
    timestamps: true,
    underscored: true,
  },
);

FieldTraining.STATUSES = TRAINING_STATUSES;

module.exports = FieldTraining;
