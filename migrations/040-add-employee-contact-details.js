"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("employees");

    const newColumns = {
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      phone1_country_code: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      phone2_country_code: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
      whatsapp_country_code: {
        type: Sequelize.STRING(5),
        allowNull: true,
      },
    };

    for (const [columnName, definition] of Object.entries(newColumns)) {
      if (!columns[columnName]) {
        await queryInterface.addColumn("employees", columnName, definition);
      }
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("employees");

    for (const columnName of [
      "whatsapp_country_code",
      "phone2_country_code",
      "phone1_country_code",
      "country",
      "city",
      "address",
    ]) {
      if (columns[columnName]) {
        await queryInterface.removeColumn("employees", columnName);
      }
    }
  },
};
