const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const SalaryIncrement = sequelize.define(
  "SalaryIncrement",
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

    previousSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      columnName: "previous_salary",
    },

    newSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      columnName: "new_salary",
    },

    effectiveDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "effective_date",
    },

    reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "created_by",
    },

    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      columnName: "created_at",
    },
  },
  {
    tableName: "salary_increments",
    // Only created_at exists — increments are history, never edited
    timestamps: false,
  },
);

module.exports = SalaryIncrement;