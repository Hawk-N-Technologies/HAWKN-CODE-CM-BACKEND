"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exist = await queryInterface.tableExists("task_testing");

    if (exist) {
      console.log("task_testing table already exists");
      return;
    }

    await queryInterface.createTable("task_testing", {
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

      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "projects", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "project_tasks", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      tester_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "employees", field: "id" },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      // 'Pending' | 'In Progress' | 'Passed' | 'Failed'
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },

      test_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      tested_at: {
        type: Sequelize.DATE,
        allowNull: true,
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

    // Database-level status validation
    await queryInterface.sequelize.query(`
      ALTER TABLE "task_testing"
        ADD CONSTRAINT "chk_task_testing_status"
        CHECK ("status" IN ('Pending', 'In Progress', 'Passed', 'Failed'));
    `);

    // Indexes
    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_task_testing_task"
        ON "task_testing" ("task_id");
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_task_testing_tester_status"
        ON "task_testing" ("tester_id", "status");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("task_testing");
  },
};
