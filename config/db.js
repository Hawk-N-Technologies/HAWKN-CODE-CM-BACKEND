require("./env");
const { Sequelize } = require("@sequelize/core");
const { PostgresDialect } = require("@sequelize/postgres");
const { MySqlDialect } = require("@sequelize/mysql");

const dbUrl = process.env.DATABASE_URL || "";
if (!dbUrl) {
  console.error(
    `⚠️ DATABASE_URL environment variable is missing for NODE_ENV='${process.env.NODE_ENV}'!`
  );
}
const isMysql = dbUrl.startsWith("mysql://");

const sequelize = new Sequelize({
  dialect: isMysql ? MySqlDialect : PostgresDialect,
  url: dbUrl,
  // India time for Postgres (attendance / notification dates depend on it)
  ...(isMysql ? {} : { timezone: "Asia/Kolkata" }),
  logging: process.env.NODE_ENV === "development" ? console.log : false,
});

module.exports = sequelize;
