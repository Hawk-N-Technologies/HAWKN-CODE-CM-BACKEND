const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectOperation = sequelize.define(
  "ProjectOperation",
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

    projectLeadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "project_lead_id",
    },

    testerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "tester_id",
    },

    technologyStack: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "technology_stack",
    },

    erDiagramStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "NOT_UPLOADED",
      field: "er_diagram_status",
      validate: {
        isIn: [["UPLOADED", "NOT_UPLOADED"]],
      },
    },

    flowchartStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "NOT_UPLOADED",
      field: "flowchart_status",
      validate: {
        isIn: [["UPLOADED", "NOT_UPLOADED"]],
      },
    },

    planningStatus: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "NOT_STARTED",
      field: "planning_status",
      validate: {
        isIn: [["NOT_STARTED", "IN_PROGRESS", "COMPLETED"]],
      },
    },

    createdBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by",
    },

    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "updated_by",
    },
  },
  {
    tableName: "project_operations",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProjectOperation;
