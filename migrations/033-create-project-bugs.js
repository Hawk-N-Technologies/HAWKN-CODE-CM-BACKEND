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

      reported_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
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

      fixed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "employees",
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
          table: "employees",
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

    // Add CHECK constraints to match the PostgreSQL schema.

    await queryInterface.sequelize.query(`
      ALTER TABLE project_bugs
      ADD CONSTRAINT chk_project_bugs_severity
      CHECK (severity IN ('Low', 'Medium', 'High', 'Critical'));
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE project_bugs
      ADD CONSTRAINT chk_project_bugs_status
      CHECK (status IN (
        'Open',
        'Assigned',
        'In Progress',
        'Fixed',
        'Ready for Retest',
        'Reopened',
        'Closed',
        'Rejected'
      ));
    `);

    await queryInterface.sequelize.query(`
      ALTER TABLE project_bugs
      ADD CONSTRAINT chk_project_bugs_discovery_source
      CHECK (discovery_source IN (
        'Client',
        'Testing',
        'Development',
        'Code Review',
        'Production',
        'Retesting'
      ));
    `);

    // Indexes

    await queryInterface.addIndex("project_bugs", ["project_id"], {
      name: "idx_project_bugs_project",
    });

    await queryInterface.addIndex("project_bugs", ["module_id"], {
      name: "idx_project_bugs_module",
    });

    await queryInterface.addIndex("project_bugs", ["status"], {
      name: "idx_project_bugs_status",
    });

    await queryInterface.addIndex("project_bugs", ["assigned_to"], {
      name: "idx_project_bugs_assigned_to",
    });

    await queryInterface.addIndex("project_bugs", ["reported_by"], {
      name: "idx_project_bugs_reported_by",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_bugs");
  },
};
