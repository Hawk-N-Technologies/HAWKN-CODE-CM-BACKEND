"use strict";

/**
 * sops — Standard Operating Procedures.
 * Rich text (same editor as Company Policies). Admin & HR write them,
 * every employee reads them.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    if (await queryInterface.tableExists("sops")) {
      console.log("sops table already exists. Skipping.");
      return;
    }

    await queryInterface.createTable("sops", {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      uuid: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        defaultValue: Sequelize.literal("gen_random_uuid()"),
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "companies", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      title: { type: Sequelize.STRING(200), allowNull: false },
      department: { type: Sequelize.STRING(50), allowNull: false, defaultValue: "General" },
      effective_date: { type: Sequelize.DATEONLY, allowNull: true },
      content: { type: Sequelize.TEXT, allowNull: false, defaultValue: "" },
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },
      updated_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
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

    await queryInterface.addIndex("sops", ["company_id", "department"], {
      name: "idx_sops_company_department",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("sops");
  },
};
