"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = await queryInterface.describeTable("clients");

    if (!table.type) {
      await queryInterface.addColumn("clients", "type", {
        type: Sequelize.ENUM("lead", "converted"),
        allowNull: false,
        defaultValue: "lead",
      });
    }

    if (!table.gst) {
      await queryInterface.addColumn("clients", "gst", {
        type: Sequelize.STRING(20),
        allowNull: true,
      });
    }

    if (!table.domain) {
      await queryInterface.addColumn("clients", "domain", {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const table = await queryInterface.describeTable("clients");

    if (table.domain) {
      await queryInterface.removeColumn("clients", "domain");
    }

    if (table.gst) {
      await queryInterface.removeColumn("clients", "gst");
    }

    if (table.type) {
      await queryInterface.removeColumn("clients", "type");
    }

    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_clients_type";',
    );
  },
};