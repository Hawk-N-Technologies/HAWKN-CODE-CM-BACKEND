require("dotenv").config();
const { Sequelize } = require("@sequelize/core");
const { PostgresDialect } = require("@sequelize/postgres");
const { MySqlDialect } = require("@sequelize/mysql");

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error("⚠️ DATABASE_URL environment variable is missing!");
}
const isMysql = dbUrl.startsWith("mysql://");

const sequelize = new Sequelize({
  dialect: isMysql ? MySqlDialect : PostgresDialect,
  url: dbUrl,
  logging: process.env.NODE_ENV === "development" ? console.log : false,
});

module.exports = sequelize;

