"use strict";

/**
 * Salary structure: the fixed monthly salary of each employee.
 * One row per employee (UNIQUE employee_id).
 * Payroll reads this to auto-fill Base Salary.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const isMysql = queryInterface.sequelize.dialect.name === "mysql";

    const uuidDefault = isMysql
      ? Sequelize.literal("(UUID())")
      : Sequelize.literal("gen_random_uuid()");

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
        defaultValue: uuidDefault,
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

      // Monthly salary in ₹
      salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },
    });

    // Salary must be greater than zero
    await queryInterface.sequelize.query(`
      ALTER TABLE employee_salaries
        ADD CONSTRAINT chk_employee_salaries_salary_positive
          CHECK (salary > 0);
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_salaries");
  },
};
