"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn("clients", "type", {
      type: Sequelize.ENUM("lead", "converted"),
      allowNull: false,
      defaultValue: "lead",
    });

    await queryInterface.addColumn("clients", "gst", {
      type: Sequelize.STRING(20),
      allowNull: true,
    });

    await queryInterface.addColumn("clients", "domain", {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn("clients", "domain");
    await queryInterface.removeColumn("clients", "gst");
    await queryInterface.removeColumn("clients", "type");

    // PostgreSQL: remove the ENUM type created by Sequelize
    await queryInterface.sequelize.query(
      'DROP TYPE IF EXISTS "enum_clients_type";',
    );
  },
};
