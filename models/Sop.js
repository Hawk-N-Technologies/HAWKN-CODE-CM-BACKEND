const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

/**
 * Standard Operating Procedure — rich text written by Admin / HR,
 * read by every employee.
 */
const SOP_DEPARTMENTS = ["General", "HR", "Development", "Testing", "Sales & BD", "Operations", "Finance"];

const Sop = sequelize.define(
  "Sop",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.INTEGER, allowNull: false, columnName: "company_id" },
    title: { type: DataTypes.STRING(200), allowNull: false },
    department: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "General",
      validate: { isIn: [SOP_DEPARTMENTS] },
    },
    effectiveDate: { type: DataTypes.DATEONLY, allowNull: true, columnName: "effective_date" },
    content: { type: DataTypes.TEXT, allowNull: false, defaultValue: "" },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, columnName: "created_by" },
    updatedBy: { type: DataTypes.INTEGER, allowNull: true, columnName: "updated_by" },
  },
  {
    tableName: "sops",
    timestamps: true,
    underscored: true,
  },
);

Sop.DEPARTMENTS = SOP_DEPARTMENTS;

module.exports = Sop;
