/**
 * Migration: Update share_recoveries and iepf_forms to new schema
 * Fields: name, mobile_number, email, city (removes subject, message)
 *
 * Run from backend folder: node scripts/migrateShareRecoveryIepfSchema.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../src/config/database');

const statements = [
  // share_recoveries: add new columns
  `ALTER TABLE share_recoveries
   ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(255),
   ADD COLUMN IF NOT EXISTS city VARCHAR(255)`,
  'ALTER TABLE share_recoveries DROP COLUMN IF EXISTS subject',
  'ALTER TABLE share_recoveries DROP COLUMN IF EXISTS message',
  // iepf_forms: add new columns
  `ALTER TABLE iepf_forms
   ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(255),
   ADD COLUMN IF NOT EXISTS city VARCHAR(255)`,
  'ALTER TABLE iepf_forms DROP COLUMN IF EXISTS subject',
  'ALTER TABLE iepf_forms DROP COLUMN IF EXISTS message'
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    for (const sql of statements) {
      await sequelize.query(sql);
      console.log('OK:', sql.split('\n')[0].trim().slice(0, 60) + '...');
    }

    console.log('Migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
