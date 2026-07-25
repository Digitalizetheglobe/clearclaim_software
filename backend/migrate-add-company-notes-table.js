/**
 * One-off / manual migration for production RDS:
 *   node migrate-add-company-notes-table.js
 *
 * Creates company_notes (and company_status_history if missing).
 */
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const {
  ensureCompanyNotesSchema,
  ensureCompanyStatusHistorySchema
} = require('./src/utils/ensureCompanyNotesSchema');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    await ensureCompanyNotesSchema(sequelize);
    console.log('✅ company_notes table ready');

    await ensureCompanyStatusHistorySchema(sequelize);
    console.log('✅ company_status_history table ready');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
