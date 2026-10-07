"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exist = await queryInterface.tableExists("clients");

    if (exist) {
      console.log("clients table already exists");
      return;
    }

    await queryInterface.createTable("clients", {
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

      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        unique: true,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "companies",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      phone: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE "clients"
        ADD CONSTRAINT "uq_clients_company_user"
          UNIQUE ("company_id", "user_id");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("clients");
  },
};
