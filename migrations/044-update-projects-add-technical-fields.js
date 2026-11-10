"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("projects");

    if (!tableExists) {
      throw new Error("Projects table does not exist");
    }

    const table = await queryInterface.describeTable("projects");

    // Add project_type if not exists
    if (!table.project_type) {
      await queryInterface.addColumn("projects", "project_type", {
        type: Sequelize.STRING(100),
        allowNull: true,
      });
    } else {
      console.log("project_type column already exists");
    }

    // Add github_repos if not exists
    if (!table.github_repos) {
      await queryInterface.addColumn("projects", "github_repos", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } else {
      console.log("github_repos column already exists");
    }

    // Add server_url if not exists
    if (!table.server_url) {
      await queryInterface.addColumn("projects", "server_url", {
        type: Sequelize.TEXT,
        allowNull: true,
      });
    } else {
      console.log("server_url column already exists");
    }

    // Replace existing status CHECK constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT IF EXISTS "chk_projects_status";

      ALTER TABLE "projects"
      ADD CONSTRAINT "chk_projects_status"
      CHECK (
        "status" IN (
          'Planning',
          'Phase 1',
          'Phase 2',
          'Phase 3',
          'Brd Approval',
          'In Development',
          'Testing',
          'Completed',
          'On Hold',
          'Cancelled'
        )
      );
    `);
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.tableExists("projects");

    if (!tableExists) {
      return;
    }

    const table = await queryInterface.describeTable("projects");

    // Restore previous status CHECK constraint
    await queryInterface.sequelize.query(`
      ALTER TABLE "projects"
      DROP CONSTRAINT IF EXISTS "chk_projects_status";

      ALTER TABLE "projects"
      ADD CONSTRAINT "chk_projects_status"
      CHECK (
        "status" IN (
          'Planning',
          'In Development',
          'Testing',
          'Completed',
          'On Hold',
          'Cancelled'
        )
      );
    `);

    // Remove columns only if they exist
    if (table.server_url) {
      await queryInterface.removeColumn("projects", "server_url");
    }

    if (table.github_repos) {
      await queryInterface.removeColumn("projects", "github_repos");
    }

    if (table.project_type) {
      await queryInterface.removeColumn("projects", "project_type");
    }
  },
};
