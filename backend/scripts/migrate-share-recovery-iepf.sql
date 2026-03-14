-- Migration: Update share_recoveries and iepf_forms to new fields
-- (Name, Mobile number, Email id, City) — drop Subject, Message
-- Run this on your PostgreSQL database (e.g. psql or RDS query editor).

-- ========== share_recoveries ==========
-- Add new columns
ALTER TABLE share_recoveries
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(255);

-- Drop old columns (ignore if already dropped)
ALTER TABLE share_recoveries DROP COLUMN IF EXISTS subject;
ALTER TABLE share_recoveries DROP COLUMN IF EXISTS message;

-- Make new columns NOT NULL if table is empty or you've backfilled; optional:
-- ALTER TABLE share_recoveries ALTER COLUMN mobile_number SET NOT NULL;
-- ALTER TABLE share_recoveries ALTER COLUMN city SET NOT NULL;

-- ========== iepf_forms ==========
-- Add new columns
ALTER TABLE iepf_forms
  ADD COLUMN IF NOT EXISTS mobile_number VARCHAR(255),
  ADD COLUMN IF NOT EXISTS city VARCHAR(255);

-- Drop old columns
ALTER TABLE iepf_forms DROP COLUMN IF EXISTS subject;
ALTER TABLE iepf_forms DROP COLUMN IF EXISTS message;
