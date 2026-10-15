const { DataTypes } = require("@sequelize/core");
const sequelize = require("../config/db");

const CompanyHoliday = sequelize.define(
  "CompanyHoliday",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
      allowNull: false,
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
      columnName: "company_id",
    },

    holidayDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      columnName: "holiday_date",
    },

    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    isPaid: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      columnName: "is_paid",
    },
  },
  {
    tableName: "company_holidays",
    timestamps: true,
    underscored: true,
  },
);

module.exports = CompanyHoliday;
