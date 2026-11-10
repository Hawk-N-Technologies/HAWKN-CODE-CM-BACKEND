"use strict";

/**
 * Internship / probation periods. One row = one period for one employee.
 * Starting a period sets employees.employment_type (Intern / Probation);
 * closing it (Confirmed / Converted / Ended / Terminated) updates the
 * employee too. Only ONE active period per employee (partial unique index).
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const exist = await queryInterface.tableExists(
      "internship_probation_periods",
    );
    if (exist) {
      console.log("internship_probation_periods table already exist");
      return;
    }
    await queryInterface.createTable("internship_probation_periods", {
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

      employee_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { table: "employees", field: "id" },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      // 'Internship' | 'Probation'
      period_type: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },

      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      // Current end date (moves when the period is extended)
      end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      // End date as first planned — kept so "extended from" is visible
      original_end_date: {
        type: Sequelize.DATEONLY,
        allowNull: false,
      },

      extension_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      // Monthly stipend — internships only
      stipend: {
        type: Sequelize.DECIMAL(12, 2),
        allowNull: true,
      },

      // 'Pending' | 'Needs Improvement' | 'Good' | 'Excellent'
      performance: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Pending",
      },

      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      // 'Active' | 'Confirmed' | 'Converted' | 'Ended' | 'Terminated'
      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Active",
      },

      closed_at: {
        type: Sequelize.DATE,
        allowNull: true,
      },

      // Audit: which HR user started / closed it
      created_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      closed_by: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { table: "users", field: "id" },
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

    // Database-level rules — hold even for edits made directly in pgAdmin
    await queryInterface.sequelize.query(`
      ALTER TABLE "internship_probation_periods"
        ADD CONSTRAINT "chk_ipp_type"
          CHECK ("period_type" IN ('Internship', 'Probation')),
        ADD CONSTRAINT "chk_ipp_status"
          CHECK ("status" IN ('Active', 'Confirmed', 'Converted', 'Ended', 'Terminated')),
        ADD CONSTRAINT "chk_ipp_performance"
          CHECK ("performance" IN ('Pending', 'Needs Improvement', 'Good', 'Excellent')),
        ADD CONSTRAINT "chk_ipp_dates"
          CHECK ("end_date" > "start_date" AND "original_end_date" > "start_date"),
        ADD CONSTRAINT "chk_ipp_extension"
          CHECK ("extension_count" >= 0 AND "end_date" >= "original_end_date"),
        ADD CONSTRAINT "chk_ipp_stipend"
          CHECK ("stipend" IS NULL OR ("period_type" = 'Internship' AND "stipend" >= 0)),
        -- "Converted" (intern → probation) and "Ended" only make sense for internships
        ADD CONSTRAINT "chk_ipp_converted_only_internship"
          CHECK ("status" NOT IN ('Converted', 'Ended') OR "period_type" = 'Internship'),
        ADD CONSTRAINT "chk_ipp_closed_consistency"
          CHECK (("status" = 'Active') = ("closed_at" IS NULL));
    `);

    // Only ONE active period per employee
    await queryInterface.sequelize.query(`
      CREATE UNIQUE INDEX "uq_ipp_one_active_per_employee"
        ON "internship_probation_periods" ("employee_id")
        WHERE "status" = 'Active';
    `);

    await queryInterface.sequelize.query(`
      CREATE INDEX "idx_ipp_company_status_end"
        ON "internship_probation_periods" ("company_id", "status", "end_date");
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("internship_probation_periods");
  },
};
