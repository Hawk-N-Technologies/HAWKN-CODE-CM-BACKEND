"use strict";

/**
 * project_deliveries — Delivery & Handover.
 *
 * Flow:  Tester submits  →  Admin approves (→ client) or sends back with a note
 *        →  Client accepts (project becomes Completed) or asks for a follow-up
 *           (a "Change Request" ticket in issue_reports).
 *
 * A delivery holds the live link, how-to document links and the list of
 * deliverables. The codebase / repository is never part of a delivery.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_deliveries");

    if (exists) {
      console.log("project_deliveries table already exists. Skipping.");
      return;
    }

    await queryInterface.createTable("project_deliveries", {
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
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "companies", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "projects", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      version_label: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      live_url: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      // ["Admin panel", "User guide", ...]
      deliverables: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: Sequelize.literal("'[]'::jsonb"),
      },
      // [{ "title": "How to add a user", "url": "https://..." }, ...]
      docs: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: Sequelize.literal("'[]'::jsonb"),
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Pending Admin Approval",
      },
      submitted_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      submitted_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      admin_note: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      client_responded_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },
      follow_up_issue_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "issue_reports", field: "id" },
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

    await queryInterface.addIndex("project_deliveries", ["company_id", "project_id"], {
      name: "idx_project_deliveries_company_project",
    });

    await queryInterface.addIndex("project_deliveries", ["company_id", "status"], {
      name: "idx_project_deliveries_company_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_deliveries");
  },
};
