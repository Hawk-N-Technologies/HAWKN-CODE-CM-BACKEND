"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists(
      "company_roles_responsibilities",
    );

    if (exists) {
      console.log(
        "company_roles_responsibilities table already exists. Skipping migration.",
      );
      return;
    }

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

      admin: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      hr: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      tester: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      bde: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      client: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      developer: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      project_lead: {
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

    console.log("company_roles_responsibilities table created successfully.");
  },

  async down(queryInterface) {
    const exists = await queryInterface.tableExists(
      "company_roles_responsibilities",
    );

    if (!exists) {
      console.log(
        "company_roles_responsibilities table does not exist. Skipping rollback.",
      );
      return;
    }

    await queryInterface.dropTable("company_roles_responsibilities");

    console.log("company_roles_responsibilities table dropped successfully.");
  },
};
