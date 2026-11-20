"use strict";

/**
 * Testing module.
 *
 *  project_phases  + tester sign-off (test_status / notes / who / when)
 *                  + client approval for phases the lead ticks
 *                    "Needs client approval" (Approved / Rejected / Changes Requested)
 *  project_builds  — tester checks each version (build) of a project
 *  field_trainings — training sessions run by the tester (date, Meet link, notes)
 *
 * Idempotent: every column / table is only added when missing.
 */

const PHASE_COLUMNS = (Sequelize) => ({
  needs_client_approval: {
    type: Sequelize.BOOLEAN,
    allowNull: false,
    defaultValue: false,
  },
  test_status: {
    type: Sequelize.STRING(20),
    allowNull: false,
    defaultValue: "Pending",
  },
  test_notes: { type: Sequelize.TEXT, allowNull: true },
  tested_by: {
    type: Sequelize.INTEGER,
    allowNull: true,
    references: { table: "users", field: "id" },
    onDelete: "SET NULL",
    onUpdate: "CASCADE",
  },
  tested_at: { type: Sequelize.DATE, allowNull: true },
  // null = not sent to the client · Pending · Approved · Rejected · Changes Requested
  client_approval_status: { type: Sequelize.STRING(30), allowNull: true },
  client_note: { type: Sequelize.TEXT, allowNull: true },
  client_responded_at: { type: Sequelize.DATE, allowNull: true },
});

const base = (Sequelize) => ({
  id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
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
  project_id: {
    type: Sequelize.INTEGER,
    allowNull: false,
    references: { table: "projects", field: "id" },
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  },
});

const userRef = (Sequelize) => ({
  type: Sequelize.INTEGER,
  allowNull: true,
  references: { table: "users", field: "id" },
  onDelete: "SET NULL",
  onUpdate: "CASCADE",
});

const timestamps = (Sequelize) => ({
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

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1) Phase sign-off + client approval
    const phaseTable = await queryInterface.describeTable("project_phases");

    for (const [column, definition] of Object.entries(PHASE_COLUMNS(Sequelize))) {
      if (!phaseTable[column]) {
        await queryInterface.addColumn("project_phases", column, definition);
      }
    }

    // 2) Builds
    if (!(await queryInterface.tableExists("project_builds"))) {
      await queryInterface.createTable("project_builds", {
        ...base(Sequelize),
        version_label: { type: Sequelize.STRING(50), allowNull: false },
        environment: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "QA" },
        build_url: { type: Sequelize.STRING(500), allowNull: true },
        release_notes: { type: Sequelize.TEXT, allowNull: true },
        result: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "Pending" },
        test_notes: { type: Sequelize.TEXT, allowNull: true },
        created_by: userRef(Sequelize),
        tested_by: userRef(Sequelize),
        tested_at: { type: Sequelize.DATE, allowNull: true },
        ...timestamps(Sequelize),
      });

      await queryInterface.addIndex("project_builds", ["company_id", "project_id"], {
        name: "idx_project_builds_company_project",
      });
    }

    // 3) Field training sessions
    if (!(await queryInterface.tableExists("field_trainings"))) {
      await queryInterface.createTable("field_trainings", {
        ...base(Sequelize),
        title: { type: Sequelize.STRING(150), allowNull: false },
        scheduled_at: { type: Sequelize.DATE, allowNull: false },
        duration_minutes: { type: Sequelize.INTEGER, allowNull: true },
        meeting_link: { type: Sequelize.STRING(500), allowNull: true },
        notes: { type: Sequelize.TEXT, allowNull: true },
        status: { type: Sequelize.STRING(20), allowNull: false, defaultValue: "Scheduled" },
        created_by: userRef(Sequelize),
        ...timestamps(Sequelize),
      });

      await queryInterface.addIndex("field_trainings", ["company_id", "project_id"], {
        name: "idx_field_trainings_company_project",
      });
    }
  },

  async down(queryInterface) {
    await queryInterface.dropTable("field_trainings");
    await queryInterface.dropTable("project_builds");

    for (const column of [
      "needs_client_approval",
      "test_status",
      "test_notes",
      "tested_by",
      "tested_at",
      "client_approval_status",
      "client_note",
      "client_responded_at",
    ]) {
      await queryInterface.removeColumn("project_phases", column);
    }
  },
};
