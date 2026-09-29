"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("users", {
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

        references: {
          table: "companies",
          field: "id",
        },

        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,

        references: {
          table: "roles",
          field: "id",
        },

        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      password_hash: {
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

    // Add the composite unique constraint only once.
    await queryInterface.sequelize.query(`
      ALTER TABLE "users"
      ADD CONSTRAINT "uq_users_company_email"
      UNIQUE ("company_id", "email");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
  },
};
