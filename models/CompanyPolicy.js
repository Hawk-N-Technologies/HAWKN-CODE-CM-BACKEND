const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const CompanyPolicy = sequelize.define(
  "CompanyPolicy",
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
    tableName: "company_policies",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CompanyPolicy;
