const { CompanyStatusHistory } = require('../models');

/**
 * Record a company status transition for audit / progress history.
 * Never throws — history must not break the main workflow.
 */
const recordCompanyStatusChange = async ({
  companyId,
  fromStatus = null,
  toStatus,
  changedBy = null,
  changeSource = 'manual',
  note = null
}) => {
  try {
    if (!companyId || !toStatus) return null;

    const from = fromStatus != null ? String(fromStatus).trim().toLowerCase() : null;
    const to = String(toStatus).trim().toLowerCase();

    // Skip no-op transitions (same status)
    if (from && from === to) return null;

    return await CompanyStatusHistory.create({
      company_id: companyId,
      from_status: from,
      to_status: to,
      changed_by: changedBy || null,
      change_source: changeSource,
      note: note || null
    });
  } catch (error) {
    console.error('Failed to record company status history:', error.message);
    return null;
  }
};

module.exports = { recordCompanyStatusChange };
