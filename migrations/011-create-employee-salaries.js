"use strict";

/**
 * Salary structure: the fixed monthly salary of each employee.
 * One row per employee (UNIQUE employee_id). Payroll reads this to
 * auto-fill Base Salary; the monthly payroll record itself stays in `payrolls`.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("employee_salaries");

    if (exists) {
      return;
    }

    await queryInterface.createTable("employee_salaries", {
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

      // One salary per employee
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // Monthly salary in ₹ — NUMERIC, never FLOAT (no rounding loss)
      salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
    });

    // Database-level rule — holds even for edits made directly in pgAdmin
    await queryInterface.sequelize.query(`
      ALTER TABLE "employee_salaries"
        ADD CONSTRAINT "chk_employee_salaries_salary_positive"
          CHECK ("salary" > 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_salaries");
  },
};
