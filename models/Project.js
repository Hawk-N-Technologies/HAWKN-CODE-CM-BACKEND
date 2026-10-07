const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Project = sequelize.define(
  "Project",
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

    clientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "client_id",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    projectLeadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "project_lead_id",
    },

    tier: {
      type: DataTypes.STRING(30),
      allowNull: false,
      defaultValue: "Tier I",
      validate: {
        isIn: [["Tier I", "Tier II", "Tier III"]],
      },
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "start_date",
    },

    deadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },

    internalDeadline: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "internal_deadline",
    },

    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "Planning",
      validate: {
        isIn: [
          [
            "Planning",
            "In Development",
            "Testing",
            "Completed",
            "On Hold",
            "Cancelled",
          ],
        ],
      },
    },

    progress: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      validate: {
        min: 0,
        max: 100,
      },
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "projects",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Project;
