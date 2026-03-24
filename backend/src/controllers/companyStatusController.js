const { CompanyStatus, Company, Case } = require('../models');

const DEFAULT_STATUSES = [
  { name: 'Pending', value: 'pending', color: '#f59e0b' },
  { name: 'In Progress', value: 'in_progress', color: '#2563eb' },
  { name: 'In Review', value: 'in_review', color: '#7c3aed' },
  { name: 'Completed', value: 'completed', color: '#16a34a' },
  { name: 'Rejected', value: 'rejected', color: '#dc2626' }
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
    const { name, value, color } = req.body;
    const normalizedName = String(name || '').trim();
    const normalizedValue = toStatusValue(value || name);

    if (!normalizedName) {
      return res.status(400).json({ error: 'Status name is required' });
    }

    if (!normalizedValue) {
      return res.status(400).json({ error: 'Valid status value is required' });
    }

    const exists = await CompanyStatus.findOne({ where: { value: normalizedValue } });
    if (exists) {
      return res.status(400).json({ error: 'Status already exists' });
    }

    const status = await CompanyStatus.create({
      name: normalizedName,
      value: normalizedValue,
      color: color || '#6b7280',
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
    const { name, color, is_active } = req.body;

    const status = await CompanyStatus.findByPk(id);
    if (!status) {
      return res.status(404).json({ error: 'Company status not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = String(name).trim();
    if (color !== undefined) updateData.color = color;
    if (is_active !== undefined) updateData.is_active = Boolean(is_active);

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
