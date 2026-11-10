"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_bugs");

    if (exists) {
      console.log("project_bugs table already exists");
      return;
    }

    await queryInterface.createTable("project_bugs", {
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

      issue_report_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        unique: true,
        references: {
          table: "issue_reports",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
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

      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      severity: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Medium",
      },

      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Open",
      },

      discovery_source: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Client",
      },

      assigned_to: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      fixed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      fix_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      fixed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      verified_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      verified_at: {
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

    // Severity CHECK constraint
    await queryInterface.addConstraint("project_bugs", {
      fields: ["severity"],
      type: "check",
      where: {
        severity: ["Low", "Medium", "High", "Critical"],
      },
      name: "chk_project_bugs_severity",
    });

    // Status CHECK constraint
    await queryInterface.addConstraint("project_bugs", {
      fields: ["status"],
      type: "check",
      where: {
        status: [
          "Open",
          "Assigned",
          "In Progress",
          "Fixed",
          "Ready for Retest",
          "Reopened",
          "Closed",
          "Rejected",
        ],
      },
      name: "chk_project_bugs_status",
    });

    // Discovery source CHECK constraint
    await queryInterface.addConstraint("project_bugs", {
      fields: ["discovery_source"],
      type: "check",
      where: {
        discovery_source: [
          "Client",
          "Testing",
          "Development",
          "Code Review",
          "Production",
          "Retesting",
        ],
      },
      name: "chk_project_bugs_discovery_source",
    });

    // Project index
    await queryInterface.addIndex("project_bugs", ["project_id"], {
      name: "idx_project_bugs_project",
    });

    // Module index
    await queryInterface.addIndex("project_bugs", ["module_id"], {
      name: "idx_project_bugs_module",
    });

    // Status index
    await queryInterface.addIndex("project_bugs", ["status"], {
      name: "idx_project_bugs_status",
    });

    // Assigned employee index
    await queryInterface.addIndex("project_bugs", ["assigned_to"], {
      name: "idx_project_bugs_assigned_to",
    });

    // Issue report index
    await queryInterface.addIndex("project_bugs", ["issue_report_id"], {
      name: "idx_project_bugs_issue_report",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_bugs");
  },
};
