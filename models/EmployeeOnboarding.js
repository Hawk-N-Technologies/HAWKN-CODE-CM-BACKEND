const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const EmployeeOnboarding = sequelize.define(
  "EmployeeOnboarding",
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

    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      columnName: "employee_id",
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "company_id",
    },

    offerLetterSigned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      columnName: "offer_letter_signed",
    },

    documentsSubmitted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      columnName: "documents_submitted",
    },

    documentsVerified: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      columnName: "documents_verified",
    },

    systemAccessGiven: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      columnName: "system_access_given",
    },

    inductionCompleted: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      columnName: "induction_completed",
    },

    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "completed_at",
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "employee_onboarding",
    timestamps: true,
    underscored: true,
  },
);

module.exports = EmployeeOnboarding;