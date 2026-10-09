"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("project_operations", {
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

      // One operations plan per project
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          table: "projects",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "companies",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      project_lead_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      tester_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      technology_stack: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      er_diagram_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "NOT_UPLOADED",
      },

      flowchart_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "NOT_UPLOADED",
      },

      planning_status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "NOT_STARTED",
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

      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
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

    await queryInterface.sequelize.query(`
      ALTER TABLE project_operations
      ADD CONSTRAINT chk_project_operations_er_diagram_status
      CHECK (er_diagram_status IN ('UPLOADED', 'NOT_UPLOADED'));

      ALTER TABLE project_operations
      ADD CONSTRAINT chk_project_operations_flowchart_status
      CHECK (flowchart_status IN ('UPLOADED', 'NOT_UPLOADED'));

      ALTER TABLE project_operations
      ADD CONSTRAINT chk_project_operations_planning_status
      CHECK (planning_status IN ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'));
    `);

    // Multiple developers can be assigned to one operations plan.
    await queryInterface.createTable("project_operation_developers", {
      project_operation_id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        allowNull: false,
        references: {
          table: "project_operations",
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
    await queryInterface.dropTable("project_operation_developers");
    await queryInterface.dropTable("project_operations");
  },
};
