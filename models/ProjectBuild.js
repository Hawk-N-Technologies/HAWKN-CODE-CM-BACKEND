const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

/**
 * Build Testing: one version (build) of a project that the tester checks.
 */
const BUILD_ENVIRONMENTS = ["QA", "Staging", "Production"];
const BUILD_RESULTS = ["Pending", "Passed", "Failed"];

const ProjectBuild = sequelize.define(
  "ProjectBuild",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
    uuid: { type: DataTypes.UUID, allowNull: false, unique: true, defaultValue: DataTypes.UUIDV4 },
    companyId: { type: DataTypes.INTEGER, allowNull: false, columnName: "company_id" },
    projectId: { type: DataTypes.INTEGER, allowNull: false, columnName: "project_id" },
    versionLabel: { type: DataTypes.STRING(50), allowNull: false, columnName: "version_label" },
    environment: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "QA",
      validate: { isIn: [BUILD_ENVIRONMENTS] },
    },
    buildUrl: { type: DataTypes.STRING(500), allowNull: true, columnName: "build_url" },
    releaseNotes: { type: DataTypes.TEXT, allowNull: true, columnName: "release_notes" },
    result: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Pending",
      validate: { isIn: [BUILD_RESULTS] },
    },
    testNotes: { type: DataTypes.TEXT, allowNull: true, columnName: "test_notes" },
    createdBy: { type: DataTypes.INTEGER, allowNull: true, columnName: "created_by" },
    testedBy: { type: DataTypes.INTEGER, allowNull: true, columnName: "tested_by" },
    testedAt: { type: DataTypes.DATE, allowNull: true, columnName: "tested_at" },
  },
  {
    tableName: "project_builds",
    timestamps: true,
    underscored: true,
  },
);

ProjectBuild.ENVIRONMENTS = BUILD_ENVIRONMENTS;
ProjectBuild.RESULTS = BUILD_RESULTS;

module.exports = ProjectBuild;
