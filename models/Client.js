const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Client = sequelize.define(
  "Client",
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
      field: "company_id",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    contactPerson: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "contact_person",
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },

    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "clients",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Client;
