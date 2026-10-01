"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employees", {
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

      phone1: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      company_email: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      phone2: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      whatsapp: {
        type: Sequelize.STRING(30),
        allowNull: true,
      },

      joining_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      date_of_birth: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      linkedin_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      github_url: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      aadhaar_last4: {
        type: Sequelize.STRING(4),
        allowNull: true,
      },

      employment_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Full Time",
      },

      employment_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Active",
      },

      photo_url: {
        type: Sequelize.TEXT,
        allowNull: true,
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
    await queryInterface.dropTable("employees");
  },
};
