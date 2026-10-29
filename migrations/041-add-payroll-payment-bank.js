"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const columns = await queryInterface.describeTable("payrolls");

    if (!columns.payment_bank) {
      await queryInterface.addColumn("payrolls", "payment_bank", {
        type: Sequelize.STRING(30),
        allowNull: true,
      });
    }
  },

  async down(queryInterface) {
    const columns = await queryInterface.describeTable("payrolls");

    if (columns.payment_bank) {
      await queryInterface.removeColumn("payrolls", "payment_bank");
    }
  },
};
