"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("brd_reviews");

    if (exists) {
      console.log("brd_reviews table already exists");
      return;
    }

    await queryInterface.createTable("brd_reviews", {
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

      brd_version_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "brd_versions",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      reviewer_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "users",
          field: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      reviewer_role: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      action: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      reviewed_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "brd_reviews"
        ADD CONSTRAINT "chk_brd_reviews_role"
          CHECK ("reviewer_role" IN ('admin', 'client')),

        ADD CONSTRAINT "chk_brd_reviews_action"
          CHECK ("action" IN ('APPROVED', 'REJECTED'));
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("brd_reviews");
  },
};
