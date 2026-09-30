const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Attendance = sequelize.define(
  "Attendance",
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
      field: "employee_id",
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },

    attendanceDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "attendance_date",
    },

    session: {
      type: DataTypes.STRING(20),
      allowNull: false,
      validate: {
        isIn: [["FIRST_HALF", "SECOND_HALF"]],
      },
    },

    checkIn: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "check_in",
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Present",
      validate: {
        isIn: [["Present", "Absent"]],
      },
    },
  },
  {
    tableName: "attendances",
    timestamps: true,
    underscored: true,

    indexes: [
      {
        unique: true,
        fields: ["employee_id", "attendance_date", "session"],
        name: "uq_employee_attendance_session",
      },
    ],
  },
);

module.exports = Attendance;
