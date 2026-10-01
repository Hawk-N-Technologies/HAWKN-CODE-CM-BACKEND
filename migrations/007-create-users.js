"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const isMysql = queryInterface.sequelize.dialect.name === "mysql";
    const uuidDefault = isMysql
      ? Sequelize.literal("(UUID())")
      : Sequelize.literal("gen_random_uuid()");

    await queryInterface.createTable("users", {
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

        references: {
          table: "companies",
          field: "id",
        },

        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      role_id: {
        type: Sequelize.INTEGER,
        allowNull: false,

        references: {
          table: "roles",
          field: "id",
        },

        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      first_name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },

      last_name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },

      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      password_hash: {
        type: Sequelize.TEXT,
        allowNull: true,
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

    // Add the composite unique constraint
    try {
      await queryInterface.addConstraint("users", {
        fields: ["company_id", "email"],
        type: "unique",
        name: "uq_users_company_email",
      });
    } catch (err) {
      if (
        err.original?.code === "ER_DUP_KEYNAME" ||
        err.message?.includes("already exists") ||
        err.message?.includes("Duplicate key name")
      ) {
        // Constraint already exists
      } else {
        throw err;
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("users");
  },
};
