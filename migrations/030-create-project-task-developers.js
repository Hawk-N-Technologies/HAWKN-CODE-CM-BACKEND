"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_task_developers");

    if (exists) {
      console.log("project_task_developers table already exists");
      return;
    }

    await queryInterface.createTable("project_task_developers", {
      task_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          table: "project_tasks",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      employee_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
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

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_task_developers");
  },
};
