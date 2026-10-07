"use strict";

/**
 * Clients (companies HawKN builds projects for).
 * Copied word-for-word from database.sql so the schema stays exactly the
 * team's design. IF NOT EXISTS → safe if the table was already created
 * from database.sql in pgAdmin (then this does nothing).
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE TABLE IF NOT EXISTS clients (
          id SERIAL PRIMARY KEY,
          uuid UUID NOT NULL UNIQUE DEFAULT gen_random_uuid(),
          company_id INTEGER NOT NULL,
          name VARCHAR(255) NOT NULL,
          contact_person VARCHAR(150),
          email VARCHAR(255),
          phone VARCHAR(30),
          address TEXT,
          is_active BOOLEAN NOT NULL DEFAULT TRUE,
          created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT fk_clients_company
              FOREIGN KEY (company_id)
              REFERENCES companies(id)
              ON DELETE CASCADE,
          CONSTRAINT uq_clients_company_name
              UNIQUE (company_id, name)
      );
    `);
  },

  async down(queryInterface) {
    await queryInterface.dropTable("clients");
  },
};