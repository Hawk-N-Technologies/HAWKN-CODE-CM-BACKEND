"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("brds");

    if (exists) {
      console.log("brds table already exists");
      return;
    }

    await queryInterface.createTable("brds", {
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

      project_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "projects",
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

      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "clients",
          field: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      title: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      status: {
        type: Sequelize.STRING(40),
        allowNull: false,
        defaultValue: "DRAFT",
      },

      created_by: {
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

      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },
    });

    await queryInterface.sequelize.query(`
      ALTER TABLE "brds"
        ADD CONSTRAINT "chk_brds_status"
        CHECK (
          "status" IN (
            'DRAFT',
            'PENDING_ADMIN_APPROVAL',
            'ADMIN_REJECTED',
            'PENDING_CLIENT_APPROVAL',
            'CLIENT_REJECTED',
            'APPROVED'
          )
        );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("brds");
  },
};
