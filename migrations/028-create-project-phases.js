"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_phases");

    if (exists) {
      console.log("project_phases table already exists");
      return;
    }

    await queryInterface.createTable("project_phases", {
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

      module_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "project_modules",
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

      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
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

    await queryInterface.addConstraint("project_phases", {
      fields: ["status"],
      type: "check",
      name: "chk_project_phases_status",
      where: Sequelize.literal(
        `"status" IN ('Not Started', 'In Progress', 'Completed', 'On Hold')`,
      ),
    });

    await queryInterface.addConstraint("project_phases", {
      fields: ["start_date", "end_date"],
      type: "check",
      name: "chk_project_phases_dates",
      where: Sequelize.literal(
        '"start_date" IS NULL OR "end_date" IS NULL OR "end_date" >= "start_date"',
      ),
    });

    await queryInterface.addConstraint("project_phases", {
      fields: ["module_id", "name"],
      type: "unique",
      name: "uq_project_phases_module_name",
    });

    await queryInterface.addIndex("project_phases", ["project_id"], {
      name: "idx_project_phases_project",
    });

    await queryInterface.addIndex("project_phases", ["module_id"], {
      name: "idx_project_phases_module",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_phases");
  },
};
