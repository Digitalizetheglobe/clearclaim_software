const { Case, User, Company, Notification } = require('../models');
const { Op, sequelize } = require('sequelize');
const { getTemplateReviewerInclude } = require('../utils/companySchemaFeatures');
const {
  isCaseReassignmentSchemaAvailable,
  getCaseReassignmentIncludes
} = require('../utils/ensureCaseReassignmentSchema');

// Generate unique case ID (CC-YYYY-XXXX format)
const generateCaseId = async () => {
  const currentYear = new Date().getFullYear();
  const yearPrefix = `CC-${currentYear}-`;
  
  // Find the highest case number for this year
  const lastCase = await Case.findOne({
    where: {
      case_id: {
        [Op.like]: `${yearPrefix}%`
      }
    },
    order: [['case_id', 'DESC']]
  });

  let nextNumber = 1;
  if (lastCase) {
    const lastNumber = parseInt(lastCase.case_id.split('-')[2]);
    nextNumber = lastNumber + 1;
  }

  // Format: CC-2025-0001, CC-2025-0002, etc.
  return `${yearPrefix}${nextNumber.toString().padStart(4, '0')}`;
};

const getUserRoles = (user) => {
  if (!user?.role) return [];
  return Array.isArray(user.role) ? user.role : [user.role];
};

// Get all cases with optional filters
const getAllCases = async (req, res) => {
  try {
    const { status, assigned_to, created_by, unassigned, lost, page = 1, limit = 1000 } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (created_by) whereClause.created_by = created_by;

    // Lost / unowned cases: no assigned employee
    if (unassigned === 'true' || lost === 'true') {
      whereClause.assigned_to = { [Op.is]: null };
    } else if (assigned_to === 'null' || assigned_to === 'unassigned') {
      whereClause.assigned_to = { [Op.is]: null };
    } else if (assigned_to) {
      whereClause.assigned_to = assigned_to;
    }

    const offset = (page - 1) * limit;
    
    const cases = await Case.findAndCountAll({
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
          attributes: ['id', 'company_name', 'status', 'created_at', 'assigned_to', 'template_reviewer_id'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            },
            getTemplateReviewerInclude(User)
          ].filter(Boolean)
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      cases: cases.rows,
      total: cases.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(cases.count / limit)
    });
  } catch (error) {
    console.error('Get cases error:', error);
    res.status(500).json({ error: 'Failed to fetch cases.' });
  }
};

// Get case by ID
const getCaseById = async (req, res) => {
  try {
    const caseId = req.params.id;
    const caseData = await Case.findByPk(caseId, {
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
          attributes: ['id', 'company_name', 'status', 'created_at', 'assigned_to', 'template_reviewer_id'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            },
            getTemplateReviewerInclude(User)
          ].filter(Boolean)
        }
      ]
    });

    if (!caseData) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    res.json({ case: caseData });
  } catch (error) {
    console.error('Get case error:', error);
    res.status(500).json({ error: 'Failed to fetch case.' });
  }
};

// Create new case
const createCase = async (req, res) => {
  try {
    const {
      client_name,
      client_mobile,
      client_email,
      case_title,
      deal_id,
      cp_name,
      assigned_to
    } = req.body;

    // Generate unique case ID
    const case_id = await generateCaseId();

    // Create case
    const newCase = await Case.create({
      case_id,
      client_name,
      client_mobile,
      client_email,
      case_title,
      deal_id,
      cp_name,
      status: 'pending',
      created_by: req.user.id,
      assigned_to
    });

    // Fetch the created case with user details
    const createdCase = await Case.findByPk(newCase.id, {
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
        }
      ]
    });

    res.status(201).json({
      message: 'Case created successfully',
      case: createdCase
    });
  } catch (error) {
    console.error('Create case error:', error);
    res.status(500).json({ error: 'Failed to create case.' });
  }
};

const ALLOWED_CASE_STATUSES = ['pending', 'assigned', 'in_review', 'completed'];

const normalizeAssignedTo = (assigned_to) => {
  if (assigned_to === undefined) return undefined;
  if (assigned_to === null || assigned_to === '') return null;
  if (typeof assigned_to === 'object' && assigned_to !== null) {
    const id = assigned_to.id;
    return id == null ? null : parseInt(id, 10);
  }
  const parsed = parseInt(assigned_to, 10);
  return Number.isNaN(parsed) ? null : parsed;
};

// Update case
const updateCase = async (req, res) => {
  try {
    const caseId = req.params.id;
    const {
      client_name,
      client_mobile,
      client_email,
      case_title,
      deal_id,
      cp_name,
      status,
      assigned_to
    } = req.body;

    const caseData = await Case.findByPk(caseId);

    if (!caseData) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    const roles = getUserRoles(req.user);
    const isAdmin = roles.includes('admin');
    const isSuperAdmin = roles.includes('super_admin');
    const isAssignee = caseData.assigned_to != null && Number(caseData.assigned_to) === Number(req.user.id);

    // Super admin: assign/reassign + change case status (not full case field edit like admin)
    if (isSuperAdmin && !isAdmin) {
      const tryingOtherFields =
        client_name !== undefined ||
        client_mobile !== undefined ||
        client_email !== undefined ||
        case_title !== undefined ||
        deal_id !== undefined ||
        cp_name !== undefined;

      if (tryingOtherFields) {
        return res.status(403).json({
          error: 'Super admin can assign/reassign cases and change case status only.'
        });
      }
    } else if (!isAdmin && !isAssignee && !isSuperAdmin) {
      return res.status(403).json({ error: 'Access denied. Insufficient permissions to update this case.' });
    }

    if (status !== undefined && !ALLOWED_CASE_STATUSES.includes(status)) {
      return res.status(400).json({
        error: `Invalid case status "${status}". Allowed values: ${ALLOWED_CASE_STATUSES.join(', ')}.`
      });
    }

    const updateFields = {};
    if (isAdmin || isAssignee) {
      if (client_name !== undefined) updateFields.client_name = client_name;
      if (client_mobile !== undefined) updateFields.client_mobile = client_mobile;
      if (client_email !== undefined) updateFields.client_email = client_email;
      if (case_title !== undefined) updateFields.case_title = case_title;
      if (deal_id !== undefined) updateFields.deal_id = deal_id;
      if (cp_name !== undefined) updateFields.cp_name = cp_name;
    }

    const normalizedAssignedTo = normalizeAssignedTo(assigned_to);
    if (normalizedAssignedTo !== undefined) {
      if (isAdmin || isSuperAdmin || (isAssignee && normalizedAssignedTo === null)) {
        const previousAssigneeId = caseData.assigned_to != null ? Number(caseData.assigned_to) : null;
        const isChangingOwner =
          normalizedAssignedTo != null &&
          previousAssigneeId != null &&
          Number(normalizedAssignedTo) !== previousAssigneeId;

        updateFields.assigned_to = normalizedAssignedTo;

        // Track reassignment so previous employee still sees a disabled case card
        if (isChangingOwner && (isSuperAdmin || isAdmin) && isCaseReassignmentSchemaAvailable()) {
          updateFields.previous_assigned_to = previousAssigneeId;
          updateFields.reassigned_by = req.user.id;
          updateFields.reassigned_at = new Date();
        } else if (normalizedAssignedTo != null && previousAssigneeId == null) {
          // Fresh assignment from lost/unowned — clear stale reassignment markers for new owner view
          // Keep previous_assigned_to if we want history; leave as-is unless nulling intentionally
        }

        // Assign / reassign: ensure status is assigned when giving the case an owner
        if (normalizedAssignedTo != null) {
          if (status !== undefined && ALLOWED_CASE_STATUSES.includes(status)) {
            updateFields.status = status;
          } else if (caseData.status === 'pending' || caseData.assigned_to == null) {
            updateFields.status = 'assigned';
          }
        } else if ((isAdmin || isSuperAdmin) && status !== undefined) {
          updateFields.status = status;
        }

        await caseData.update(updateFields);

        // Notify previous employee + new employee when Super Admin / Admin reassigns
        if (isChangingOwner && (isSuperAdmin || isAdmin)) {
          try {
            const [newEmployee, actor] = await Promise.all([
              User.findByPk(normalizedAssignedTo, { attributes: ['id', 'name', 'email'] }),
              User.findByPk(req.user.id, { attributes: ['id', 'name', 'email'] }),
            ]);
            const actorLabel = isSuperAdmin ? 'Super Admin' : 'Admin';
            const actorName = actor?.name || actorLabel;
            const newName = newEmployee?.name || 'another employee';

            if (previousAssigneeId) {
              await Notification.create({
                user_id: previousAssigneeId,
                case_id: caseData.id,
                type: 'case_reassigned',
                title: 'Case reassigned',
                message: `Case ${caseData.case_id} ("${caseData.case_title}") was reassigned to ${newName} by ${actorLabel} (${actorName}). This case is no longer active for you.`,
                metadata: {
                  case_id: caseData.case_id,
                  case_db_id: caseData.id,
                  previous_assigned_to: previousAssigneeId,
                  new_assigned_to: normalizedAssignedTo,
                  new_assigned_name: newName,
                  reassigned_by: req.user.id,
                  reassigned_by_name: actorName,
                  reassigned_by_role: isSuperAdmin ? 'super_admin' : 'admin',
                },
              });
            }

            await Notification.create({
              user_id: normalizedAssignedTo,
              case_id: caseData.id,
              type: 'case_reassigned',
              title: 'Case assigned to you',
              message: `Case ${caseData.case_id} ("${caseData.case_title}") was assigned to you by ${actorLabel} (${actorName}).`,
              metadata: {
                case_id: caseData.case_id,
                case_db_id: caseData.id,
                previous_assigned_to: previousAssigneeId,
                new_assigned_to: normalizedAssignedTo,
                reassigned_by: req.user.id,
                reassigned_by_name: actorName,
                reassigned_by_role: isSuperAdmin ? 'super_admin' : 'admin',
              },
            });
          } catch (notifyErr) {
            console.warn('Reassignment notification skipped:', notifyErr.message);
          }
        }

        // Fetch updated case with user details
        const updatedCase = await Case.findByPk(caseId, {
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
            ...getCaseReassignmentIncludes(User)
          ]
        });

        return res.json({
          message: 'Case updated successfully',
          case: updatedCase
        });
      } else {
        return res.status(403).json({ error: 'You cannot reassign this case.' });
      }
    } else if ((isAdmin || isAssignee || isSuperAdmin) && status !== undefined) {
      updateFields.status = status;
    }

    if (Object.keys(updateFields).length === 0) {
      return res.status(400).json({ error: 'No valid fields provided to update.' });
    }

    await caseData.update(updateFields);

    // Fetch updated case with user details
    const updatedCase = await Case.findByPk(caseId, {
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
        }
      ]
    });

    res.json({
      message: 'Case updated successfully',
      case: updatedCase
    });
  } catch (error) {
    console.error('Update case error:', error);
    res.status(500).json({ error: 'Failed to update case.' });
  }
};

// Delete case with cascading deletes
const deleteCase = async (req, res) => {
  try {
    const caseId = req.params.caseId || req.params.id; // Support both route patterns
    console.log(`🔍 Delete case request - params:`, req.params);
    console.log(`🔍 Attempting to delete case with ID: ${caseId}`);
    
    const caseData = await Case.findByPk(caseId);

    if (!caseData) {
      console.log(`❌ Case with ID ${caseId} not found in database`);
      return res.status(404).json({ error: 'Case not found.' });
    }

    console.log(`🗑️ Starting cascading delete for case ${caseId}`);

    // Get all companies for this case first
    const { Company, CompanyValue, CaseValue, Claimant, CompanyTemplate, CompanyNote, Notification } = require('../models');
    
    const companies = await Company.findAll({
      where: { case_id: caseId }
    });

    console.log(`Found ${companies.length} companies to delete`);

    // Delete all related data for each company
    for (const company of companies) {
      console.log(`Deleting data for company ${company.id}`);
      
      // Delete company templates
      await CompanyTemplate.destroy({
        where: { company_id: company.id }
      });

      // Delete claimants
      await Claimant.destroy({
        where: { company_id: company.id }
      });

      // Delete company values
      await CompanyValue.destroy({
        where: { company_id: company.id }
      });

      // Delete company notes
      await CompanyNote.destroy({
        where: { company_id: company.id }
      });

      // Delete company-linked notifications
      await Notification.destroy({
        where: { company_id: company.id }
      });

      // Delete the company
      await company.destroy();
    }

    // Delete remaining case-level notifications
    await Notification.destroy({
      where: { case_id: caseId }
    });

    // Delete case values
    const deletedCaseValues = await CaseValue.destroy({
      where: { case_id: caseId }
    });
    console.log(`Deleted ${deletedCaseValues} case values`);

    // Finally delete the case
    await caseData.destroy();

    console.log(`✅ Successfully deleted case ${caseId} and all related data`);

    res.json({ 
      message: 'Case and all related data deleted successfully',
      deletedCompanies: companies.length,
      deletedCaseValues: deletedCaseValues
    });
  } catch (error) {
    console.error('Delete case error:', error);
    res.status(500).json({ error: 'Failed to delete case.' });
  }
};

// Get case statistics
const getCaseStats = async (req, res) => {
  try {
    const stats = await Case.findAll({
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status']
    });

    const total = await Case.count();
    const result = stats.map(item => ({
      status: item.status,
      count: parseInt(item.dataValues.count),
      percentage: Math.round((parseInt(item.dataValues.count) / total) * 100)
    }));

    res.json({ stats: result, total });
  } catch (error) {
    console.error('Case stats error:', error);
    res.status(500).json({ error: 'Failed to fetch case statistics.' });
  }
};

// Get cases assigned to the current logged-in user
// Also returns cases Super Admin reassigned away from this user (disabled view)
const getMyAssignedCases = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;

    const caseIncludes = [
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
      ...getCaseReassignmentIncludes(User),
      {
        model: Company,
        as: 'companies',
        attributes: ['id', 'company_name', 'status', 'created_at'],
        include: [
          {
            model: User,
            as: 'assignedUser',
            attributes: ['id', 'name', 'email']
          }
        ]
      }
    ];

    const activeWhere = { assigned_to: userId };
    if (status) activeWhere.status = status;

    const reassignmentColumnsReady = isCaseReassignmentSchemaAvailable();

    // Reassigned away: still show as disabled for the previous employee
    const reassignedAwayWhere = {
      previous_assigned_to: userId,
      assigned_to: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: userId }] }
    };

    const [activeCases, reassignedAwayCases] = await Promise.all([
      Case.findAndCountAll({
        where: activeWhere,
        include: caseIncludes,
        order: [['created_at', 'DESC']],
        limit: parseInt(limit),
        offset: parseInt(offset)
      }),
      // Load reassigned-away without pagination offset so they always appear for awareness
      reassignmentColumnsReady
        ? Case.findAll({
            where: reassignedAwayWhere,
            include: caseIncludes,
            order: [['reassigned_at', 'DESC']],
            limit: 50
          })
        : Promise.resolve([])
    ]);

    const formatCase = (caseItem, isReassignedAway = false) => ({
      id: caseItem.id,
      case_id: caseItem.case_id,
      case_title: caseItem.case_title,
      client_name: caseItem.client_name,
      client_email: caseItem.client_email,
      client_mobile: caseItem.client_mobile,
      status: caseItem.status,
      priority: caseItem.priority,
      estimated_completion_date: caseItem.estimated_completion_date,
      actual_completion_date: caseItem.actual_completion_date,
      created_at: caseItem.created_at,
      updated_at: caseItem.updated_at,
      assigned_to: caseItem.assigned_to,
      previous_assigned_to: caseItem.previous_assigned_to,
      reassigned_by: caseItem.reassigned_by,
      reassigned_at: caseItem.reassigned_at,
      created_by_user: caseItem.createdByUser,
      assigned_user: caseItem.assignedUser,
      previous_assigned_user: caseItem.previousAssignedUser,
      reassigned_by_user: caseItem.reassignedByUser,
      companies: caseItem.companies || [],
      is_reassigned_away: isReassignedAway,
      reassignment_message: isReassignedAway
        ? `This case was assigned to ${caseItem.assignedUser?.name || 'another employee'} by Super Admin${
            caseItem.reassignedByUser?.name ? ` (${caseItem.reassignedByUser.name})` : ''
          }. It is no longer active for you.`
        : null
    });

    const formattedActive = activeCases.rows.map((c) => formatCase(c, false));
    const activeIds = new Set(formattedActive.map((c) => c.id));
    const formattedReassigned = reassignedAwayCases
      .filter((c) => !activeIds.has(c.id))
      .map((c) => formatCase(c, true));

    // Active cases first, then disabled reassigned-away cases
    const formattedCases = [...formattedActive, ...formattedReassigned];

    res.json({
      cases: formattedCases,
      total: activeCases.count,
      reassignedAwayCount: formattedReassigned.length,
      currentPage: parseInt(page),
      totalPages: Math.ceil(activeCases.count / limit) || 1,
      message: 'Assigned cases fetched successfully'
    });
  } catch (error) {
    console.error('Get my assigned cases error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned cases.' });
  }
};

// Get print-ready cases (all templates and companies have status 'done'/'completed')
const getPrintReadyCases = async (req, res) => {
  try {
    const { Company, CompanyTemplate } = require('../models');
    
    // Get all completed cases
    const completedCases = await Case.findAll({
      where: {
        status: 'completed'
      },
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
          attributes: ['id', 'company_name', 'status', 'created_at'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            },
            {
              model: CompanyTemplate,
              as: 'companyTemplates',
              attributes: ['id', 'template_name', 'template_category', 'review_status', 'is_selected'],
              required: false
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']]
    });

    // Filter cases where:
    // 1. All companies have status 'completed'
    // 2. All selected templates have review_status 'done'
    const printReadyCases = completedCases.filter(caseItem => {
      // Check if case has companies
      if (!caseItem.companies || caseItem.companies.length === 0) {
        return false;
      }

      // Check if all companies are completed
      const allCompaniesCompleted = caseItem.companies.every(
        company => company.status === 'completed'
      );

      if (!allCompaniesCompleted) {
        return false;
      }

      // Check if all selected templates have review_status 'done'
      for (const company of caseItem.companies) {
        const allTemplates = company.companyTemplates || [];
        
        // Filter to only selected templates
        const selectedTemplates = allTemplates.filter(t => t.is_selected === true);
        
        // If company has no selected templates, skip it (or consider it not ready)
        if (selectedTemplates.length === 0) {
          return false;
        }

        // Check if all selected templates are 'done'
        const allTemplatesDone = selectedTemplates.every(
          template => template.review_status === 'done'
        );

        if (!allTemplatesDone) {
          return false;
        }
      }

      return true;
    });

    // Format the response
    const formattedCases = printReadyCases.map(caseItem => ({
      id: caseItem.id,
      case_id: caseItem.case_id,
      case_title: caseItem.case_title,
      client_name: caseItem.client_name,
      client_email: caseItem.client_email,
      client_mobile: caseItem.client_mobile,
      status: caseItem.status,
      created_at: caseItem.created_at,
      updated_at: caseItem.updated_at,
      created_by_user: caseItem.createdByUser,
      assigned_user: caseItem.assignedUser,
      companies: caseItem.companies.map(company => {
        const allTemplates = company.companyTemplates || [];
        const selectedTemplates = allTemplates.filter(t => t.is_selected === true);
        return {
          id: company.id,
          company_name: company.company_name,
          status: company.status,
          created_at: company.created_at,
          templates_count: selectedTemplates.length,
          templates: selectedTemplates.map(t => ({
            id: t.id,
            template_name: t.template_name,
            template_category: t.template_category,
            review_status: t.review_status
          }))
        };
      })
    }));

    res.json({
      cases: formattedCases,
      total: formattedCases.length,
      message: 'Print-ready cases fetched successfully'
    });
  } catch (error) {
    console.error('Get print-ready cases error:', error);
    res.status(500).json({ error: 'Failed to fetch print-ready cases.' });
  }
};

module.exports = {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getCaseStats,
  getMyAssignedCases,
  getPrintReadyCases
};
