const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");
const BRD = sequelize.define(
  "BRD",
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

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      field: "project_id",
    },

    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
    },

    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "client_id",
    },

    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    status: {
      type: DataTypes.ENUM(
        "DRAFT",
        "PENDING_ADMIN_APPROVAL",
        "ADMIN_REJECTED",
        "PENDING_CLIENT_APPROVAL",
        "CLIENT_REJECTED",
        "APPROVED",
      ),
      allowNull: false,
      defaultValue: "DRAFT",
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "created_by",
    },
  },
  {
    tableName: "brds",
    timestamps: true,
    underscored: true,
  },
);

module.exports = BRD;
