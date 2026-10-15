const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const ProjectOperationDeveloper = sequelize.define(
  "ProjectOperationDeveloper",
  {
    projectOperationId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: "project_operation_id",
    },

    employeeId: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      allowNull: false,
      field: "employee_id",
    },
  },
  {
    tableName: "project_operation_developers",
    timestamps: true,
    underscored: true,
  },
);

module.exports = ProjectOperationDeveloper;
