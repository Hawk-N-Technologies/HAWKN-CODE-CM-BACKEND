const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectPhase = sequelize.define(
  "ProjectPhase",
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
      field: "project_id",
    },

    moduleId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "module_id",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    startDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "start_date",
    },

    endDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "end_date",
      validate: {
        isAfterOrEqualToStartDate(value) {
          if (
            value &&
            this.startDate &&
            new Date(value) < new Date(this.startDate)
          ) {
            throw new Error("End date must be on or after start date");
          }
        },
      },
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Not Started",
      validate: {
        isIn: [["Not Started", "In Progress", "Completed", "On Hold"]],
      },
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },
  },
  {
    tableName: "project_phases",
    timestamps: true,
    underscored: true,
    indexes: [
      {
        fields: ["project_id"],
      },
      {
        fields: ["module_id"],
      },
      {
        unique: true,
        fields: ["module_id", "name"],
      },
    ],
  },
);

module.exports = ProjectPhase;
