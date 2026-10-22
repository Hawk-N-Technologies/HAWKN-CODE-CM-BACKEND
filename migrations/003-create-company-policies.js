"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("company_policies");

    if (exists) {
      console.log("company_policies table already exists. Skipping migration.");
      return;
    }

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

      leave_policy: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      attendance_policy: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      code_of_conduct: {
        type: Sequelize.TEXT,
        allowNull: false,
        defaultValue: "",
      },

      data_security_policy: {
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

    console.log("company_policies table created successfully.");
  },

  async down(queryInterface) {
    const exists = await queryInterface.tableExists("company_policies");

    if (!exists) {
      console.log("company_policies table does not exist. Skipping rollback.");
      return;
    }

    await queryInterface.dropTable("company_policies");
    console.log("company_policies table dropped successfully.");
  },
};
