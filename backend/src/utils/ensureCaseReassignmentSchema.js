/**
 * Ensure case reassignment tracking columns exist (prod-safe).
 * previous_assigned_to / reassigned_by / reassigned_at
 * Also adds notifications.case_reassigned enum value when possible.
 *
 * On RDS the app user often cannot ALTER "cases". If columns are still missing
 * after the attempt, they are stripped from the Case model so list APIs
 * (my-assigned, get-all) do not 500 with "column does not exist".
 */

let caseReassignmentSchemaAvailable = false;

const REASSIGNMENT_COLUMNS = [
  { name: 'previous_assigned_to', sql: 'INTEGER' },
  { name: 'reassigned_by', sql: 'INTEGER' },
  { name: 'reassigned_at', sql: 'TIMESTAMP WITH TIME ZONE' }
];

const isPrivilegeError = (error) => {
  const code = error?.original?.code || error?.parent?.code;
  const message = String(error?.message || '');
  return (
    code === '42501' ||
    /must be owner/i.test(message) ||
    /permission denied/i.test(message)
  );
};

async function columnExists(sequelize, table, column) {
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

const disableMissingCaseAttributes = (CaseModel, missingColumns) => {
  if (!CaseModel || !missingColumns.length) return;
  for (const attr of missingColumns) {
    if (CaseModel.rawAttributes?.[attr]) {
      CaseModel.removeAttribute(attr);
    }
  }
};

const ensureCaseReassignmentSchema = async (sequelize, CaseModel) => {
  for (const col of REASSIGNMENT_COLUMNS) {
    try {
      await sequelize.query(
        `ALTER TABLE cases ADD COLUMN IF NOT EXISTS ${col.name} ${col.sql}`
      );
    } catch (error) {
      const message = error?.message || '';
      if (isPrivilegeError(error)) {
        console.warn(
          `Cannot auto-add cases.${col.name} (DB user lacks ownership). ` +
            'Run `node migrate-add-case-reassignment-fields.js` as the RDS master user, ' +
            'or add the column in AWS RDS Query Editor.'
        );
      } else {
        console.warn(`ensureCaseReassignmentSchema (${col.name}):`, message);
      }
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

  let missingColumns = [];
  try {
    for (const col of REASSIGNMENT_COLUMNS) {
      const exists = await columnExists(sequelize, 'cases', col.name);
      if (!exists) missingColumns.push(col.name);
    }
  } catch (verifyErr) {
    console.warn('Could not verify case reassignment columns:', verifyErr.message);
    missingColumns = REASSIGNMENT_COLUMNS.map((col) => col.name);
  }

  caseReassignmentSchemaAvailable = missingColumns.length === 0;

  if (!caseReassignmentSchemaAvailable) {
    disableMissingCaseAttributes(CaseModel, missingColumns);
    console.warn(
      `cases is missing ${missingColumns.join(', ')} — assigned-cases API will work, ` +
        'but Super Admin reassignment history is disabled until those columns are added.'
    );
  } else {
    console.log(
      'Case reassignment schema verified (previous_assigned_to, reassigned_by, reassigned_at)'
    );
  }

  return { ok: true, available: caseReassignmentSchemaAvailable };
};

function isCaseReassignmentSchemaAvailable() {
  return caseReassignmentSchemaAvailable;
}

function getCaseReassignmentIncludes(User) {
  if (!caseReassignmentSchemaAvailable || !User) return [];
  return [
    {
      model: User,
      as: 'previousAssignedUser',
      attributes: ['id', 'name', 'email'],
      required: false
    },
    {
      model: User,
      as: 'reassignedByUser',
      attributes: ['id', 'name', 'email'],
      required: false
    }
  ];
}

module.exports = {
  ensureCaseReassignmentSchema,
  isCaseReassignmentSchemaAvailable,
  getCaseReassignmentIncludes
};
