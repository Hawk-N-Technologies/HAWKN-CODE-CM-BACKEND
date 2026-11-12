const fs = require("fs");
const path = require("path");
const sequelize = require("./config/db");
const { DataTypes } = require("@sequelize/core");

const migrationsPath = path.join(__dirname, "migrations");

/**
 * Remembers which migrations already ran (one row per file), so a migration
 * runs ONCE per database instead of on every `npm run migrate`.
 * On a database that existed before this table, the first run re-runs every
 * migration (they are all safe to re-run) and records them; after that,
 * only new files run.
 */
const SchemaMigration = sequelize.define(
  "SchemaMigration",
  {
    name: {
      type: DataTypes.STRING(255),
      primaryKey: true,
    },
    ranAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      columnName: "ran_at",
    },
  },
  {
    tableName: "schema_migrations",
    timestamps: false,
  },
);

const migrationFiles = () =>
  fs
    .readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".js"))
    .sort();

async function ranMigrations() {
  await SchemaMigration.sync(); // creates the table if it doesn't exist
  const rows = await SchemaMigration.findAll({ attributes: ["name"], raw: true });
  return new Set(rows.map((row) => row.name));
}

async function migrate() {
  try {
    await sequelize.authenticate();

    console.log("✅ Database connected");

    const done = await ranMigrations();
    let ranNow = 0;

    for (const file of migrationFiles()) {
      if (done.has(file)) continue; // already ran on this database

      console.log(`Running migration: ${file}`);

      const migration = require(path.join(migrationsPath, file));

      await migration.up(sequelize.queryInterface, sequelize.Sequelize);

      await SchemaMigration.create({ name: file });
      ranNow += 1;

      console.log(`✅ Completed: ${file}`);
    }

    console.log(
      ranNow
        ? `✅ All migrations completed (${ranNow} ran now)`
        : "✅ Database is up to date (no new migrations)",
    );

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

    console.log("✅ Database connected");

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

// npm run migrate:status → which migrations ran / are pending
async function status() {
  try {
    await sequelize.authenticate();

    const done = await ranMigrations();
    const files = migrationFiles();

    files.forEach((file) => {
      console.log(`${done.has(file) ? "✅ ran    " : "⏳ pending"}  ${file}`);
    });

    const pending = files.filter((file) => !done.has(file)).length;
    console.log(`\n${files.length - pending} ran, ${pending} pending`);

    await sequelize.close();
  } catch (error) {
    console.error("❌ Could not read migration status:");
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
} else if (command === "status") {
  status();
}