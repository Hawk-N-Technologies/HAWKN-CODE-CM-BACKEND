"use strict";

/**
 * Projects — one row per client project.
 * Copied word-for-word from database.sql so the schema stays exactly the
 * team's design. IF NOT EXISTS → safe if the table was already created
 * from database.sql in pgAdmin (then this does nothing).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
          company_id INTEGER NOT NULL,
          client_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          project_lead_id INTEGER,
          tier VARCHAR(30) NOT NULL DEFAULT 'Tier I',
          start_date DATE,
          deadline DATE,
          internal_deadline DATE,
          status VARCHAR(50) NOT NULL DEFAULT 'Planning',
          progress INTEGER NOT NULL DEFAULT 0,
          description TEXT,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_projects_company
              FOREIGN KEY (company_id)
              REFERENCES companies(id)
              ON DELETE CASCADE,
          CONSTRAINT fk_projects_client
              FOREIGN KEY (client_id)
              REFERENCES clients(id)
              ON DELETE RESTRICT,
          CONSTRAINT fk_projects_lead
              FOREIGN KEY (project_lead_id)
              REFERENCES employees(id)
              ON DELETE SET NULL,
          CONSTRAINT chk_projects_tier
              CHECK (tier IN ('Tier I', 'Tier II', 'Tier III')),
          CONSTRAINT chk_projects_status
              CHECK (
                  status IN (
                      'Planning',
                      'In Development',
                      'Testing',
                      'Completed',
                      'On Hold',
                      'Cancelled'
                  )
              ),
          CONSTRAINT chk_projects_progress
              CHECK (progress >= 0 AND progress <= 100),
          CONSTRAINT chk_project_dates
              CHECK (
                  deadline IS NULL
                  OR start_date IS NULL
                  OR deadline >= start_date
              )
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("projects");
  },
};