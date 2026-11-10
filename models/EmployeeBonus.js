const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const EmployeeBonus = sequelize.define(
  "EmployeeBonus",
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

    bonusType: {
      type: DataTypes.STRING(30),
      allowNull: false,
      columnName: "bonus_type",
    },

    amount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
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
    tableName: "employee_bonuses",
    // Only created_at exists (no updated_at) — bonuses are never edited
    timestamps: false,
  },
);

module.exports = EmployeeBonus;