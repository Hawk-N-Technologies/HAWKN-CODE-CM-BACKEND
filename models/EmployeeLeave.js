const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const EmployeeLeave = sequelize.define(
  "EmployeeLeave",
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
      columnName: "employee_id",
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "company_id",
    },

    leaveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "leave_date",
    },

    leaveType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      columnName: "leave_type",
    },

    leaveSession: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "FULL_DAY",
      columnName: "leave_session",
    },

    leaveStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "PENDING",
      columnName: "leave_status",
    },

    // NULL while pending/rejected.
    // TRUE/FALSE after HR approves.
    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: true,
      columnName: "is_paid",
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
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
  },
  {
    tableName: "employee_leaves",
    timestamps: true,
    underscored: true,
  },
);

module.exports = EmployeeLeave;
