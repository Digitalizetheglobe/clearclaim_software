-- ==============================================================================
-- ClearClaim Production Database Migration Script (AWS RDS)
-- Target Database: PostgreSQL (AWS RDS)
-- Execution: Run as RDS Master User (e.g. postgres) via AWS RDS Query Editor
--            or via psql: psql -h <rds-endpoint> -U postgres -d <dbname> -f migrations_production_rds.sql
-- Note: All commands are fully idempotent and safe to execute on live data.
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Company Status SLA Deadlines
-- Adds deadline_days to company_statuses table
-- ------------------------------------------------------------------------------
ALTER TABLE company_statuses
ADD COLUMN IF NOT EXISTS deadline_days INTEGER NOT NULL DEFAULT 0;

-- ------------------------------------------------------------------------------
-- 2. Companies Template Reviewer
-- Adds template_reviewer_id to companies and links to users(id)
-- ------------------------------------------------------------------------------
ALTER TABLE companies
ADD COLUMN IF NOT EXISTS template_reviewer_id INTEGER NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'companies_template_reviewer_id_fkey'
  ) THEN
    ALTER TABLE companies
    ADD CONSTRAINT companies_template_reviewer_id_fkey
    FOREIGN KEY (template_reviewer_id) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. Case Reassignment Tracking Fields
-- Adds tracking columns to cases table for Super Admin audit & permissions
-- ------------------------------------------------------------------------------
ALTER TABLE cases
ADD COLUMN IF NOT EXISTS previous_assigned_to INTEGER NULL;

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS reassigned_by INTEGER NULL;

ALTER TABLE cases
ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_previous_assigned_to_fkey'
  ) THEN
    ALTER TABLE cases
    ADD CONSTRAINT cases_previous_assigned_to_fkey
    FOREIGN KEY (previous_assigned_to) REFERENCES users(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'cases_reassigned_by_fkey'
  ) THEN
    ALTER TABLE cases
    ADD CONSTRAINT cases_reassigned_by_fkey
    FOREIGN KEY (reassigned_by) REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for reassignment queries if they do not exist
CREATE INDEX IF NOT EXISTS idx_cases_previous_assigned_to ON cases(previous_assigned_to);
CREATE INDEX IF NOT EXISTS idx_cases_reassigned_by ON cases(reassigned_by);
CREATE INDEX IF NOT EXISTS idx_companies_template_reviewer_id ON companies(template_reviewer_id);

COMMIT;

-- ------------------------------------------------------------------------------
-- 4. Notification Type Enum Value: 'case_reassigned'
-- Note: ALTER TYPE ADD VALUE cannot run inside a multi-command transaction block
-- in PostgreSQL, so it is placed outside the BEGIN/COMMIT block.
-- ------------------------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_notifications_type') THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_enum
      WHERE enumlabel = 'case_reassigned'
        AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'enum_notifications_type')
    ) THEN
      ALTER TYPE enum_notifications_type ADD VALUE 'case_reassigned';
    END IF;
  END IF;
END $$;

