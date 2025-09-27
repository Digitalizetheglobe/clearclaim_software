const { Case, User, Company } = require('../models');
const { Op, sequelize } = require('sequelize');

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

// Get all cases with optional filters
const getAllCases = async (req, res) => {
  try {
    const { status, assigned_to, created_by, page = 1, limit = 10 } = req.query;
    
    const whereClause = {};
    if (status) whereClause.status = status;
    if (assigned_to) whereClause.assigned_to = assigned_to;
    if (created_by) whereClause.created_by = created_by;

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
          attributes: ['id', 'company_name', 'status', 'created_at'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            }
          ]
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
          attributes: ['id', 'company_name', 'status', 'created_at'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            }
          ]
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

    // Update case
    await caseData.update({
      client_name,
      client_mobile,
      client_email,
      case_title,
      deal_id,
      cp_name,
      status,
      assigned_to
    });

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
    const { Company, CompanyValue, CaseValue, Claimant, CompanyTemplate } = require('../models');
    
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

      // Delete the company
      await company.destroy();
    }

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
const getMyAssignedCases = async (req, res) => {
  try {
    const userId = req.user.id; // From auth middleware
    
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    const whereClause = { assigned_to: userId };
    if (status) whereClause.status = status;

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
          attributes: ['id', 'company_name', 'status', 'created_at'],
          include: [
            {
              model: User,
              as: 'assignedUser',
              attributes: ['id', 'name', 'email']
            }
          ]
        }
      ],
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    // Format the response
    const formattedCases = cases.rows.map(caseItem => ({
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
      created_by_user: caseItem.createdByUser,
      assigned_user: caseItem.assignedUser,
      companies: caseItem.companies || []
    }));

    res.json({
      cases: formattedCases,
      total: cases.count,
      currentPage: parseInt(page),
      totalPages: Math.ceil(cases.count / limit),
      message: 'Assigned cases fetched successfully'
    });
  } catch (error) {
    console.error('Get my assigned cases error:', error);
    res.status(500).json({ error: 'Failed to fetch assigned cases.' });
  }
};

module.exports = {
  getAllCases,
  getCaseById,
  createCase,
  updateCase,
  deleteCase,
  getCaseStats,
  getMyAssignedCases
};
