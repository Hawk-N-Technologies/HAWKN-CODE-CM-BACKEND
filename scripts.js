require("./config/env");
const fs = require("fs");
const path = require("path");
const sequelize = require("./config/db");

const migrationsPath = path.join(__dirname, "migrations");

async function migrate() {
  try {
    await sequelize.authenticate();

    console.log(`✅ Database connected [${process.env.NODE_ENV}]`);

    const { DataTypes } = require("@sequelize/core");

    await sequelize.queryInterface.createTable("SequelizeMeta", {
      name: {
        type: DataTypes.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
    });

    const isMysql = sequelize.dialect.name === "mysql";
    const metaTable = isMysql ? "`SequelizeMeta`" : '"SequelizeMeta"';

    // Failsafe default for UUID across dialects
    global.uuidDefault = isMysql
      ? sequelize.Sequelize.literal("(UUID())")
      : sequelize.Sequelize.literal("gen_random_uuid()");

    // Proxy DataTypes and Sequelize static helpers (literal, fn, Op) without deprecation warnings
    const migrationSequelize = new Proxy(DataTypes, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return sequelize.Sequelize[prop];
      },
    });

    const [executedRecords] = await sequelize.query(
      `SELECT name FROM ${metaTable};`
    );
    const executedMigrations = new Set(
      executedRecords.map((row) => row.name || row.NAME)
    );

    const files = fs
      .readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".js"))
      .sort();

    for (const file of files) {
      if (executedMigrations.has(file)) {
        console.log(`⏩ Already applied: ${file}`);
        continue;
      }

      console.log(`Running migration: ${file}`);

      const migration = require(path.join(migrationsPath, file));

      await migration.up(sequelize.queryInterface, migrationSequelize);

      await sequelize.query(
        `INSERT INTO ${metaTable} (name) VALUES (?);`,
        { replacements: [file] }
      );

      console.log(`✅ Completed: ${file}`);
    }

    console.log("✅ All migrations completed");

    await sequelize.close();
  } catch (error) {
    console.error("❌ Migration failed:");
    console.error(error);

    await sequelize.close();

    process.exit(1);
  }
}

async function seed() {
  try {
    await sequelize.authenticate();

    console.log(`✅ Database connected [${process.env.NODE_ENV}]`);

    const userSeeder = require("./seeders/userSeeder");

    await userSeeder();

    console.log("✅ Seeding completed");

    await sequelize.close();
  } catch (error) {
    console.error("❌ Seeding failed:");
    console.error(error);

    await sequelize.close();

    process.exit(1);
  }
}

const command = process.argv[2];

if (command === "migrate") {
  migrate();
} else if (command === "seed") {
  seed();
} 
