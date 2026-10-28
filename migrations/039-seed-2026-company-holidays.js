"use strict";

module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO company_holidays (company_id, holiday_date, name, is_paid)
      SELECT companies.id, holidays.holiday_date::date, holidays.name, TRUE
      FROM companies
      CROSS JOIN (
        VALUES
          ('2026-01-26', 'Republic Day'),
          ('2026-03-04', 'Holi'),
          ('2026-03-21', 'Id-ul-Fitr (Eid)'),
          ('2026-03-26', 'Ram Navami'),
          ('2026-03-31', 'Mahavir Jayanti'),
          ('2026-04-03', 'Good Friday'),
          ('2026-05-01', 'Buddha Purnima'),
          ('2026-05-27', 'Id-ul-Zuha (Bakrid)'),
          ('2026-06-26', 'Muharram'),
          ('2026-08-15', 'Independence Day'),
          ('2026-08-26', 'Id-e-Milad'),
          ('2026-09-04', 'Janmashtami'),
          ('2026-10-02', 'Mahatma Gandhi Jayanti'),
          ('2026-10-20', 'Dussehra'),
          ('2026-11-08', 'Diwali'),
          ('2026-11-24', 'Guru Nanak Jayanti'),
          ('2026-12-25', 'Christmas')
      ) AS holidays(holiday_date, name) ON CONFLICT (company_id, holiday_date) DO NOTHING;
    `);
  },

  async down() {
    // Predefined holidays are retained during rollback to avoid removing
    // records that may have been manually created for the same dates.
  },
};
