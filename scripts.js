const fs = require("fs");
const path = require("path");
const sequelize = require("./config/db");

const migrationsPath = path.join(__dirname, "migrations");

async function migrate() {
  try {
    await sequelize.authenticate();

    console.log("✅ Database connected");

    const files = fs
      .readdirSync(migrationsPath)
      .filter((file) => file.endsWith(".js"))
      .sort();

    for (const file of files) {
      console.log(`Running migration: ${file}`);

      const migration = require(path.join(migrationsPath, file));

      await migration.up(sequelize.queryInterface, sequelize.Sequelize);

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
} else {
  console.log(`
Usage:

  npm run migrate
  npm run seed
`);
}
