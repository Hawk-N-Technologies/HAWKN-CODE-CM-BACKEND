"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists(
      "developer_task_testing",
    );

    if (exists) {
      console.log("developer_task_testing table already exists");
      return;
    }

    await queryInterface.createTable("developer_task_testing", {
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
      developer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      result: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },
      notes: {
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

    await queryInterface.addConstraint("developer_task_testing", {
      fields: ["task_id", "developer_id"],
      type: "unique",
      name: "uq_developer_task_testing_task_developer",
    });

    await queryInterface.addConstraint("developer_task_testing", {
      fields: ["result"],
      type: "check",
      where: {
        result: ["Pending", "Passed", "Failed"],
      },
      name: "chk_developer_task_testing_result",
    });

    await queryInterface.addIndex(
      "developer_task_testing",
      ["developer_id"],
      { name: "idx_developer_task_testing_developer" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("developer_task_testing");
  },
};