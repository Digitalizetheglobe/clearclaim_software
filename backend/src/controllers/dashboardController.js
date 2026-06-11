const { Company, Case, User } = require('../models');
const { Op } = require('sequelize');
const { isTemplateReviewerColumnAvailable } = require('../utils/companySchemaFeatures');

const DASHBOARD_FILTERS = {
  active_folios: {
    title: 'Active Folios',
    description: 'Companies that are active or in progress',
    entity: 'company',
    statuses: ['active', 'in_progress']
  },
  with_authorities: {
    title: 'With Authorities',
    description: 'Companies submitted to or pending with authorities',
    entity: 'company',
    statuses: ['with_authorities', 'authority_review']
  },
  under_review: {
    title: 'Under Review',
    description: 'Companies pending or currently in data review',
    entity: 'company',
    statuses: ['pending', 'in_review']
  },
  excel_rectification: {
    title: 'Excel Rectification',
    description: 'Cases that need Excel data corrections',
    entity: 'case',
    statuses: ['returned', 'rejected', 'needs_excel_rectification']
  },
  template_rectification: {
    title: 'Templates Rectification',
    description: 'Companies that need template corrections',
    entity: 'company',
    statuses: ['returned', 'rejected', 'needs_template_rectification']
  },
  completed: {
    title: 'Completed Folios',
    description: 'Companies marked as completed',
    entity: 'company',
    statuses: ['completed']
  },
  total: {
    title: 'All Folios',
    description: 'All companies across every status',
    entity: 'company',
    statuses: null
  },
  pending_attention: {
    title: 'Folios Pending Attention',
    description: 'Companies in active workflow needing attention (SLA / ageing) — excludes pending and completed',
    entity: 'company',
    excludeStatuses: ['completed', 'pending']
  },
  active_cases: {
    title: 'Active Cases',
    description: 'Cases that are active, in progress, or in review',
    entity: 'case',
    statuses: ['pending', 'assigned', 'in_review']
  },
  completed_cases: {
    title: 'Completed Cases',
    description: 'Cases marked as completed',
    entity: 'case',
    statuses: ['completed']
  },
  total_cases: {
    title: 'All Cases',
    description: 'All cases in the system',
    entity: 'case',
    statuses: null
  }
};

const getUserRoles = (user) => {
  if (!user?.role) return [];
  return Array.isArray(user.role) ? user.role : [user.role];
};

const isAdminUser = (user) => getUserRoles(user).includes('admin');

const getUserId = (user) => parseInt(user?.id, 10);

const buildCaseUserScope = (userId) => ({
  [Op.or]: [
    { assigned_to: userId },
    { created_by: userId }
  ]
});

const getScopedCaseIds = async (userId) => {
  const cases = await Case.findAll({
    where: buildCaseUserScope(userId),
    attributes: ['id']
  });
  return cases.map((caseItem) => caseItem.id);
};

const buildCompanyUserScope = async (userId) => {
  const caseIds = await getScopedCaseIds(userId);
  const conditions = [
    { assigned_to: userId },
    { created_by: userId }
  ];

  if (isTemplateReviewerColumnAvailable()) {
    conditions.splice(1, 0, { template_reviewer_id: userId });
  }

  if (caseIds.length > 0) {
    conditions.push({ case_id: { [Op.in]: caseIds } });
  }

  return { [Op.or]: conditions };
};

const getDashboardDetails = async (req, res) => {
  try {
    const { filter } = req.params;
    const config = DASHBOARD_FILTERS[filter];

    if (!config) {
      return res.status(400).json({
        error: 'Invalid dashboard filter',
        validFilters: Object.keys(DASHBOARD_FILTERS)
      });
    }

    const isAdmin = isAdminUser(req.user);
    const userId = getUserId(req.user);

    if (config.entity === 'company') {
      const whereClause = {};

      if (!isAdmin && userId) {
        Object.assign(whereClause, await buildCompanyUserScope(userId));
      }

      if (config.excludeStatuses?.length) {
        whereClause.status = { [Op.notIn]: config.excludeStatuses };
      } else if (config.excludeCompleted) {
        whereClause.status = { [Op.ne]: 'completed' };
      } else if (config.statuses?.length) {
        whereClause.status = { [Op.in]: config.statuses };
      }

      const companies = await Company.findAll({
        where: whereClause,
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'name', 'email']
          },
          {
            model: User,
            as: 'createdByUser',
            attributes: ['id', 'name', 'email']
          },
          {
            model: Case,
            as: 'case',
            attributes: ['id', 'case_id', 'case_title', 'client_name', 'status']
          }
        ],
        order: [['updatedAt', 'DESC']]
      });

      return res.json({
        filter,
        title: config.title,
        description: config.description,
        entity: 'company',
        items: companies,
        total: companies.length
      });
    }

    const whereClause = {};
    if (!isAdmin && userId) {
      Object.assign(whereClause, buildCaseUserScope(userId));
    }

    const cases = await Case.findAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'createdByUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        },
        {
          model: Company,
          as: 'companies',
          attributes: ['id', 'company_name', 'status'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    const filteredCases = config.statuses?.length
      ? cases.filter((item) => config.statuses.includes(item.status))
      : cases;

    return res.json({
      filter,
      title: config.title,
      description: config.description,
      entity: 'case',
      items: filteredCases,
      total: filteredCases.length
    });
  } catch (error) {
    console.error('Dashboard details error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard details' });
  }
};

const getDashboardFilterList = async (req, res) => {
  res.json({
    filters: Object.entries(DASHBOARD_FILTERS).map(([key, value]) => ({
      key,
      title: value.title,
      description: value.description,
      entity: value.entity
    }))
  });
};

module.exports = {
  getDashboardDetails,
  getDashboardFilterList,
  DASHBOARD_FILTERS
};
