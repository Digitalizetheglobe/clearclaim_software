const { ensureCompanySchema } = require('./ensureCompanySchema');

let templateReviewerColumnAvailable = false;

async function columnExists(sequelize) {
  const [rows] = await sequelize.query(`
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'companies'
      AND column_name = 'template_reviewer_id'
    LIMIT 1
  `);
  return rows.length > 0;
}

async function initializeCompanySchemaFeatures(sequelize, Company) {
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

  templateReviewerColumnAvailable = await columnExists(sequelize);

  if (!templateReviewerColumnAvailable) {
    delete Company.rawAttributes.template_reviewer_id;
    console.warn(
      'companies.template_reviewer_id is missing — company list/API works, ' +
      'but template reviewer assignment is disabled until the column is added.'
    );
    return false;
  }

  console.log('Company schema verified (template_reviewer_id)');
  return true;
}

function isTemplateReviewerColumnAvailable() {
  return templateReviewerColumnAvailable;
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
  getTemplateReviewerInclude
};
