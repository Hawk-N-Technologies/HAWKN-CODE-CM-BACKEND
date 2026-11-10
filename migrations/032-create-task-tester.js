





"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("task_testing");

    if (exists) {
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
        references: {
          table: "projects",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      task_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "project_tasks",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      test_task_tester_id: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: {
          table: "test_task_testers",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      attempt_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

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

    await queryInterface.sequelize.query(`
      ALTER TABLE "task_testing"
        ADD CONSTRAINT "chk_task_testing_attempt_number"
        CHECK ("attempt_number" > 0);

      ALTER TABLE "task_testing"
        ADD CONSTRAINT "chk_task_testing_status"
        CHECK ("status" IN (
          'Pending',
          'In Progress',
          'Passed',
          'Failed'
        ));

      ALTER TABLE "task_testing"
        ADD CONSTRAINT "uq_task_testing_attempt"
        UNIQUE ("test_task_tester_id", "attempt_number");
    `);

    await queryInterface.addIndex(
      "task_testing",
      ["test_task_tester_id", "status"],
      { name: "idx_task_testing_assignment_status" },
    );

    await queryInterface.addIndex("task_testing", ["task_id"], {
      name: "idx_task_testing_task",
    });

    await queryInterface.addIndex("task_testing", ["project_id"], {
      name: "idx_task_testing_project",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("task_testing");
  },
};
