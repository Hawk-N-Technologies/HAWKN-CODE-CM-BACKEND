require("dotenv").config();
const { Sequelize } = require("@sequelize/core");
const { PostgresDialect } = require("@sequelize/postgres");

const sequelize = new Sequelize({
  dialect: PostgresDialect,
  url: process.env.DATABASE_URL,
  timezone: "+05:30",
});

module.exports = sequelize;
