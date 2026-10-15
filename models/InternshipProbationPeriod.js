const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const InternshipProbationPeriod = sequelize.define(
  "InternshipProbationPeriod",
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

    employeeId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "employee_id",
    },

    periodType: {
      type: DataTypes.STRING(20),
      allowNull: false,
      columnName: "period_type",
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "start_date",
    },

    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "end_date",
    },

    originalEndDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "original_end_date",
    },

    extensionCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      columnName: "extension_count",
    },

    // DECIMAL comes back as a string — the service converts it
    stipend: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
    },

    performance: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Pending",
    },

    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Active",
    },

    closedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "closed_at",
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "created_by",
    },

    closedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "closed_by",
    },
  },
  {
    tableName: "internship_probation_periods",
    timestamps: true,
    underscored: true,
  },
);

module.exports = InternshipProbationPeriod;