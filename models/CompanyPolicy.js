
"use strict";

const DataTypes = require("@sequelize/core");
const sequelize = require("../config/db");

const CompanyPolicy = sequelize.define(
  "CompanyPolicy",
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
      unique: true,
      field: "company_id",
    },

    leavePolicy: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
      field: "leave_policy",
    },

    attendancePolicy: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
      field: "attendance_policy",
    },

    codeOfConduct: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
      field: "code_of_conduct",
    },

    dataSecurityPolicy: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
      field: "data_security_policy",
    },
  },
  {
    tableName: "company_policies",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CompanyPolicy;
