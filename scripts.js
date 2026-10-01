const fs = require("fs");
const path = require("path");
const sequelize = require("./config/db");

const migrationsPath = path.join(__dirname, "migrations");

async function migrate() {
  try {
    await sequelize.authenticate();

    console.log("✅ Database connected");

    await sequelize.queryInterface.createTable("SequelizeMeta", {
      name: {
        type: sequelize.Sequelize.STRING,
        allowNull: false,
        unique: true,
        primaryKey: true,
      },
    });

    const [executedRecords] = await sequelize.query(
      "SELECT name FROM SequelizeMeta;"
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

      await migration.up(sequelize.queryInterface, sequelize.Sequelize);

      await sequelize.query(
        "INSERT INTO SequelizeMeta (name) VALUES (?);",
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

const command = process.argv[2];

if (command === "migrate") {
  migrate();
} else if (command === "seed") {
  seed();
} 
