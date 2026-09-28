const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Company = sequelize.define(
  "Company",
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

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
  },
  {
    tableName: "companies",
    timestamps: true,
    underscored: true,
  }
);

module.exports = Company;