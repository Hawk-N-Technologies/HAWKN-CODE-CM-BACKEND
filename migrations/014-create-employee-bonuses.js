"use strict";

/**
 * One-time bonuses. Each bonus belongs to a pay month; when payroll is
 * created for that employee + month, the Bonus field auto-fills with the
 * month's total. Money is NUMERIC(12,2), never FLOAT.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employee_bonuses", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },

      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "companies", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // The employee receiving the bonus (financial history → RESTRICT)
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "users", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      // Month it's paid in — always the 1st, e.g. 2026-10-01 = October 2026
      pay_period: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      bonus_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      amount: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Audit: which HR user added it
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "employee_bonuses"
        ADD CONSTRAINT "chk_employee_bonuses_amount_positive"
          CHECK ("amount" > 0),
        ADD CONSTRAINT "chk_employee_bonuses_period_first_of_month"
          CHECK (EXTRACT(DAY FROM "pay_period") = 1),
        ADD CONSTRAINT "chk_employee_bonuses_type"
          CHECK ("bonus_type" IN ('Performance', 'Festival', 'Referral', 'Joining', 'Other'));
    `);

    // Fast "total bonus for this employee + month" lookups
    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_employee_bonuses_user_period"
        ON "employee_bonuses" ("company_id", "user_id", "pay_period");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_bonuses");
  },
};