const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const BRDVersion = sequelize.define(
  "BRDVersion",
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

    brdId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "brd_id",
    },

    version: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },

    fileName: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "file_name",
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
      allowNull: true,
      field: "mime_type",
    },

    fileSize: {
      type: DataTypes.BIGINT,
      allowNull: true,
      field: "file_size",
    },

    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "uploaded_by",
    },
  },
  {
    tableName: "brd_versions",
    timestamps: true,
    createdAt: "createdAt",
    updatedAt: false,
    underscored: true,

    indexes: [
      {
        unique: true,
        fields: ["brd_id", "version"],
      },
    ],
  },
);

module.exports = BRDVersion;
