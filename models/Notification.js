const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const Notification = sequelize.define(
  "Notification",
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
    recipientUserId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "recipient_user_id",
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING(200),
      allowNull: false,
    },
    message: {
      type: DataTypes.STRING(1000),
      allowNull: false,
    },
    link: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    eventKey: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "event_key",
    },
    metadata: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: {},
    },
    readAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "read_at",
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    underscored: true,
  },
);

module.exports = Notification;