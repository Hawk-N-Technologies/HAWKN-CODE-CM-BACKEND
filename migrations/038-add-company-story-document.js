"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("company_profiles");

    if (!columns.company_story_document_path) {
      await queryInterface.addColumn(
        "company_profiles",
        "company_story_document_path",
        { type: Sequelize.STRING(500), allowNull: true },
      );
    }

    if (!columns.company_story_document_name) {
      await queryInterface.addColumn(
        "company_profiles",
        "company_story_document_name",
        { type: Sequelize.STRING(255), allowNull: true },
      );
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("company_profiles");

    if (columns.company_story_document_name) {
      await queryInterface.removeColumn(
        "company_profiles",
        "company_story_document_name",
      );
    }

    if (columns.company_story_document_path) {
      await queryInterface.removeColumn(
        "company_profiles",
        "company_story_document_path",
      );
    }
  },
};