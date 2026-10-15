"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("test_task_testers");

    if (exists) {
      console.log("test_task_testers table already exists");
      return;
    }

    await queryInterface.createTable("test_task_testers", {
      id: {
        type: Sequelize.BIGINT,
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

      tester_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.addConstraint("test_task_testers", {
      fields: ["task_id", "tester_id"],
      type: "unique",
      name: "uq_test_task_testers_task_tester",
    });

    await queryInterface.addIndex("test_task_testers", ["tester_id"], {
      name: "idx_test_task_testers_tester",
    });

    await queryInterface.addIndex("test_task_testers", ["task_id"], {
      name: "idx_test_task_testers_task",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("test_task_testers");
  },
};














