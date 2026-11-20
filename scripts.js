require("./config/env");
const fs = require("fs");
const path = require("path");
const sequelize = require("./config/db");
const { DataTypes } = require("@sequelize/core");

const migrationsPath = path.join(__dirname, "migrations");

/**
 * Remembers which migrations already ran (one row per file), so a migration
 * runs ONCE per database instead of on every `npm run migrate`.
 *
 * Two record tables exist for history reasons and are kept identical:
 *  - schema_migrations (name, ran_at) — dev's tracker
 *  - SequelizeMeta (name)             — staging's tracker
 * A database built by either branch is read correctly: names found in one
 * table are copied into the other, so nothing re-runs and nothing is skipped.
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

const isMysql = () => sequelize.dialect.name === "mysql";
const metaTable = () => (isMysql() ? "`SequelizeMeta`" : '"SequelizeMeta"');

const migrationFiles = () =>
  fs
    .readdirSync(migrationsPath)
    .filter((file) => file.endsWith(".js"))
    .sort();

async function recordInMeta(name) {
  await sequelize.query(`INSERT INTO ${metaTable()} (name) VALUES (?);`, {
    replacements: [name],
  });
}

// Creates both record tables if missing, merges them, returns the set of ran names
async function ranMigrations() {
  await SchemaMigration.sync(); // creates schema_migrations if it doesn't exist

  await sequelize.queryInterface.createTable("SequelizeMeta", {
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
      primaryKey: true,
    },
  });

  const devRows = await SchemaMigration.findAll({ attributes: ["name"], raw: true });
  const [metaRows] = await sequelize.query(`SELECT name FROM ${metaTable()};`);

  const devNames = new Set(devRows.map((row) => row.name));
  const metaNames = new Set(metaRows.map((row) => row.name || row.NAME));

  // Bring both tables to the same list (first run after the dev→staging merge)
  for (const name of metaNames) {
    if (!devNames.has(name)) await SchemaMigration.create({ name });
  }
  for (const name of devNames) {
    if (!metaNames.has(name)) await recordInMeta(name);
  }

  return new Set([...devNames, ...metaNames]);
}

async function migrate() {
  try {
    await sequelize.authenticate();

    console.log(`✅ Database connected [${process.env.NODE_ENV}]`);

    // Failsafe default for UUID across dialects
    global.uuidDefault = isMysql()
      ? sequelize.Sequelize.literal("(UUID())")
      : sequelize.Sequelize.literal("gen_random_uuid()");

    // Proxy DataTypes and Sequelize static helpers (literal, fn, Op) without deprecation warnings
    const migrationSequelize = new Proxy(DataTypes, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return sequelize.Sequelize[prop];
      },
    });

    const done = await ranMigrations();
    let ranNow = 0;

    for (const file of migrationFiles()) {
      if (done.has(file)) continue; // already ran on this database

      console.log(`Running migration: ${file}`);

      const migration = require(path.join(migrationsPath, file));

      await migration.up(sequelize.queryInterface, migrationSequelize);

      await SchemaMigration.create({ name: file });
      await recordInMeta(file);
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
  // The demo seed creates admin@gmail.com / Admin@123 — never on the live database
  if (process.env.NODE_ENV === "production") {
    console.error("❌ `npm run seed` creates demo accounts and is blocked in production.");
    console.error("   For a new live database use:  npm run setup:production");
    process.exit(1);
  }

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

// npm run setup:production → roles + company + first admin on a clean live database
async function setupProduction() {
  try {
    await sequelize.authenticate();
    console.log(`✅ Database connected [${process.env.NODE_ENV}]`);

    const productionSetup = require("./seeders/productionSetup");
    const result = await productionSetup();

    console.log(`✅ Roles ready`);
    console.log(`✅ Company ${result.companyCreated ? "created" : "already exists"}: ${result.companyName}`);
    console.log(
      result.adminCreated
        ? `✅ First admin created: ${result.adminEmail} — log in with the password you set.`
        : `ℹ️  This company already has an admin (${result.adminEmail}). Nothing else was changed.`,
    );

    await sequelize.close();
  } catch (error) {
    console.error("❌ Setup failed:");
    console.error(error.isSetupProblem ? error.message : error);

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
} else if (command === "setup") {
  setupProduction();
}