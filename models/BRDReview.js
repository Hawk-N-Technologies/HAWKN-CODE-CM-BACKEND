const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const BRDReview = sequelize.define(
  "BRDReview",
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

    brdVersionId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "brd_version_id",
    },

    reviewerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "reviewer_id",
    },

    reviewerRole: {
      type: DataTypes.ENUM("admin", "client"),
      allowNull: false,
      field: "reviewer_role",
    },

    action: {
      type: DataTypes.ENUM("APPROVED", "REJECTED"),
      allowNull: false,
    },

    message: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    reviewedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "reviewed_at",
    },
  },
  {
    tableName: "brd_reviews",
    timestamps: false,
    underscored: true,
  },
);

module.exports = BRDReview;
