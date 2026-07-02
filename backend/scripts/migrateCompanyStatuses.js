/**
 * Migration: company_statuses table, deadline_days column, and default status seed.
 *
 * Safe for RDS / managed PostgreSQL where the app DB user is not table owner.
 * DDL steps are skipped on ownership errors; status rows are seeded via Sequelize.
 *
 * Run from backend folder:
 *   node scripts/migrateCompanyStatuses.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const { sequelize } = require('../src/config/database');
const { CompanyStatus } = require('../src/models');
const { DEFAULT_STATUSES } = require('../src/constants/defaultCompanyStatuses');

const OWNER_SQL = `
-- Run once as the database owner (RDS master / postgres) if the app user lacks ownership:
ALTER TABLE company_statuses
  ADD COLUMN IF NOT EXISTS deadline_days INTEGER NOT NULL DEFAULT 0;

ALTER TABLE companies
  ALTER COLUMN status TYPE VARCHAR(255)
  USING status::text;
`.trim();

const DDL_STEPS = [
  {
    label: 'create company_statuses table',
    sql: `CREATE TABLE IF NOT EXISTS company_statuses (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      value VARCHAR(255) NOT NULL UNIQUE,
      color VARCHAR(255) DEFAULT '#6b7280',
      deadline_days INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      created_by INTEGER NULL REFERENCES users(id),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    )`
  },
  {
    label: 'add company_statuses.deadline_days',
    sql: `ALTER TABLE company_statuses
      ADD COLUMN IF NOT EXISTS deadline_days INTEGER NOT NULL DEFAULT 0`
  },
  {
    label: 'widen companies.status to VARCHAR(255)',
    sql: `ALTER TABLE companies
      ALTER COLUMN status TYPE VARCHAR(255)
      USING status::text`
  }
];

function isOwnershipError(err) {
  const msg = err?.message || '';
  return msg.includes('must be owner') || msg.includes('permission denied');
}

async function columnExists(table, column) {
  const [rows] = await sequelize.query(
    `
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = :table
      AND column_name = :column
    LIMIT 1
    `,
    { replacements: { table, column } }
  );
  return rows.length > 0;
}

async function tryOptionalDdl({ label, sql }) {
  try {
    await sequelize.query(sql);
    console.log('OK:', label);
    return true;
  } catch (err) {
    if (isOwnershipError(err)) {
      console.warn('SKIP (DB user is not table owner):', label);
      return false;
    }
    throw err;
  }
}

async function seedStatuses() {
  const hasDeadlineCol = await columnExists('company_statuses', 'deadline_days');
  let created = 0;
  let updated = 0;

  if (!hasDeadlineCol) {
    delete CompanyStatus.rawAttributes.deadline_days;
  }

  for (const status of DEFAULT_STATUSES) {
    const payload = {
      name: status.name,
      color: status.color,
      is_active: true
    };

    if (hasDeadlineCol) {
      payload.deadline_days = status.deadline_days;
    }

    const [record, wasCreated] = await CompanyStatus.findOrCreate({
      where: { value: status.value },
      defaults: { ...payload, value: status.value }
    });

    if (wasCreated) {
      created += 1;
    } else {
      await record.update(payload);
      updated += 1;
    }
  }

  console.log(`Seeded company statuses: ${created} created, ${updated} updated.`);
  return hasDeadlineCol;
}

async function run() {
  let needsOwnerSql = false;

  try {
    await sequelize.authenticate();
    console.log('Database connected.');

    for (const step of DDL_STEPS) {
      const ok = await tryOptionalDdl(step);
      if (!ok) {
        needsOwnerSql = true;
      }
    }

    const hasDeadlineCol = await seedStatuses();

    if (needsOwnerSql || !hasDeadlineCol) {
      console.warn('\nSome schema changes require the database owner. Run this SQL, then re-run this script:\n');
      console.warn(OWNER_SQL);
      console.warn('');
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
