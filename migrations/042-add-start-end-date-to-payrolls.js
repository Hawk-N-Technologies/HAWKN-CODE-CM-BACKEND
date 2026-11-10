"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableName = "payrolls";
    const constraintName = "chk_payrolls_date_range";

    const tableExists = await queryInterface.tableExists(tableName);

    if (!tableExists) {
      throw new Error('Table "payrolls" does not exist');
    }

    let columns = await queryInterface.describeTable(tableName);

    // Add missing columns.
    if (!columns.start_date) {
      await queryInterface.addColumn(tableName, "start_date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!columns.end_date) {
      await queryInterface.addColumn(tableName, "end_date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    // Backfill existing monthly payrolls.
    await queryInterface.sequelize.query(`
      UPDATE "payrolls"
      SET
        "start_date" = COALESCE(
          "start_date",
          "pay_period"::DATE
        ),
        "end_date" = COALESCE(
          "end_date",
          (
            DATE_TRUNC('month', "pay_period")
            + INTERVAL '1 month'
            - INTERVAL '1 day'
          )::DATE
        )
      WHERE "start_date" IS NULL
         OR "end_date" IS NULL;
    `);

    // Add the constraint only if it does not already exist.
    await queryInterface.sequelize.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1
          FROM pg_constraint
          WHERE conname = '${constraintName}'
            AND conrelid = '"payrolls"'::regclass
        ) THEN
          ALTER TABLE "payrolls"
          ADD CONSTRAINT "${constraintName}"
          CHECK ("start_date" <= "end_date");
        END IF;
      END
      $$;
    `);
  },

  async down(queryInterface) {
    const tableName = "payrolls";

    if (!(await queryInterface.tableExists(tableName))) {
      return;
    }

    // Drop the constraint before removing its columns.
    await queryInterface.sequelize.query(`
      ALTER TABLE "payrolls"
      DROP CONSTRAINT IF EXISTS "chk_payrolls_date_range";
    `);

    const columns = await queryInterface.describeTable(tableName);

    if (columns.end_date) {
      await queryInterface.removeColumn(tableName, "end_date");
    }

    if (columns.start_date) {
      await queryInterface.removeColumn(tableName, "start_date");
    }
  },
};
