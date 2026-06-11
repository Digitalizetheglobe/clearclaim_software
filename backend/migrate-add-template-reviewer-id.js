const { sequelize } = require('./src/config/database');
const { ensureCompanySchema } = require('./src/utils/ensureCompanySchema');

async function addTemplateReviewerIdColumn() {
  try {
    console.log('Starting migration: add template_reviewer_id to companies...');

    await sequelize.authenticate();
    console.log('Database connection successful');

    await ensureCompanySchema(sequelize);

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
