"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("company_profiles");

    if (exists) {
      console.log("company_profiles table already exists. Skipping migration.");
      return;
    }

    await queryInterface.createTable("company_profiles", {
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
      },

      official_company_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      official_email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      vision: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      mission: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      blog_content: {
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

    await queryInterface.addConstraint("company_profiles", {
      fields: ["company_id"],
      type: "foreign key",
      name: "fk_company_profiles_company",
      references: {
        table: "companies",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });
  },

  async down(queryInterface) {
    const exists = await queryInterface.tableExists("company_profiles");

    if (!exists) {
      console.log("company_profiles table does not exist. Skipping rollback.");
      return;
    }

    await queryInterface.dropTable("company_profiles");
  },
};
