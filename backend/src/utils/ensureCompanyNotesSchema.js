/**
 * Ensure company_notes exists in production.
 * Local gets this via sequelize.sync({ alter: true }); prod does not.
 */
async function ensureCompanyNotesSchema(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS company_notes (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      note TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_company_notes_company_id
      ON company_notes(company_id);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_company_notes_user_id
      ON company_notes(user_id);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_company_notes_created_at
      ON company_notes(created_at DESC);
  `);
}

/**
 * Ensure company_status_history exists (also added after local-only sync era).
 */
async function ensureCompanyStatusHistorySchema(sequelize) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS company_status_history (
      id SERIAL PRIMARY KEY,
      company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
      from_status VARCHAR(255),
      to_status VARCHAR(255) NOT NULL,
      changed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      change_source VARCHAR(80),
      note TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_company_status_history_company_id
      ON company_status_history(company_id);
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS idx_company_status_history_created_at
      ON company_status_history(created_at ASC);
  `);
}

module.exports = {
  ensureCompanyNotesSchema,
  ensureCompanyStatusHistorySchema
};
