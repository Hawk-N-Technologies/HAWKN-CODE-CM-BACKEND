const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

/**
 * A browser/device that turned on phone/laptop alerts for one user.
 */
const PushSubscription = sequelize.define(
  "PushSubscription",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "company_id",
    },
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      columnName: "user_id",
    },
    endpoint: {
      type: DataTypes.TEXT,
      allowNull: false,
      unique: true,
    },
    p256dh: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    auth: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    userAgent: {
      type: DataTypes.STRING(500),
      allowNull: true,
      columnName: "user_agent",
    },
  },
  {
    tableName: "push_subscriptions",
    timestamps: true,
    underscored: true,
  },
);

module.exports = PushSubscription;
