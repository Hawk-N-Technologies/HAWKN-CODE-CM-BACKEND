"use strict";

module.exports = {
  async up(queryInterface, Sequelize) {
    const exist = await queryInterface.tableExists("projects");

    if (exist) {
      console.log("projects table already exists");
      return;
    }

    await queryInterface.createTable("projects", {
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

      client_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          table: "clients",
          field: "id",
        },
        onDelete: "RESTRICT",
        onUpdate: "CASCADE",
      },

      name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },

      project_lead_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: {
          table: "employees",
          field: "id",
        },
        onDelete: "SET NULL",
        onUpdate: "CASCADE",
      },

      tier: {
        type: Sequelize.STRING(30),
        allowNull: false,
        defaultValue: "Tier I",
      },

      start_date: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      deadline: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      internal_deadline: {
        type: Sequelize.DATEONLY,
        allowNull: true,
      },

      status: {
        type: Sequelize.STRING(50),
        allowNull: false,
        defaultValue: "Planning",
      },

      progress: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0,
      },

      description: {
        type: Sequelize.TEXT,
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

    await queryInterface.sequelize.query(`
      ALTER TABLE "projects"
        ADD CONSTRAINT "chk_projects_tier"
          CHECK ("tier" IN ('Tier I', 'Tier II', 'Tier III')),

        ADD CONSTRAINT "chk_projects_status"
          CHECK (
            "status" IN (
              'Planning',
              'In Development',
              'Testing',
              'Completed',
              'On Hold',
              'Cancelled'
            )
          ),

        ADD CONSTRAINT "chk_projects_progress"
          CHECK ("progress" >= 0 AND "progress" <= 100),

        ADD CONSTRAINT "chk_project_dates"
          CHECK (
            "deadline" IS NULL
            OR "start_date" IS NULL
            OR "deadline" >= "start_date"
          );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("projects");
  },
};
