const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Payroll = sequelize.define(
  "Payroll",
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

    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "user_id",
    },

    payPeriod: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "pay_period",
    },

    // DECIMAL comes back from Postgres as a string ("55000.00") — the
    // service converts it to a number before sending it to the frontend
    baseSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      columnName: "base_salary",
    },

    lopDeduction: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
      columnName: "lop_deduction",
    },

    bonus: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0,
    },

    netSalary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      columnName: "net_salary",
    },

    paymentMethod: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Bank Transfer",
      columnName: "payment_method",
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
    },

    processedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      columnName: "processed_at",
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "created_by",
    },

    processedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "processed_by",
    },
  },
  {
    tableName: "payrolls",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Payroll;