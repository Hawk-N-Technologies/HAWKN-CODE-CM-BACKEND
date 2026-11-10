const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const EmployeeHierarchyImage = sequelize.define(
  "EmployeeHierarchyImage",
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

    originalFileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "original_file_name",
    },

    fileUrl: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "file_url",
    },

    storageKey: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "storage_key",
    },

    mimeType: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "mime_type",
    },

    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "file_size",
    },

    sortOrder: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "sort_order",
    },

    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "employee_hierarchy_images",
    timestamps: true,
    underscored: true,
  },
);

module.exports = EmployeeHierarchyImage;
