"use strict";

/**
 * Payroll ledger: one row per employee (user) per month.
 * Money is NUMERIC(12,2) — never FLOAT, which loses paise in rounding.
 * Rows are financial history, so deleting a user is BLOCKED (RESTRICT)
 * instead of silently wiping their payroll.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("payrolls", {
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

      // The employee being paid
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "users", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      // Always the 1st of the month, e.g. 2026-09-01 = September 2026
      pay_period: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      base_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      lop_deduction: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      bonus: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // Calculated by the server (base - LOP + bonus), never taken from the client
      net_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      payment_method: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Bank Transfer",
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },

      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Audit trail: who created / processed it
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      processed_by: {
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

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    // Database-level rules — hold even if someone edits rows directly in pgAdmin
    await queryInterface.sequelize.query(`
      ALTER TABLE "payrolls"
        ADD CONSTRAINT "uq_payrolls_company_user_period"
          UNIQUE ("company_id", "user_id", "pay_period"),
        ADD CONSTRAINT "chk_payrolls_period_first_of_month"
          CHECK (EXTRACT(DAY FROM "pay_period") = 1),
        ADD CONSTRAINT "chk_payrolls_amounts_non_negative"
          CHECK ("base_salary" >= 0 AND "lop_deduction" >= 0 AND "bonus" >= 0),
        ADD CONSTRAINT "chk_payrolls_lop_within_base"
          CHECK ("lop_deduction" <= "base_salary"),
        ADD CONSTRAINT "chk_payrolls_net_formula"
          CHECK ("net_salary" = "base_salary" - "lop_deduction" + "bonus"),
        ADD CONSTRAINT "chk_payrolls_payment_method"
          CHECK ("payment_method" IN ('Bank Transfer', 'UPI', 'Cheque', 'Cash')),
        ADD CONSTRAINT "chk_payrolls_status"
          CHECK ("status" IN ('Pending', 'Processed')),
        ADD CONSTRAINT "chk_payrolls_processed_consistency"
          CHECK (("status" = 'Processed') = ("processed_at" IS NOT NULL));
    `);

    // Fast date-range filtering per company
    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_payrolls_company_period" ON "payrolls" ("company_id", "pay_period");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("payrolls");
  },
};