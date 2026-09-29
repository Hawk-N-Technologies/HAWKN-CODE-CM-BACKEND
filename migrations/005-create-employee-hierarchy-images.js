// migrations/005-create-employee-hierarchy-images.js

"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("employee_hierarchy_images", {
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
          key: "id",
        },

        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      original_file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      file_url: {
        type: Sequelize.TEXT,
        allowNull: false,
      },

      storage_key: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      sort_order: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
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
  },

  async down(queryInterface) {
    await queryInterface.dropTable("employee_hierarchy_images");
  },
};
