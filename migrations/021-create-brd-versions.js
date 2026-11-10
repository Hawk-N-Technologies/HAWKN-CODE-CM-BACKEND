"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("brd_versions");

    if (exists) {
      console.log("brd_versions table already exists");
      return;
    }

    await queryInterface.createTable("brd_versions", {
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

      brd_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "brds",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      version: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      file_name: {
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
        allowNull: true,
      },

      file_size: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },

      uploaded_by: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "brd_versions"
        ADD CONSTRAINT "uq_brd_version"
        UNIQUE ("brd_id", "version");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("brd_versions");
  },
};
