const { isTemplateReviewerColumnAvailable } = require('./companySchemaFeatures');

/** Legacy preparation / open statuses. */
const PENDING_REVIEW_STATUSES = ['pending', 'in_progress', 'in_review'];

/**
 * Excel / data review queue + edit-lock statuses.
 * `in_review` is kept as a legacy alias of `excel_review`.
 */
const EXCEL_DATA_REVIEW_STATUSES = ['excel_review', 'in_review'];

/** After Excel/data approve → Form Generation; after template approve → Form Printing. */
const DATA_REVIEW_APPROVED_STATUSES = [
  'form_generation',
  'digital_forms_review',
  'form_printing',
  'completed'
];

/** After Excel/data or template reject → Excel Rectification (legacy: rejected). */
const DATA_REVIEW_REJECTED_STATUSES = ['excel_rectification', 'rejected'];

/** Company status while templates are with the template reviewer. */
const TEMPLATE_FORMS_REVIEW_STATUSES = ['digital_forms_review'];

const COMPANY_WORKFLOW_STATUS = {
  EXCEL_PREPARATION: 'excel_preparation',
  EXCEL_REVIEW: 'excel_review',
  EXCEL_RECTIFICATION: 'excel_rectification',
  FORM_GENERATION: 'form_generation',
  DIGITAL_FORMS_REVIEW: 'digital_forms_review',
  FORM_PRINTING: 'form_printing'
};

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
    if (templateReviewerId == null) return [];
    // Legacy fallback when DB column is missing: template review used assigned_to
    if (!isTemplateReviewerColumnAvailable()) {
      return [{ assigned_to: templateReviewerId }];
    }
    return [{ template_reviewer_id: templateReviewerId }];
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

const normalizeCompanyStatus = (status) =>
  String(status || '').toLowerCase().replace(/[\s-]+/g, '_').trim();

const isPendingReviewStatus = (status) =>
  PENDING_REVIEW_STATUSES.includes(normalizeCompanyStatus(status));

const isExcelDataReviewStatus = (status) =>
  EXCEL_DATA_REVIEW_STATUSES.includes(normalizeCompanyStatus(status));

const isDataReviewApprovedStatus = (status) =>
  DATA_REVIEW_APPROVED_STATUSES.includes(normalizeCompanyStatus(status));

const isDataReviewRejectedStatus = (status) =>
  DATA_REVIEW_REJECTED_STATUSES.includes(normalizeCompanyStatus(status));

const isDigitalFormsReviewStatus = (status) =>
  TEMPLATE_FORMS_REVIEW_STATUSES.includes(normalizeCompanyStatus(status));

const getSelectedCompanyTemplates = (company) => {
  const templates =
    company?.companyTemplates ||
    company?.selectedTemplates ||
    company?.templates ||
    [];
  const list = Array.isArray(templates)
    ? templates
    : typeof templates?.toJSON === 'function'
      ? templates.toJSON()
      : [];
  const rows = Array.isArray(list) ? list : [];
  return rows.filter((template) => template?.is_selected !== false);
};

/**
 * Template-review phase independent of company.data status.
 * Phase values: approved | rejected | in_review | none
 */
const getTemplateReviewPhase = (company) => {
  const hasTemplateReviewer = isTemplateReviewerColumnAvailable()
    ? company?.template_reviewer_id != null
    : false;
  if (!hasTemplateReviewer) return 'none';

  const selected = getSelectedCompanyTemplates(company);
  if (selected.length > 0) {
    const statuses = selected.map((t) =>
      String(t.review_status || '')
        .toLowerCase()
        .trim()
    );
    if (statuses.every((s) => s === 'done')) return 'approved';
    if (statuses.some((s) => s === 'need_to_improve')) return 'rejected';
    return 'in_review';
  }

  const status = normalizeCompanyStatus(company?.status);
  if (isDataReviewRejectedStatus(status)) return 'rejected';
  if (isDigitalFormsReviewStatus(status)) return 'in_review';
  return 'in_review';
};

/** Company in Excel / data review queue (excludes template-only assignments). */
const isExcelReviewQueueCompany = (company) => {
  if (!isExcelDataReviewStatus(company?.status)) return false;
  if (
    company?.template_reviewer_id != null &&
    company?.assigned_to != null &&
    Number(company.template_reviewer_id) === Number(company.assigned_to)
  ) {
    return false;
  }
  return true;
};

/** Company assigned for template review and still awaiting template decision. */
const isTemplateReviewQueueCompany = (company) =>
  getTemplateReviewPhase(company) === 'in_review';

/** Sequelize include for selected templates (review queue classification). */
const getSelectedTemplatesInclude = (CompanyTemplate) => ({
  model: CompanyTemplate,
  as: 'companyTemplates',
  required: false,
  where: { is_selected: true },
  attributes: ['id', 'template_name', 'review_status', 'is_selected', 'admin_comment', 'admin_remark']
});

module.exports = {
  PENDING_REVIEW_STATUSES,
  EXCEL_DATA_REVIEW_STATUSES,
  DATA_REVIEW_APPROVED_STATUSES,
  DATA_REVIEW_REJECTED_STATUSES,
  TEMPLATE_FORMS_REVIEW_STATUSES,
  COMPANY_WORKFLOW_STATUS,
  buildReviewerAssignmentConditions,
  isDataReviewAssignment,
  isTemplateReviewAssignment,
  isPendingReviewStatus,
  isExcelDataReviewStatus,
  isDataReviewApprovedStatus,
  isDataReviewRejectedStatus,
  isDigitalFormsReviewStatus,
  normalizeCompanyStatus,
  isExcelReviewQueueCompany,
  isTemplateReviewQueueCompany,
  getTemplateReviewPhase,
  getSelectedCompanyTemplates,
  getSelectedTemplatesInclude
};
