/**
 * Ensure case reassignment tracking columns exist (prod-safe).
 * previous_assigned_to / reassigned_by / reassigned_at
 * Also adds notifications.case_reassigned enum value when possible.
 */

const ensureCaseReassignmentSchema = async (sequelize) => {
  const statements = [
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS previous_assigned_to INTEGER`,
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS reassigned_by INTEGER`,
    `ALTER TABLE cases ADD COLUMN IF NOT EXISTS reassigned_at TIMESTAMP WITH TIME ZONE`,
  ];

  for (const sql of statements) {
    try {
      await sequelize.query(sql);
    } catch (error) {
      console.warn('ensureCaseReassignmentSchema:', error.message);
    }
  }

  // Add notification enum value (Postgres). Ignore if already exists / not enum.
  try {
    await sequelize.query(`
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
    `);
  } catch (error) {
    console.warn('case_reassigned notification enum:', error.message);
  }

  return { ok: true };
};

module.exports = { ensureCaseReassignmentSchema };
