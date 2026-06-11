const { isTemplateReviewerColumnAvailable } = require('./companySchemaFeatures');

const PENDING_REVIEW_STATUSES = ['pending', 'in_progress', 'in_review'];

const parseReviewerId = (value) => {
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/**
 * Build Sequelize where conditions for reviewer assignment queries.
 * review_type=data    -> assigned_to only (Excel / data review)
 * review_type=template -> template_reviewer_id only
 * otherwise          -> OR assigned_to and template_reviewer_id when both provided
 */
const buildReviewerAssignmentConditions = ({
  assigned_to,
  template_reviewer_id,
  review_type
}) => {
  const assignedId = assigned_to != null ? parseReviewerId(assigned_to) : null;
  const templateReviewerId =
    template_reviewer_id != null ? parseReviewerId(template_reviewer_id) : null;

  if (review_type === 'data') {
    return assignedId != null ? [{ assigned_to: assignedId }] : [];
  }

  if (review_type === 'template') {
    if (!isTemplateReviewerColumnAvailable()) return [];
    return templateReviewerId != null ? [{ template_reviewer_id: templateReviewerId }] : [];
  }

  const conditions = [];
  if (assignedId != null) conditions.push({ assigned_to: assignedId });
  if (templateReviewerId != null && isTemplateReviewerColumnAvailable()) {
    conditions.push({ template_reviewer_id: templateReviewerId });
  }
  return conditions;
};

const isDataReviewAssignment = (company, userId) => {
  if (!company || userId == null) return false;
  return Number(company.assigned_to) === Number(userId);
};

const isTemplateReviewAssignment = (company, userId) => {
  if (!company || userId == null || !isTemplateReviewerColumnAvailable()) return false;
  return Number(company.template_reviewer_id) === Number(userId);
};

const isPendingReviewStatus = (status) => PENDING_REVIEW_STATUSES.includes(status);

module.exports = {
  PENDING_REVIEW_STATUSES,
  buildReviewerAssignmentConditions,
  isDataReviewAssignment,
  isTemplateReviewAssignment,
  isPendingReviewStatus
};
