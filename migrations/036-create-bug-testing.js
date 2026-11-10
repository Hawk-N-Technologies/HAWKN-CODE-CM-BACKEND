"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exists = await queryInterface.tableExists("bug_testing");

    if (exists) {
      console.log("bug_testing table already exists");
      return;
    }

    await queryInterface.createTable("bug_testing", {
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

      bug_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "project_bugs",
          field: "id",
        },
        onDelete: "CASCADE",
        onUpdate: "CASCADE",
      },

      attempt_number: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 1,
      },

      status: {
        type: Sequelize.STRING(20),
        allowNull: false,
        defaultValue: "Pending",
      },

      test_notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },

      tested_at: {
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

    // Attempt number must be greater than zero
    await queryInterface.addConstraint("bug_testing", {
      fields: ["attempt_number"],
      type: "check",
      where: {
        attempt_number: {
          [Sequelize.Op.gt]: 0,
        },
      },
      name: "chk_bug_testing_attempt_number",
    });

    // Allowed testing statuses
    await queryInterface.addConstraint("bug_testing", {
      fields: ["status"],
      type: "check",
      where: {
        status: ["Pending", "In Progress", "Passed", "Failed"],
      },
      name: "chk_bug_testing_status",
    });

    // Each bug can have only one record per attempt number
    await queryInterface.addConstraint("bug_testing", {
      fields: ["bug_id", "attempt_number"],
      type: "unique",
      name: "uq_bug_testing_attempt",
    });

    // Project index
    await queryInterface.addIndex("bug_testing", ["project_id"], {
      name: "idx_bug_testing_project",
    });

    // Bug index
    await queryInterface.addIndex("bug_testing", ["bug_id"], {
      name: "idx_bug_testing_bug",
    });

    // Status index
    await queryInterface.addIndex("bug_testing", ["status"], {
      name: "idx_bug_testing_status",
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable("bug_testing");
  },
};
