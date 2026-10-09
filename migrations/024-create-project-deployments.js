"use strict";

/**
 * Deployment plan per project (Admin → Deployment Planning).
 * ONE row per project. Stores only STATUS for credentials ("Added" /
 * "Not Added") — never the credentials themselves.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("project_deployments");

    if (exists) {
      console.log("project_deployments table already exists");
      return;
    }

    await queryInterface.createTable("project_deployments", {
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

      // One plan per project
      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: { table: "projects", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      repository_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      server_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Not Configured",
      },

      cicd_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Not Active",
      },

      // Status only — real credentials must never be stored here
      credentials_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Not Added",
      },

      dev_domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      staging_domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      live_domain: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },

      // Link to deployment / CI-CD docs (no file storage in the app yet)
      documentation_url: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },

      // Audit: which admin last saved it
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
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
      ALTER TABLE "project_deployments"
        ADD CONSTRAINT "chk_project_deployments_server_status"
          CHECK ("server_status" IN ('Not Configured', 'Configured')),
        ADD CONSTRAINT "chk_project_deployments_cicd_status"
          CHECK ("cicd_status" IN ('Not Active', 'Active')),
        ADD CONSTRAINT "chk_project_deployments_credentials_status"
          CHECK ("credentials_status" IN ('Not Added', 'Added'));
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("project_deployments");
  },
};