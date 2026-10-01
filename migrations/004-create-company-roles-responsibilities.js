// migrations/004-create-company-roles-responsibilities.js

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const isMysql = queryInterface.sequelize.dialect.name === "mysql";
    const uuidDefault = isMysql
      ? Sequelize.literal("(UUID())")
      : Sequelize.literal("gen_random_uuid()");

    await queryInterface.createTable("company_roles_responsibilities", {
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
        defaultValue: uuidDefault,
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
    await queryInterface.dropTable("company_roles_responsibilities");
  },
};
