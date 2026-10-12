"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("project_operations");

    const additions = {
      er_diagram_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      flowchart_path: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
    };

    for (const [name, definition] of Object.entries(additions)) {
      if (!columns[name]) {
        await queryInterface.addColumn(
          "project_operations",
          name,
          definition,
        );
      }
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("project_operations");

    for (const name of ["er_diagram_path", "flowchart_path"]) {
      if (columns[name]) {
        await queryInterface.removeColumn("project_operations", name);
      }
    }
  },
};