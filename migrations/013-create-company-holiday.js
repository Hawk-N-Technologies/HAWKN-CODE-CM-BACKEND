"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("company_holidays");

    if (exists) {
      console.log("company_holidays table already exists. Skipping migration.");
      return;
    }

    await queryInterface.createTable("company_holidays", {
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
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      holiday_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      is_paid: {
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

    // Prevent duplicate holidays for the same company/date
    await queryInterface.addConstraint("company_holidays", {
      fields: ["company_id", "holiday_date"],
      type: "unique",
      name: "uq_company_holiday",
    });
  },

  async down(queryInterface) {
    const exists = await queryInterface.tableExists("company_holidays");

    if (!exists) {
      console.log("company_holidays table does not exist. Skipping rollback.");
      return;
    }

    await queryInterface.dropTable("company_holidays");
  },
};
