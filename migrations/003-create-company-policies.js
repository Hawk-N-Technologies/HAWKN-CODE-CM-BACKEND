// migrations/003-create-company-policies.js

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("company_policies", {
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
        unique: true,

        references: {
          table: "companies",
          key: "id",
        },

        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      content: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("company_policies");
  },
};
