const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const CompanyRolesResponsibilities = sequelize.define(
  "CompanyRolesResponsibilities",
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
      unique: true,
      field: "company_id",
    },

    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
  },
  {
    tableName: "company_roles_responsibilities",
    timestamps: true,
    underscored: true,
  }
);

module.exports = CompanyRolesResponsibilities;