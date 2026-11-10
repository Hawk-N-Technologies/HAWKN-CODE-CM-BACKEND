"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("notifications");

    if (exists) {
      console.log("notifications table already exists. Skipping migration.");
      return;
    }

    await queryInterface.createTable("notifications", {
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
        references: { table: "companies", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      recipient_user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "users", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },
      type: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      title: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      message: {
        type: Sequelize.STRING(1000),
        allowNull: false,
      },
      link: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      event_key: {
        type: Sequelize.STRING(150),
        allowNull: true,
      },
      metadata: {
        type: Sequelize.JSONB,
        allowNull: false,
        defaultValue: {},
      },
      read_at: {
        type: Sequelize.DATE,
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

    await queryInterface.addIndex(
      "notifications",
      ["recipient_user_id", "created_at"],
      { name: "idx_notifications_recipient_created" },
    );

    await queryInterface.addIndex(
      "notifications",
      ["recipient_user_id", "read_at"],
      { name: "idx_notifications_recipient_read" },
    );

    await queryInterface.addIndex(
      "notifications",
      ["company_id", "event_key"],
      { name: "idx_notifications_company_event" },
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable("notifications");
  },
};