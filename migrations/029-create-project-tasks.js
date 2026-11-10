"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_tasks");

    if (exists) {
      console.log("project_tasks table already exists");
      return;
    }

    await queryInterface.createTable("project_tasks", {
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
        allowNull: true,
        references: {
          table: "project_modules",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      phase_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "project_phases",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      priority: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Medium",
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Backlog",
      },

      is_blocked: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: false,
      },

      blocked_reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      due_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      completed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      estimated_hours: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
      },

      actual_hours: {
        type: Sequelize.DECIMAL(8, 2),
        allowNull: true,
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

    await queryInterface.addConstraint("project_tasks", {
      fields: ["priority"],
      type: "check",
      name: "chk_project_tasks_priority",
      where: {
        priority: ["Low", "Medium", "High", "Critical"],
      },
    });

    await queryInterface.addConstraint("project_tasks", {
      fields: ["status"],
      type: "check",
      name: "chk_project_tasks_status",
      where: {
        status: [
          "Backlog",
          "To Do",
          "In Progress",
          "Code Review",
          "Testing",
          "Done",
        ],
      },
    });

    await queryInterface.addConstraint("project_tasks", {
      fields: ["estimated_hours", "actual_hours"],
      type: "check",
      name: "chk_project_tasks_hours",
      where: Sequelize.literal(
        "(estimated_hours IS NULL OR estimated_hours >= 0) AND " +
          "(actual_hours IS NULL OR actual_hours >= 0)",
      ),
    });

    await queryInterface.addConstraint("project_tasks", {
      fields: ["start_date", "due_date"],
      type: "check",
      name: "chk_project_tasks_dates",
      where: Sequelize.literal(
        "start_date IS NULL OR due_date IS NULL OR due_date >= start_date",
      ),
    });

    await queryInterface.addIndex("project_tasks", ["project_id", "status"], {
      name: "idx_tasks_project_status",
    });

    await queryInterface.addIndex("project_tasks", ["assigned_to", "status"], {
      name: "idx_tasks_assignee_status",
    });

    await queryInterface.addIndex("project_tasks", ["module_id"], {
      name: "idx_tasks_module",
    });

    await queryInterface.addIndex("project_tasks", ["phase_id"], {
      name: "idx_tasks_phase",
    });

    await queryInterface.addIndex("project_tasks", ["project_id", "due_date"], {
      name: "idx_tasks_project_due_date",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_tasks");
  },
};
