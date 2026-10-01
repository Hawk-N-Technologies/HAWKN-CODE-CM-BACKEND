const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const EmployeeSalary = sequelize.define(
  "EmployeeSalary",
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

    // DECIMAL comes back as a string ("55000.00") — the service converts it
    salary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
    },
  },
  {
    tableName: "employee_salaries",
    // The table has no created_at / updated_at columns
    timestamps: false,
  },
);

module.exports = EmployeeSalary;