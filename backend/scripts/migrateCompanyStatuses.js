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
    deadline_days INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_by INTEGER NULL REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
  )`,
  `ALTER TABLE company_statuses
   ADD COLUMN IF NOT EXISTS deadline_days INTEGER NOT NULL DEFAULT 0`,
  `ALTER TABLE companies
   ALTER COLUMN status TYPE VARCHAR(255)
   USING status::text`,
  `INSERT INTO company_statuses (name, value, color, deadline_days, is_active, created_at, updated_at)
   VALUES
   ('Pending', 'pending', '#f59e0b', 0, TRUE, NOW(), NOW()),
   ('In Progress', 'in_progress', '#2563eb', 2, TRUE, NOW(), NOW()),
   ('In Review', 'in_review', '#7c3aed', 2, TRUE, NOW(), NOW()),
   ('Completed', 'completed', '#16a34a', 0, TRUE, NOW(), NOW()),
   ('Rejected', 'rejected', '#dc2626', 0, TRUE, NOW(), NOW()),
   ('Excel Preparation', 'excel_preparation', '#2563eb', 2, TRUE, NOW(), NOW()),
   ('Excel Review', 'excel_review', '#0ea5e9', 1, TRUE, NOW(), NOW()),
   ('Excel Rectification', 'excel_rectification', '#f59e0b', 1, TRUE, NOW(), NOW()),
   ('Form Generation', 'form_generation', '#7c3aed', 1, TRUE, NOW(), NOW()),
   ('Digital Forms Review', 'digital_forms_review', '#8b5cf6', 1, TRUE, NOW(), NOW()),
   ('Form Printing', 'form_printing', '#6366f1', 1, TRUE, NOW(), NOW()),
   ('Legal Docs Prep', 'legal_docs_prep', '#0891b2', 3, TRUE, NOW(), NOW()),
   ('Claim Docket Prep', 'claim_docket_prep', '#06b6d4', 1, TRUE, NOW(), NOW()),
   ('Hard Copy Review', 'hard_copy_review', '#9333ea', 1, TRUE, NOW(), NOW()),
   ('Hard Copy Rectification', 'hard_copy_rectification', '#f97316', 1, TRUE, NOW(), NOW()),
   ('Envelop Preparation', 'envelop_preparation', '#0284c7', 1, TRUE, NOW(), NOW()),
   ('In Transit - Client', 'in_transit_client', '#14b8a6', 5, TRUE, NOW(), NOW()),
   ('Client Docket Review', 'client_docket_review', '#2563eb', 3, TRUE, NOW(), NOW()),
   ('In Transit - RTA', 'in_transit_rta', '#0d9488', 5, TRUE, NOW(), NOW()),
   ('Call RTA - Inward', 'call_rta_inward', '#3b82f6', 3, TRUE, NOW(), NOW()),
   ('POH Received', 'poh_received', '#16a34a', 2, TRUE, NOW(), NOW()),
   ('LOC Received', 'loc_received', '#22c55e', 2, TRUE, NOW(), NOW()),
   ('LOE Received', 'loe_received', '#4ade80', 2, TRUE, NOW(), NOW()),
   ('DRF - Form Filling', 'drf_form_filling', '#7c3aed', 1, TRUE, NOW(), NOW()),
   ('DRF - Hard Copy Review', 'drf_hard_copy_review', '#6d28d9', 1, TRUE, NOW(), NOW()),
   ('In Transit - DP', 'in_transit_dp', '#14b8a6', 5, TRUE, NOW(), NOW()),
   ('IEPF - Form Filling', 'iepf_form_filling', '#8b5cf6', 1, TRUE, NOW(), NOW()),
   ('IEPF - Hard Copy Review', 'iepf_hard_copy_review', '#7e22ce', 1, TRUE, NOW(), NOW()),
   ('IEPF - Legal Docs Prep', 'iepf_legal_docs_prep', '#0f766e', 3, TRUE, NOW(), NOW()),
   ('In Transit - Company', 'in_transit_company', '#0d9488', 5, TRUE, NOW(), NOW()),
   ('IEPF - Pending Receipt Upload', 'iepf_pending_receipt_upload', '#f59e0b', 1, TRUE, NOW(), NOW()),
   ('With Authorities', 'with_authorities', '#dc2626', 45, TRUE, NOW(), NOW()),
   ('Blocked', 'blocked', '#6b7280', 0, TRUE, NOW(), NOW()),
   ('Resolved - IEPF', 'resolved_iepf', '#16a34a', 180, TRUE, NOW(), NOW()),
   ('Resolved - DRF', 'resolved_drf', '#15803d', 45, TRUE, NOW(), NOW()),
   ('Closed', 'closed', '#1f2937', 0, TRUE, NOW(), NOW())
   ON CONFLICT (value) DO UPDATE SET
     name = EXCLUDED.name,
     color = EXCLUDED.color,
     deadline_days = EXCLUDED.deadline_days,
     updated_at = NOW()`
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
