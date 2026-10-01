"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const isMysql = queryInterface.sequelize.dialect.name === "mysql";
    const uuidDefault = isMysql
      ? Sequelize.literal("(UUID())")
      : Sequelize.literal("gen_random_uuid()");

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
        defaultValue: uuidDefault,
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
    await queryInterface.dropTable("company_profiles");
  },
};
