const { sequelize } = require('./src/config/database');

async function addTemplateReviewerIdColumn() {
  try {
    console.log('Starting migration: add template_reviewer_id to companies...');

    await sequelize.authenticate();
    console.log('Database connection successful');

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

    console.log('template_reviewer_id column added to companies table');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

addTemplateReviewerIdColumn();
