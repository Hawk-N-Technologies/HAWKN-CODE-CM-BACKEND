const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectModule = sequelize.define(
  "ProjectModule",
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

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },


    priority: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "Medium",
      validate: {
        isIn: [["Low", "Medium", "High", "Critical"]],
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
    tableName: "project_modules",
    timestamps: true,
    underscored: true,
    indexes: [
      { fields: ["project_id"] },
      {
        unique: true,
        fields: ["project_id", "name"],
      },
    ],
  },
);

module.exports = ProjectModule;
