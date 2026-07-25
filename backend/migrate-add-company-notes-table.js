/**
 * One-off / manual migration for production RDS:
 *   node migrate-add-company-notes-table.js
 *
 * Creates company_notes (and company_status_history if missing).
 * Falls back to creating tables without foreign keys when the DB user
 * lacks REFERENCES privilege on companies/users.
 */
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const {
  ensureCompanyNotesSchema,
  ensureCompanyStatusHistorySchema
} = require('./src/utils/ensureCompanyNotesSchema');

const tableExists = async (table) => {
  const [rows] = await sequelize.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = :table LIMIT 1`,
    { replacements: { table } }
  );
  return rows.length > 0;
};

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');

    const notes = await ensureCompanyNotesSchema(sequelize);
    console.log(
      `✅ company_notes ready${notes.foreignKeys ? '' : ' (without foreign keys)'}`
    );

    const history = await ensureCompanyStatusHistorySchema(sequelize);
    console.log(
      `✅ company_status_history ready${history.foreignKeys ? '' : ' (without foreign keys)'}`
    );

    console.log('Verification:');
    console.log('  company_notes exists:', await tableExists('company_notes'));
    console.log(
      '  company_status_history exists:',
      await tableExists('company_status_history')
    );
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(
      'If this is a permission error, run the SQL in this file as the RDS master user.'
    );
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
