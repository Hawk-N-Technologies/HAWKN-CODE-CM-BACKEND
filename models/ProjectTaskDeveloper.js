const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectTaskDeveloper = sequelize.define(
  "ProjectTaskDeveloper",
  {
    taskId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: "task_id",
    },

    employeeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: "employee_id",
    },
  },
  {
    tableName: "project_task_developers",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProjectTaskDeveloper;
