/**
 * Migration: case reassignment tracking for Super Admin
 *   node migrate-add-case-reassignment-fields.js
 */
require('dotenv').config();
const { sequelize } = require('./src/config/database');
const { ensureCaseReassignmentSchema } = require('./src/utils/ensureCaseReassignmentSchema');

async function migrate() {
  try {
    await sequelize.authenticate();
    console.log('Database connected');
    await ensureCaseReassignmentSchema(sequelize);
    console.log('✅ Case reassignment columns ready (previous_assigned_to, reassigned_by, reassigned_at)');
    console.log('✅ case_reassigned notification type ensured (if Postgres enum)');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
