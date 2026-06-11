async function ensureCompanySchema(sequelize) {
  await sequelize.query(`
    ALTER TABLE companies
    ADD COLUMN IF NOT EXISTS template_reviewer_id INTEGER NULL;
  `);

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'companies_template_reviewer_id_fkey'
      ) THEN
        ALTER TABLE companies
        ADD CONSTRAINT companies_template_reviewer_id_fkey
        FOREIGN KEY (template_reviewer_id) REFERENCES users(id);
      END IF;
    END $$;
  `);
}

module.exports = { ensureCompanySchema };
