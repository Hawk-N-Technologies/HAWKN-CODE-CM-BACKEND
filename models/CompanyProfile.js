const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

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

    blogContent: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "blog_content",
    },
  },
  {
    tableName: "company_profiles",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CompanyProfile;
