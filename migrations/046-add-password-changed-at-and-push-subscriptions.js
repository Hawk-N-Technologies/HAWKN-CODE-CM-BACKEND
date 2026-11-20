"use strict";

/**
 * 1) users.password_changed_at
 *    When HR/Admin changes a password (or deactivates the user), logins made
 *    before that moment stop working — an emergency reset really locks the
 *    old session out.
 *
 * 2) push_subscriptions
 *    One row per browser/device that turned on phone/laptop alerts.
 *    Only the browser's push address and its public keys are stored.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const users = await queryInterface.describeTable("users");

    if (!users.password_changed_at) {
      await queryInterface.addColumn("users", "password_changed_at", {
        type: Sequelize.DATE,
        allowNull: true,
      });
    }

    const exists = await queryInterface.tableExists("push_subscriptions");

    if (exists) {
      console.log("push_subscriptions table already exists. Skipping.");
      return;
    }

    await queryInterface.createTable("push_subscriptions", {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "companies", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "users", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      endpoint: {
        type: Sequelize.TEXT,
        allowNull: false,
        unique: true,
      },
      p256dh: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      auth: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      user_agent: {
        type: Sequelize.STRING(500),
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

    await queryInterface.addIndex("push_subscriptions", ["user_id"], {
      name: "idx_push_subscriptions_user",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("push_subscriptions");

    const users = await queryInterface.describeTable("users");

    if (users.password_changed_at) {
      await queryInterface.removeColumn("users", "password_changed_at");
    }
  },
};
