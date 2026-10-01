"use strict";

/**
 * Payroll ledger: one row per employee (user) per month.
 * Money is DECIMAL(12,2) — never FLOAT.
 *
 * One payroll row per:
 * company + user + pay period
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const isMysql = queryInterface.sequelize.dialect.name === "mysql";

    const uuidDefault = isMysql
      ? Sequelize.literal("(UUID())")
      : Sequelize.literal("gen_random_uuid()");

    await queryInterface.createTable("payrolls", {
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

      // Employee being paid
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,

        references: {
          table: "users",
          field: "id",
        },

        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      // Always the 1st of the month
      pay_period: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      base_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      lop_deduction: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      bonus: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
        defaultValue: 0,
      },

      // Calculated by server:
      // base_salary - lop_deduction + bonus
      net_salary: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: false,
      },

      payment_method: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Bank Transfer",
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },

      processed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Audit trail
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,

        references: {
          table: "users",
          field: "id",
        },

        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      processed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,

        references: {
          table: "users",
          field: "id",
        },

        onDelete: "SET NULL",
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

    // One payroll per employee per month
    await queryInterface.addConstraint("payrolls", {
      fields: ["company_id", "user_id", "pay_period"],
      type: "unique",
      name: "uq_payrolls_company_user_period",
    });

    // Amounts cannot be negative
    await queryInterface.addConstraint("payrolls", {
      fields: ["base_salary"],
      type: "check",
      where: {
        base_salary: {
          [Sequelize.Op.gte]: 0,
        },
      },
      name: "chk_payrolls_base_salary_non_negative",
    });

    await queryInterface.addConstraint("payrolls", {
      fields: ["lop_deduction"],
      type: "check",
      where: {
        lop_deduction: {
          [Sequelize.Op.gte]: 0,
        },
      },
      name: "chk_payrolls_lop_non_negative",
    });

    await queryInterface.addConstraint("payrolls", {
      fields: ["bonus"],
      type: "check",
      where: {
        bonus: {
          [Sequelize.Op.gte]: 0,
        },
      },
      name: "chk_payrolls_bonus_non_negative",
    });

    // LOP cannot exceed base salary
    await queryInterface.addConstraint("payrolls", {
      fields: ["lop_deduction", "base_salary"],
      type: "check",
      where: Sequelize.literal("`lop_deduction` <= `base_salary`"),
      name: "chk_payrolls_lop_within_base",
    });

    // Net salary formula
    await queryInterface.addConstraint("payrolls", {
      fields: ["net_salary", "base_salary", "lop_deduction", "bonus"],
      type: "check",
      where: Sequelize.literal(
        "`net_salary` = `base_salary` - `lop_deduction` + `bonus`",
      ),
      name: "chk_payrolls_net_formula",
    });

    // Payment method
    await queryInterface.addConstraint("payrolls", {
      fields: ["payment_method"],
      type: "check",
      where: {
        payment_method: ["Bank Transfer", "UPI", "Cheque", "Cash"],
      },
      name: "chk_payrolls_payment_method",
    });

    // Status
    await queryInterface.addConstraint("payrolls", {
      fields: ["status"],
      type: "check",
      where: {
        status: ["Pending", "Processed"],
      },
      name: "chk_payrolls_status",
    });

    // Processed consistency
    await queryInterface.addConstraint("payrolls", {
      fields: ["status", "processed_at"],
      type: "check",
      where: Sequelize.literal(
        "(`status` = 'Pending' AND `processed_at` IS NULL) OR " +
          "(`status` = 'Processed' AND `processed_at` IS NOT NULL)",
      ),
      name: "chk_payrolls_processed_consistency",
    });

    // Fast company/date filtering
    await queryInterface.addIndex("payrolls", {
      fields: ["company_id", "pay_period"],
      name: "idx_payrolls_company_period",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("payrolls");
  },
};
