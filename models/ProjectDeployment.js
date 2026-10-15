const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectDeployment = sequelize.define(
  "ProjectDeployment",
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

    projectId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: true,
      columnName: "project_id",
    },

    repositoryUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      columnName: "repository_url",
    },

    serverStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Not Configured",
      columnName: "server_status",
    },

    cicdStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Not Active",
      columnName: "cicd_status",
    },

    credentialsStatus: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Not Added",
      columnName: "credentials_status",
    },

    devDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      columnName: "dev_domain",
    },

    stagingDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      columnName: "staging_domain",
    },

    liveDomain: {
      type: DataTypes.STRING(255),
      allowNull: true,
      columnName: "live_domain",
    },

    documentationUrl: {
      type: DataTypes.STRING(500),
      allowNull: true,
      columnName: "documentation_url",
    },

    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      columnName: "updated_by",
    },
  },
  {
    tableName: "project_deployments",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProjectDeployment;