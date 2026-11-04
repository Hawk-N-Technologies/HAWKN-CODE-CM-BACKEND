"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.tableExists("projects");

    if (!tableExists) {
      throw new Error("Projects table does not exist");
    }

    // Add new project fields
    await queryInterface.addColumn("projects", "project_type", {
      type: Sequelize.STRING(100),
      allowNull: true,
    });

    await queryInterface.addColumn("projects", "github_repos", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

    await queryInterface.addColumn("projects", "server_url", {
      type: Sequelize.TEXT,
      allowNull: true,
    });

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

    // Remove newly added columns
    await queryInterface.removeColumn("projects", "server_url");
    await queryInterface.removeColumn("projects", "github_repos");
    await queryInterface.removeColumn("projects", "project_type");
  },
};
