"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("employee_leaves");

    if (exists) {
      console.log("employee_leaves table already exists. Skipping migration.");
      return;
    }

    await queryInterface.createTable("employee_leaves", {
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
      },

      company_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },

      leave_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      leave_type: {
        type: Sequelize.STRING(30),
        allowNull: false,
      },

      leave_session: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "FULL_DAY",
      },

      leave_status: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "PENDING",
      },

      is_paid: {
        type: Sequelize.BOOLEAN,
        allowNull: true,
      },

      reason: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      reviewed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },

      reviewed_at: {
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

    // Employee foreign key
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["employee_id"],
      type: "foreign key",
      name: "fk_employee_leave_employee",
      references: {
        table: "employees",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // Company foreign key
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["company_id"],
      type: "foreign key",
      name: "fk_employee_leave_company",
      references: {
        table: "companies",
        field: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    });

    // HR user who reviewed the leave
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["reviewed_by"],
      type: "foreign key",
      name: "fk_employee_leave_reviewer",
      references: {
        table: "users",
        field: "id",
      },
      onDelete: "SET NULL",
      onUpdate: "CASCADE",
    });

    // Leave status
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["leave_status"],
      type: "check",
      name: "chk_employee_leave_status",
      where: {
        leave_status: ["PENDING", "APPROVED", "REJECTED"],
      },
    });

    // Leave type
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["leave_type"],
      type: "check",
      name: "chk_employee_leave_type",
      where: {
        leave_type: ["CASUAL", "SICK", "ANNUAL", "UNPAID", "OTHER"],
      },
    });

    // Leave session
    await queryInterface.addConstraint("employee_leaves", {
      fields: ["leave_session"],
      type: "check",
      name: "chk_employee_leave_session",
      where: {
        leave_session: ["FULL_DAY", "FIRST_HALF", "SECOND_HALF"],
      },
    });
  },

  async down(queryInterface) {
    const exists = await queryInterface.tableExists("employee_leaves");

    if (!exists) {
      console.log("employee_leaves table does not exist. Skipping rollback.");
      return;
    }

    await queryInterface.dropTable("employee_leaves");
  },
};
