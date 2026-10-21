"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("issue_reports");

    if (exists) {
      console.log("issue_reports table already exists");
      return;
    }

    await queryInterface.createTable("issue_reports", {
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
        defaultValue: "Submitted",
      },

      classification: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },

      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      review_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      reviewed_at: {
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
    await queryInterface.addConstraint("issue_reports", {
      fields: ["severity"],
      type: "check",
      where: {
        severity: ["Low", "Medium", "High", "Critical"],
      },
      name: "chk_issue_reports_severity",
    });

    // Status CHECK constraint
    await queryInterface.addConstraint("issue_reports", {
      fields: ["status"],
      type: "check",
      where: {
        status: [
          "Submitted",
          "Under Review",
          "Confirmed",
          "Feature Request",
          "Rejected",
        ],
      },
      name: "chk_issue_reports_status",
    });

    // Classification CHECK constraint
    await queryInterface.addConstraint("issue_reports", {
      fields: ["classification"],
      type: "check",
      where: {
        classification: ["Bug", "Feature Request"],
      },
      name: "chk_issue_reports_classification",
    });

    // Project index
    await queryInterface.addIndex("issue_reports", ["project_id"], {
      name: "idx_issue_reports_project",
    });

    // Status index
    await queryInterface.addIndex("issue_reports", ["status"], {
      name: "idx_issue_reports_status",
    });

    // Reporter index
    await queryInterface.addIndex("issue_reports", ["reported_by"], {
      name: "idx_issue_reports_reported_by",
    });

    // Reviewer index
    await queryInterface.addIndex("issue_reports", ["reviewed_by"], {
      name: "idx_issue_reports_reviewer",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("issue_reports");
  },
};
