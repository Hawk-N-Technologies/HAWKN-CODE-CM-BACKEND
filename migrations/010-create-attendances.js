"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable("attendances", {
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

      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "employees",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "companies",
          key: "id",
        },
        onDelete: "CASCADE",
      },

      attendance_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      session: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      check_in: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Present",
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

    await queryInterface.addConstraint("attendances", {
      fields: ["session"],
      type: "check",
      name: "chk_attendance_session",
      where: {
        session: ["FIRST_HALF", "SECOND_HALF"],
      },
    });

    await queryInterface.addConstraint("attendances", {
      fields: ["status"],
      type: "check",
      name: "chk_attendance_status",
      where: {
        status: ["Present", "Absent"],
      },
    });

    await queryInterface.addConstraint("attendances", {
      fields: ["employee_id", "attendance_date", "session"],
      type: "unique",
      name: "uq_employee_attendance_session",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("attendances");
  },
};
