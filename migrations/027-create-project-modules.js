"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_modules");

    if (exists) {
      console.log("project_modules table already exists");
      return;
    }

    await queryInterface.createTable("project_modules", {
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

      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      priority: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Medium",
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Not Started",
      },

      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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

    await queryInterface.addConstraint("project_modules", {
      fields: ["priority"],
      type: "check",
      name: "chk_project_modules_priority",
      where: Sequelize.literal(
        `"priority" IN ('Low', 'Medium', 'High', 'Critical')`,
      ),
    });

    await queryInterface.addConstraint("project_modules", {
      fields: ["status"],
      type: "check",
      name: "chk_project_modules_status",
      where: Sequelize.literal(
        `"status" IN ('Not Started', 'In Progress', 'Completed', 'On Hold')`,
      ),
    });

    await queryInterface.addConstraint("project_modules", {
      fields: ["project_id", "name"],
      type: "unique",
      name: "uq_project_modules_project_name",
    });

    await queryInterface.addIndex("project_modules", ["project_id"], {
      name: "idx_project_modules_project",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_modules");
  },
};
