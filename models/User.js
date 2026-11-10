const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const User = sequelize.define(
  "User",
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

    roleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "role_id",
    },

    firstName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "first_name",
    },

    lastName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "last_name",
    },

    email: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    passwordHash: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "password_hash",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    underscored: true,
  },
);

module.exports = User;
