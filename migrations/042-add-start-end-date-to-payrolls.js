"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("payrolls");

    if (!tableExists) {
      throw new Error('Table "payrolls" does not exist');
    }

    const columns = await queryInterface.describeTable("payrolls");

    if (!columns.start_date) {
      await queryInterface.addColumn("payrolls", "start_date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    if (!columns.end_date) {
      await queryInterface.addColumn("payrolls", "end_date", {
        type: Sequelize.DATEONLY,
        allowNull: true,
      });
    }

    // Backfill existing monthly payrolls.
    // Historical partial periods cannot be inferred from pay_period alone.
    await queryInterface.sequelize.query(`
      UPDATE "payrolls"
      SET
        "start_date" = COALESCE(
          "start_date",
          "pay_period"
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

    // Enforce valid, inclusive payroll date ranges.
    await queryInterface.sequelize.query(`
      ALTER TABLE "payrolls"
      ADD CONSTRAINT "chk_payrolls_date_range"
      CHECK ("start_date" <= "end_date");
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`
      ALTER TABLE "payrolls"
      DROP CONSTRAINT IF EXISTS "chk_payrolls_date_range";
    `);

    const columns = await queryInterface.describeTable("payrolls");

    if (columns.end_date) {
      await queryInterface.removeColumn("payrolls", "end_date");
    }

    if (columns.start_date) {
      await queryInterface.removeColumn("payrolls", "start_date");
    }
  },
};
