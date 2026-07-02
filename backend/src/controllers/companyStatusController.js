const { CompanyStatus, Company, Case } = require('../models');

const DEFAULT_STATUSES = [
  { name: 'Excel Preparation', value: 'excel_preparation', color: '#2563eb', deadline_days: 2 },
  { name: 'Excel Review', value: 'excel_review', color: '#0ea5e9', deadline_days: 1 },
  { name: 'Excel Rectification', value: 'excel_rectification', color: '#f59e0b', deadline_days: 1 },
  { name: 'Form Generation', value: 'form_generation', color: '#7c3aed', deadline_days: 1 },
  { name: 'Digital Forms Review', value: 'digital_forms_review', color: '#8b5cf6', deadline_days: 1 },
  { name: 'Form Printing', value: 'form_printing', color: '#6366f1', deadline_days: 1 },
  { name: 'Legal Docs Prep', value: 'legal_docs_prep', color: '#0891b2', deadline_days: 3 },
  { name: 'Claim Docket Prep', value: 'claim_docket_prep', color: '#06b6d4', deadline_days: 1 },
  { name: 'Hard Copy Review', value: 'hard_copy_review', color: '#9333ea', deadline_days: 1 },
  { name: 'Hard Copy Rectification', value: 'hard_copy_rectification', color: '#f97316', deadline_days: 1 },
  { name: 'Envelop Preparation', value: 'envelop_preparation', color: '#0284c7', deadline_days: 1 },
  { name: 'In Transit - Client', value: 'in_transit_client', color: '#14b8a6', deadline_days: 5 },
  { name: 'Client Docket Review', value: 'client_docket_review', color: '#2563eb', deadline_days: 3 },
  { name: 'In Transit - RTA', value: 'in_transit_rta', color: '#0d9488', deadline_days: 5 },
  { name: 'Call RTA - Inward', value: 'call_rta_inward', color: '#3b82f6', deadline_days: 3 },
  { name: 'POH Received', value: 'poh_received', color: '#16a34a', deadline_days: 2 },
  { name: 'LOC Received', value: 'loc_received', color: '#22c55e', deadline_days: 2 },
  { name: 'LOE Received', value: 'loe_received', color: '#4ade80', deadline_days: 2 },
  { name: 'DRF - Form Filling', value: 'drf_form_filling', color: '#7c3aed', deadline_days: 1 },
  { name: 'DRF - Hard Copy Review', value: 'drf_hard_copy_review', color: '#6d28d9', deadline_days: 1 },
  { name: 'In Transit - DP', value: 'in_transit_dp', color: '#14b8a6', deadline_days: 5 },
  { name: 'IEPF - Form Filling', value: 'iepf_form_filling', color: '#8b5cf6', deadline_days: 1 },
  { name: 'IEPF - Hard Copy Review', value: 'iepf_hard_copy_review', color: '#7e22ce', deadline_days: 1 },
  { name: 'IEPF - Legal Docs Prep', value: 'iepf_legal_docs_prep', color: '#0f766e', deadline_days: 3 },
  { name: 'In Transit - Company', value: 'in_transit_company', color: '#0d9488', deadline_days: 5 },
  { name: 'IEPF - Pending Receipt Upload', value: 'iepf_pending_receipt_upload', color: '#f59e0b', deadline_days: 1 },
  { name: 'With Authorities', value: 'with_authorities', color: '#dc2626', deadline_days: 45 },
  { name: 'Blocked', value: 'blocked', color: '#6b7280', deadline_days: 0 },
  { name: 'Resolved - IEPF', value: 'resolved_iepf', color: '#16a34a', deadline_days: 180 },
  { name: 'Resolved - DRF', value: 'resolved_drf', color: '#15803d', deadline_days: 45 },
  { name: 'Closed', value: 'closed', color: '#1f2937', deadline_days: 0 }
];

const toStatusValue = (input) =>
  String(input || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const ensureDefaults = async () => {
  for (const status of DEFAULT_STATUSES) {
    await CompanyStatus.findOrCreate({
      where: { value: status.value },
      defaults: status
    });
  }
};

const getCompanyStatuses = async (req, res) => {
  try {
    await ensureDefaults();

    const includeInactive = req.query.include_inactive === 'true';
    const where = includeInactive ? {} : { is_active: true };

    const statuses = await CompanyStatus.findAll({
      where,
      order: [
        ['is_active', 'DESC'],
        ['name', 'ASC']
      ]
    });

    res.json({ statuses });
  } catch (error) {
    console.error('Error fetching company statuses:', error);
    res.status(500).json({ error: 'Failed to fetch company statuses' });
  }
};

const createCompanyStatus = async (req, res) => {
  try {
    const { name, value, color, deadline_days } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedValue = toStatusValue(value || name);
    const normalizedDeadlineDays =
      deadline_days === undefined || deadline_days === null || deadline_days === ''
        ? 0
        : parseInt(deadline_days, 10);

    if (!normalizedName) {
      return res.status(400).json({ error: 'Status name is required' });
    }

    if (!normalizedValue) {
      return res.status(400).json({ error: 'Valid status value is required' });
    }

    if (Number.isNaN(normalizedDeadlineDays) || normalizedDeadlineDays < 0) {
      return res.status(400).json({ error: 'deadline_days must be a number greater than or equal to 0' });
    }

    const exists = await CompanyStatus.findOne({ where: { value: normalizedValue } });
    if (exists) {
      return res.status(400).json({ error: 'Status already exists' });
    }

    const status = await CompanyStatus.create({
      name: normalizedName,
      value: normalizedValue,
      color: color || '#6b7280',
      deadline_days: normalizedDeadlineDays,
      is_active: true,
      created_by: req.user.id
    });

    res.status(201).json({
      message: 'Company status created successfully',
      status
    });
  } catch (error) {
    console.error('Error creating company status:', error);
    res.status(500).json({ error: 'Failed to create company status' });
  }
};

const updateCompanyStatusMaster = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, color, is_active, deadline_days } = req.body;

    const status = await CompanyStatus.findByPk(id);
    if (!status) {
      return res.status(404).json({ error: 'Company status not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (color !== undefined) updateData.color = color;
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);
    if (deadline_days !== undefined) {
      const parsed = parseInt(deadline_days, 10);
      if (Number.isNaN(parsed) || parsed < 0) {
        return res.status(400).json({ error: 'deadline_days must be a number greater than or equal to 0' });
      }
      updateData.deadline_days = parsed;
    }

    await status.update(updateData);

    res.json({
      message: 'Company status updated successfully',
      status
    });
  } catch (error) {
    console.error('Error updating company status:', error);
    res.status(500).json({ error: 'Failed to update company status' });
  }
};

const getCompanyStatusUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await CompanyStatus.findByPk(id);

    if (!status) {
      return res.status(404).json({ error: 'Company status not found' });
    }

    const companies = await Company.findAll({
      where: { status: status.value },
      attributes: ['id', 'company_name', 'case_id'],
      include: [
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'case_id', 'case_title', 'client_name'],
          required: false
        }
      ],
      order: [['id', 'DESC']],
      limit: 20
    });

    const usageCount = await Company.count({
      where: { status: status.value }
    });

    res.json({
      status: {
        id: status.id,
        name: status.name,
        value: status.value
      },
      usageCount,
      companies
    });
  } catch (error) {
    console.error('Error fetching company status usage:', error);
    res.status(500).json({ error: 'Failed to fetch status usage' });
  }
};

const reassignCompanyStatusUsage = async (req, res) => {
  try {
    const { id } = req.params;
    const { new_status_value } = req.body;

    const fromStatus = await CompanyStatus.findByPk(id);
    if (!fromStatus) {
      return res.status(404).json({ error: 'Source status not found' });
    }

    const toStatusValue = String(new_status_value || '').trim().toLowerCase();
    if (!toStatusValue) {
      return res.status(400).json({ error: 'new_status_value is required' });
    }

    if (toStatusValue === fromStatus.value) {
      return res.status(400).json({ error: 'Please select a different status for reassignment' });
    }

    const toStatus = await CompanyStatus.findOne({
      where: { value: toStatusValue, is_active: true }
    });
    if (!toStatus) {
      return res.status(400).json({ error: 'Target status not found or inactive' });
    }

    const [updatedCount] = await Company.update(
      { status: toStatus.value },
      { where: { status: fromStatus.value } }
    );

    res.json({
      message: 'Companies reassigned successfully',
      updatedCount,
      fromStatus: { id: fromStatus.id, name: fromStatus.name, value: fromStatus.value },
      toStatus: { id: toStatus.id, name: toStatus.name, value: toStatus.value }
    });
  } catch (error) {
    console.error('Error reassigning company status usage:', error);
    res.status(500).json({ error: 'Failed to reassign companies to new status' });
  }
};

const deleteCompanyStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const status = await CompanyStatus.findByPk(id);

    if (!status) {
      return res.status(404).json({ error: 'Company status not found' });
    }

    const inUseCount = await Company.count({ where: { status: status.value } });
    if (inUseCount > 0) {
      return res.status(400).json({
        error: `Cannot delete status. It is used by ${inUseCount} compan${inUseCount === 1 ? 'y' : 'ies'}.`
      });
    }

    await status.destroy();

    res.json({ message: 'Company status deleted successfully' });
  } catch (error) {
    console.error('Error deleting company status:', error);
    res.status(500).json({ error: 'Failed to delete company status' });
  }
};

module.exports = {
  getCompanyStatuses,
  createCompanyStatus,
  updateCompanyStatusMaster,
  getCompanyStatusUsage,
  reassignCompanyStatusUsage,
  deleteCompanyStatus
};
