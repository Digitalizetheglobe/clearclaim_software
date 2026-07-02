const { ensureCompanySchema } = require('./ensureCompanySchema');

let templateReviewerColumnAvailable = false;
let statusDeadlineDaysColumnAvailable = false;

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

async function ensureCompanyStatusSchema(sequelize) {
  try {
    await sequelize.query(`
      ALTER TABLE company_statuses
      ADD COLUMN IF NOT EXISTS deadline_days INTEGER NOT NULL DEFAULT 0
    `);
  } catch (error) {
    const message = error?.message || '';
    if (message.includes('must be owner')) {
      console.warn(
        'Cannot auto-add company_statuses.deadline_days (DB user lacks ownership). ' +
        'Run ALTER TABLE as the RDS master user, or use AWS RDS Query Editor.'
      );
    } else {
      console.warn('Company status schema migration skipped:', message);
    }
  }
}

async function initializeCompanySchemaFeatures(sequelize, models) {
  const Company = models?.Company;
  const CompanyStatus = models?.CompanyStatus;

  try {
    await ensureCompanySchema(sequelize);
  } catch (error) {
    const message = error?.message || '';
    if (message.includes('must be owner')) {
      console.warn(
        'Cannot auto-add companies.template_reviewer_id (DB user lacks ownership). ' +
        'Run ALTER TABLE as the RDS master user, or use AWS RDS Query Editor.'
      );
    } else {
      console.warn('Company schema migration skipped:', message);
    }
  }

  await ensureCompanyStatusSchema(sequelize);

  templateReviewerColumnAvailable = await columnExists(sequelize, 'companies', 'template_reviewer_id');
  statusDeadlineDaysColumnAvailable = await columnExists(
    sequelize,
    'company_statuses',
    'deadline_days'
  );

  if (!templateReviewerColumnAvailable && Company) {
    delete Company.rawAttributes.template_reviewer_id;
    console.warn(
      'companies.template_reviewer_id is missing — company list/API works, ' +
      'but template reviewer assignment is disabled until the column is added.'
    );
  } else if (templateReviewerColumnAvailable) {
    console.log('Company schema verified (template_reviewer_id)');
  }

  if (!statusDeadlineDaysColumnAvailable && CompanyStatus) {
    delete CompanyStatus.rawAttributes.deadline_days;
    console.warn(
      'company_statuses.deadline_days is missing — status APIs work with defaults, ' +
      'but SLA deadlines use built-in values until the column is added.'
    );
  } else if (statusDeadlineDaysColumnAvailable) {
    console.log('Company status schema verified (deadline_days)');
  }

  return {
    templateReviewerColumnAvailable,
    statusDeadlineDaysColumnAvailable
  };
}

function isTemplateReviewerColumnAvailable() {
  return templateReviewerColumnAvailable;
}

function isStatusDeadlineDaysColumnAvailable() {
  return statusDeadlineDaysColumnAvailable;
}

function getTemplateReviewerInclude(User) {
  if (!templateReviewerColumnAvailable) return null;
  return {
    model: User,
    as: 'templateReviewer',
    attributes: ['id', 'name', 'email']
  };
}

module.exports = {
  initializeCompanySchemaFeatures,
  isTemplateReviewerColumnAvailable,
  isStatusDeadlineDaysColumnAvailable,
  getTemplateReviewerInclude
};
