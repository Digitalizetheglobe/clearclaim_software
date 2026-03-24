/**
 * Migration: Convert companies.status to text and create company_statuses table.
 *
 * Run from backend folder:
 * node scripts/migrateCompanyStatuses.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../src/config/database');

const statements = [
  `CREATE TABLE IF NOT EXISTS company_statuses (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    value VARCHAR(255) NOT NULL UNIQUE,
    color VARCHAR(255) DEFAULT '#6b7280',
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE companies
   ALTER COLUMN status TYPE VARCHAR(255)
   USING status::text`,
  `INSERT INTO company_statuses (name, value, color, is_active, created_at, updated_at)
   VALUES
   ('Pending', 'pending', '#f59e0b', TRUE, NOW(), NOW()),
   ('In Progress', 'in_progress', '#2563eb', TRUE, NOW(), NOW()),
   ('In Review', 'in_review', '#7c3aed', TRUE, NOW(), NOW()),
   ('Completed', 'completed', '#16a34a', TRUE, NOW(), NOW()),
   ('Rejected', 'rejected', '#dc2626', TRUE, NOW(), NOW())
   ON CONFLICT (value) DO NOTHING`
];

async function run() {
  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    for (const sql of statements) {
      await sequelize.query(sql);
      console.log('OK:', sql.split('\n')[0].trim().slice(0, 80) + '...');
    }

    console.log('Company status migration completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await sequelize.close();
  }
}

run();
