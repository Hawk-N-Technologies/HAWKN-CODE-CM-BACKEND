"use strict";

const DataTypes = require("@sequelize/core");
const sequelize = require("../config/db");

const CompanyProfile = sequelize.define(
  "CompanyProfile",
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

    officialCompanyName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "official_company_name",
    },

    officialEmail: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "official_email",
      validate: {
        isEmail: true,
      },
    },

    vision: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    mission: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    // companyStoryDocumentPath: {
    //   type: DataTypes.STRING(500),
    //   allowNull: true,
    //   field: "company_story_document_path",
    // },

    // companyStoryDocumentName: {
    //   type: DataTypes.STRING(255),
    //   allowNull: true,
    //   field: "company_story_document_name",
    // },

    // Blog sections
    whatPeopleShouldKnow: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "what_people_should_know",
    },

    whyCustomersShouldCare: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "why_customers_should_care",
    },

    cultureAndValues: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "culture_and_values",
    },

    companyStory: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "company_story",
    },
  },
  {
    tableName: "company_profiles",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CompanyProfile;
