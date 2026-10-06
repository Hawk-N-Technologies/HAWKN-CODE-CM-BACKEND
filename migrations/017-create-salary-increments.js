"use strict";

/**
 * Salary increment history. Each row = one raise for one employee:
 * previous → new salary. Creating one also updates employee_salaries.
 * Rows are permanent history (only the latest can be reverted).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const exist = await queryInterface.tableExists(
      "salary_increments",
    );
    if (exist) {
      console.log("salary_increments table already exist");
      return;
    }
    await queryInterface.createTable("salary_increments", {
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

      // Salary belongs to the employee record (same as employee_salaries)
      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "employees", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      previous_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      new_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      effective_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // Audit: which HR user gave the increment
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
      ALTER TABLE "salary_increments"
        ADD CONSTRAINT "chk_salary_increments_previous_positive"
          CHECK ("previous_salary" > 0),
        ADD CONSTRAINT "chk_salary_increments_is_increase"
          CHECK ("new_salary" > "previous_salary");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_salary_increments_employee" ON "salary_increments" ("employee_id");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("salary_increments");
  },
};
