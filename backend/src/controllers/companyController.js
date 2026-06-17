const { Company, CompanyValue, CompanyNote, User, Case, CaseField, CompanyTemplate, Notification, CompanyStatus } = require('../models');
const { sequelize } = require('../config/database');
const { Op } = require('sequelize');
const { buildReviewerAssignmentConditions } = require('../utils/reviewAssignment');
const {
  getTemplateReviewerInclude,
  isTemplateReviewerColumnAvailable
} = require('../utils/companySchemaFeatures');

const DEFAULT_COMPANY_STATUSES = [
  { name: 'Pending', value: 'pending', color: '#f59e0b' },
  { name: 'In Progress', value: 'in_progress', color: '#2563eb' },
  { name: 'In Review', value: 'in_review', color: '#7c3aed' },
  { name: 'Completed', value: 'completed', color: '#16a34a' },
  { name: 'Rejected', value: 'rejected', color: '#dc2626' }
];

const ensureCompanyStatusDefaults = async () => {
  for (const status of DEFAULT_COMPANY_STATUSES) {
    await CompanyStatus.findOrCreate({
      where: { value: status.value },
      defaults: status
    });
  }
};

const normalizeCompanyStatus = (status) =>
  String(status || '').toLowerCase().replace(/[\s-]+/g, '_').trim();

const getUserRoles = (user) => {
  if (!user?.role) return [];
  const roles = Array.isArray(user.role) ? user.role : [user.role];
  return roles.map((r) => String(r).toLowerCase().trim());
};

const canEditCompanyInReview = (user, company) => {
  const roles = getUserRoles(user);
  const isReviewer = roles.includes('data_reviewer') || roles.includes('template_reviewer');
  const isAssignedReviewer =
    company.assigned_to != null && Number(company.assigned_to) === Number(user.id);
  return isReviewer && isAssignedReviewer;
};

const isDataOrTemplateReviewerUser = (user) => {
  const roles = getUserRoles(user);
  return roles.includes('data_reviewer') || roles.includes('template_reviewer');
};

const getCompanyOwnerIdsForReview = (company) => {
  const ids = new Set();
  [company.assigned_to, company.created_by].forEach((id) => {
    if (id != null && id !== '') ids.add(Number(id));
  });
  return ids;
};

const fetchEligibleDataReviewers = async (company) => {
  const allUsers = await User.findAll({
    attributes: ['id', 'name', 'email', 'role']
  });
  const ownerIds = getCompanyOwnerIdsForReview(company);
  return allUsers
    .filter((user) => isDataOrTemplateReviewerUser(user) && !ownerIds.has(Number(user.id)))
    .sort((a, b) => Number(a.id) - Number(b.id));
};

const pickRoundRobinReviewerId = async (eligibleReviewers) => {
  if (!eligibleReviewers.length) return null;
  const eligibleIds = eligibleReviewers.map((r) => Number(r.id));
  if (eligibleIds.length === 1) return eligibleIds[0];

  const lastAssignedCompany = await Company.findOne({
    where: {
      status: 'in_review',
      assigned_to: { [Op.in]: eligibleIds }
    },
    order: [['updated_at', 'DESC']],
    attributes: ['assigned_to']
  });

  if (!lastAssignedCompany?.assigned_to) {
    return eligibleIds[0];
  }

  const lastReviewerId = Number(lastAssignedCompany.assigned_to);
  const lastIndex = eligibleIds.indexOf(lastReviewerId);
  if (lastIndex === -1) return eligibleIds[0];
  return eligibleIds[(lastIndex + 1) % eligibleIds.length];
};

const companyHasWorkData = async (companyId) => {
  const values = await CompanyValue.findAll({
    where: { company_id: companyId },
    attributes: ['field_value']
  });
  return values.some((row) => {
    const value = row.field_value;
    if (value === null || value === undefined) return false;
    return String(value).trim() !== '';
  });
};

// Get all companies (with optional filters)
const getAllCompanies = async (req, res) => {
  try {
    const {
      assigned_to,
      template_reviewer_id,
      status,
      case_id,
      include_rejected_by,
      rejection_type,
      review_type
    } = req.query;
    
    let whereClause = {};
    const reviewerIdForRejections = parseInt(assigned_to || template_reviewer_id, 10);
    
    // If include_rejected_by is true, find companies rejected by this reviewer via notifications
    if (include_rejected_by === 'true' && reviewerIdForRejections) {
      const reviewerId = reviewerIdForRejections;
      
      try {
        const rejectionTypes =
          rejection_type === 'template'
            ? ['template_review_rejected']
            : rejection_type === 'data'
            ? ['data_review_rejected']
            : ['data_review_rejected', 'template_review_rejected'];

        // Find all rejection notifications where this reviewer rejected the company
        const rejectionNotifications = await Notification.findAll({
          where: {
            type: { [Op.in]: rejectionTypes }
          },
          attributes: ['company_id', 'metadata'],
          raw: false // Get Sequelize instances to access metadata properly
        });
        
        // Filter notifications where reviewer_id matches and extract company IDs
        const rejectedCompanyIds = [];
        rejectionNotifications.forEach(notif => {
          try {
            const metadata = notif.metadata;
            if (
              metadata &&
              typeof metadata === 'object' &&
              Number(metadata.reviewer_id) === reviewerId &&
              notif.company_id
            ) {
              rejectedCompanyIds.push(notif.company_id);
            }
          } catch (err) {
            console.warn('Error processing notification metadata:', err);
          }
        });
        
        // Remove duplicates
        const uniqueRejectedIds = [...new Set(rejectedCompanyIds)];
        
        // Build the where clause (segregate data vs template review when review_type is set)
        const assignmentConditions = buildReviewerAssignmentConditions({
          assigned_to,
          template_reviewer_id,
          review_type
        });
        const conditions = assignmentConditions.map((condition) => {
          if (status && status !== 'rejected') {
            return { ...condition, status };
          }
          return condition;
        });
        
        // Add rejected companies condition if any exist
        if (uniqueRejectedIds.length > 0) {
          const rejectedCondition = { 
            id: { [Op.in]: uniqueRejectedIds }, 
            status: 'rejected' 
          };
          if (!status || status === 'rejected') {
            conditions.push(rejectedCondition);
          }
        }
        
        // Combine conditions with OR
        if (conditions.length > 1) {
          whereClause[Op.or] = conditions;
        } else if (conditions.length === 1) {
          Object.assign(whereClause, conditions[0]);
        }
      } catch (notifError) {
        console.error('Error fetching rejection notifications:', notifError);
        // Fallback to assigned / template reviewer filters
        const fallbackConditions = buildReviewerAssignmentConditions({
          assigned_to,
          template_reviewer_id,
          review_type
        });
        if (fallbackConditions.length > 1) {
          whereClause[Op.or] = fallbackConditions;
        } else if (fallbackConditions.length === 1) {
          Object.assign(whereClause, fallbackConditions[0]);
        }
        if (status) whereClause.status = status;
      }
    } else {
      if (assigned_to || template_reviewer_id) {
        const conditions = buildReviewerAssignmentConditions({
          assigned_to,
          template_reviewer_id,
          review_type
        });
        if (conditions.length > 1) {
          whereClause[Op.or] = conditions;
        } else if (conditions.length === 1) {
          Object.assign(whereClause, conditions[0]);
        }
      }
      if (status) whereClause.status = status;
    }
    
    // Apply case_id filter (applies to all conditions)
    if (case_id) whereClause.case_id = parseInt(case_id);
    
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
        getTemplateReviewerInclude(User),
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'case_id', 'case_title', 'client_name']
        }
      ].filter(Boolean),
      order: [['createdAt', 'DESC']]
    });

    // Deduplicate when OR conditions return the same company twice
    const uniqueCompanies = [];
    const seenIds = new Set();
    for (const company of companies) {
      if (!seenIds.has(company.id)) {
        seenIds.add(company.id);
        uniqueCompanies.push(company);
      }
    }

    res.json({ companies: uniqueCompanies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Failed to fetch companies',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Get all companies for a specific case
const getCompaniesByCase = async (req, res) => {
  try {
    const { caseId } = req.params;
    
    const companies = await Company.findAll({
      where: { case_id: caseId },
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ companies });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Failed to fetch companies' });
  }
};

// Create a new company for a case
const createCompany = async (req, res) => {
  try {
    const { case_id, company_name, assigned_to } = req.body;
    const created_by = req.user.id;

    // Check if case exists
    const caseExists = await Case.findByPk(case_id);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found' });
    }

    // Create the company
    const company = await Company.create({
      case_id,
      company_name,
      created_by,
      assigned_to: assigned_to || null
    });

    // Fetch the created company with user details
    const createdCompany = await Company.findByPk(company.id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({ 
      message: 'Company created successfully',
      company: createdCompany 
    });
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Failed to create company' });
  }
};

// Get company details with values
const getCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    const company = await Company.findByPk(companyId, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        },
        getTemplateReviewerInclude(User),
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'case_id', 'case_title', 'client_name']
        }
      ].filter(Boolean)
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json({ company });
  } catch (error) {
    console.error('Error fetching company details:', error);
    res.status(500).json({ error: 'Failed to fetch company details' });
  }
};

// Get company values (case fields for this company)
const getCompanyValues = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Get all case fields
    const caseFields = await CaseField.findAll({
      order: [['field_category', 'ASC'], ['display_order', 'ASC']]
    });

    // Get existing values for this company
    const companyValues = await CompanyValue.findAll({
      where: { company_id: companyId }
    });

    // Create a map of field values and reviewer comments
    const valuesMap = {};
    const commentsMap = {};
    companyValues.forEach(value => {
      valuesMap[value.field_key] = value.field_value;
      if (value.reviewer_comment) {
        commentsMap[value.field_key] = value.reviewer_comment;
      }
    });

    // Combine fields with their values and comments
    const fieldsWithValues = caseFields.map(field => ({
      ...field.toJSON(),
      field_value: valuesMap[field.field_key] || '',
      reviewer_comment: commentsMap[field.field_key] || null
    }));

    res.json({ fields: fieldsWithValues });
  } catch (error) {
    console.error('Error fetching company values:', error);
    res.status(500).json({ error: 'Failed to fetch company values' });
  }
};

// Update company values
const updateCompanyValues = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { field_values } = req.body;
    const last_updated_by = req.user.id;

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (
      normalizeCompanyStatus(company.status) === 'in_review' &&
      !canEditCompanyInReview(req.user, company)
    ) {
      return res.status(403).json({
        error: 'Company is locked while under review. Wait for the reviewer to update the status.'
      });
    }

    // Update or create each field value
    for (const fieldValue of field_values) {
      const { field_key, field_value } = fieldValue;
      
      await CompanyValue.upsert({
        company_id: companyId,
        field_key,
        field_value,
        last_updated_by
      });
    }

    res.json({ message: 'Company values updated successfully' });
  } catch (error) {
    console.error('Error updating company values:', error);
    res.status(500).json({ error: 'Failed to update company values' });
  }
};

// Update company status
const updateCompanyStatus = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { status, assigned_to } = req.body;

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const roles = getUserRoles(req.user);
    const isEmployeeOrSales = roles.includes('employee') || roles.includes('sales');
    if (
      normalizeCompanyStatus(company.status) === 'in_review' &&
      isEmployeeOrSales &&
      !canEditCompanyInReview(req.user, company)
    ) {
      return res.status(403).json({
        error: 'Company status cannot be changed while it is under review.'
      });
    }

    const updateData = {};
    if (status !== undefined) {
      await ensureCompanyStatusDefaults();
      const normalizedStatus = String(status).trim().toLowerCase();
      const validStatus = await CompanyStatus.findOne({
        where: { value: normalizedStatus, is_active: true }
      });

      if (!validStatus) {
        return res.status(400).json({
          error: 'Invalid company status. Please select an active status from admin configuration.'
        });
      }

      updateData.status = normalizedStatus;
    }
    if (assigned_to !== undefined) {
      updateData.assigned_to = assigned_to || null;
    }

    await company.update(updateData);

    // Fetch updated company with user details
    const updatedCompany = await Company.findByPk(companyId, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({ 
      message: 'Company updated successfully',
      company: updatedCompany 
    });
  } catch (error) {
    console.error('Error updating company status:', error);
    res.status(500).json({ error: 'Failed to update company status' });
  }
};

// Delete company
const deleteCompany = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Delete associated company values first
    await CompanyValue.destroy({
      where: { company_id: companyId }
    });

    // Delete the company
    await company.destroy();

    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Failed to delete company' });
  }
};

// Add dynamic joint holder fields
const addJointHolder = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { jointHolderNumber } = req.body; // e.g., 4, 5, 6, etc.
    const last_updated_by = req.user.id;

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Validate joint holder number (should be 4 or higher since C1, C2, C3 already exist)
    if (jointHolderNumber < 4) {
      return res.status(400).json({ 
        error: 'Joint holder number must be 4 or higher (C1, C2, C3 already exist)' 
      });
    }

    const cnSuffix = `C${jointHolderNumber}`;
    
    // Define the field templates for joint holders
    const jointHolderFields = [
      // Personal Information
      { field_key: `Name as per Aadhar ${cnSuffix}`, field_label: `Name as per Aadhar ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 1 },
      { field_key: `Name as per PAN ${cnSuffix}`, field_label: `Name as per PAN ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 2 },
      { field_key: `Name as per CML ${cnSuffix}`, field_label: `Name as per CML ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 3 },
      { field_key: `Name as per Bank ${cnSuffix}`, field_label: `Name as per Bank ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 4 },
      { field_key: `Name as per Passport ${cnSuffix}`, field_label: `Name as per Passport ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 5 },
      { field_key: `Name as per Succession/WILL/LHA ${cnSuffix}`, field_label: `Name as per Succession/WILL/LHA ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 6 },
      { field_key: `Name as per Cert ${cnSuffix}`, field_label: `Name as per Cert ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 7 },
      { field_key: `PAN ${cnSuffix}`, field_label: `PAN ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 8 },
      { field_key: `Mobile No ${cnSuffix}`, field_label: `Mobile No ${cnSuffix}`, field_type: 'phone', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 9 },
      { field_key: `Email ID ${cnSuffix}`, field_label: `Email ID ${cnSuffix}`, field_type: 'email', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 10 },
      { field_key: `DOB ${cnSuffix}`, field_label: `DOB ${cnSuffix}`, field_type: 'date', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 11 },
      { field_key: `Father Name ${cnSuffix}`, field_label: `Father Name ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 12 },
      { field_key: `Age ${cnSuffix}`, field_label: `Age ${cnSuffix}`, field_type: 'number', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 13 },
      { field_key: `Deceased Relation ${cnSuffix}`, field_label: `Deceased Relation ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 14 },
      { field_key: `Address ${cnSuffix}`, field_label: `Address ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 15 },
      { field_key: `PIN ${cnSuffix}`, field_label: `PIN ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 16 },
      { field_key: `Old Address ${cnSuffix}`, field_label: `Old Address ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}`, display_order: 1000 + (jointHolderNumber * 100) + 17 },

      // Banking Information
      { field_key: `Bank AC Type ${cnSuffix}`, field_label: `Bank AC Type ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 18 },
      { field_key: `Bank Name ${cnSuffix}`, field_label: `Bank Name ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 19 },
      { field_key: `Bank AC ${cnSuffix}`, field_label: `Bank AC ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 20 },
      { field_key: `Bank Branch ${cnSuffix}`, field_label: `Bank Branch ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 21 },
      { field_key: `IFSC ${cnSuffix}`, field_label: `IFSC ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 22 },
      { field_key: `Bank Address ${cnSuffix}`, field_label: `Bank Address ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 23 },
      { field_key: `MICR ${cnSuffix}`, field_label: `MICR ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 24 },
      { field_key: `A/C Open Date ${cnSuffix}`, field_label: `A/C Open Date ${cnSuffix}`, field_type: 'date', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 25 },
      { field_key: `Bank City ${cnSuffix}`, field_label: `Bank City ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 26 },
      { field_key: `Bank PIN ${cnSuffix}`, field_label: `Bank PIN ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_banking`, display_order: 1000 + (jointHolderNumber * 100) + 27 },

      // DEMAT Account
      { field_key: `DEMAT AC ${cnSuffix}`, field_label: `DEMAT AC ${cnSuffix}`, field_type: 'text', field_category: `joint_holder_${jointHolderNumber}_demat`, display_order: 1000 + (jointHolderNumber * 100) + 28 },
    ];

    // Create case fields for this joint holder
    const createdFields = [];
    for (const fieldData of jointHolderFields) {
      const [field, created] = await CaseField.findOrCreate({
        where: { field_key: fieldData.field_key },
        defaults: fieldData
      });
      
      if (created) {
        createdFields.push(field);
      }
    }

    // Create empty company values for this joint holder
    const companyValues = [];
    for (const field of jointHolderFields) {
      const companyValue = await CompanyValue.create({
        company_id: companyId,
        field_key: field.field_key,
        field_value: '',
        last_updated_by
      });
      companyValues.push(companyValue);
    }

    res.status(201).json({
      message: `Joint Holder ${jointHolderNumber} added successfully`,
      jointHolderNumber,
      fieldsCreated: createdFields.length,
      companyValuesCreated: companyValues.length,
      fields: createdFields.map(f => ({
        field_key: f.field_key,
        field_label: f.field_label,
        field_category: f.field_category
      }))
    });

  } catch (error) {
    console.error('Error adding joint holder:', error);
    res.status(500).json({ error: 'Failed to add joint holder' });
  }
};

// Update reviewer comment for a specific field
const updateReviewerComment = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { field_key, reviewer_comment } = req.body;
    const reviewerId = req.user.id;

    // Validate required fields
    if (!field_key) {
      return res.status(400).json({ error: 'field_key is required' });
    }

    // Convert companyId to integer
    const companyIdInt = parseInt(companyId, 10);
    if (isNaN(companyIdInt)) {
      return res.status(400).json({ error: 'Invalid company ID' });
    }

    // Check if user is a data reviewer or template reviewer
    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Handle roles as array or string (supporting both formats)
    const userRoles = Array.isArray(reviewer.role) ? reviewer.role : (reviewer.role ? [reviewer.role] : []);
    const isDataReviewer = userRoles.includes('data_reviewer');
    const isTemplateReviewer = userRoles.includes('template_reviewer');
    
    if (!isDataReviewer && !isTemplateReviewer) {
      return res.status(403).json({ error: 'Only data reviewers and template reviewers can add comments' });
    }

    // Check if company exists and is assigned to this reviewer
    const company = await Company.findByPk(companyIdInt);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Convert to integers for comparison to avoid type mismatch
    const assignedToInt = company.assigned_to ? parseInt(company.assigned_to, 10) : null;
    const reviewerIdInt = parseInt(reviewerId, 10);
    
    if (assignedToInt !== reviewerIdInt) {
      return res.status(403).json({ error: 'You can only comment on companies assigned to you' });
    }

    // Update or create company value with reviewer comment
    const [companyValue, created] = await CompanyValue.findOrCreate({
      where: {
        company_id: companyIdInt,
        field_key: field_key
      },
      defaults: {
        company_id: companyIdInt,
        field_key: field_key,
        field_value: '',
        last_updated_by: reviewerIdInt,
        reviewer_comment: reviewer_comment || null
      }
    });

    if (!created) {
      companyValue.reviewer_comment = reviewer_comment || null;
      companyValue.last_updated_by = reviewerIdInt;
      await companyValue.save();
    }

    res.json({
      message: 'Reviewer comment updated successfully',
      companyValue: companyValue.toJSON()
    });
  } catch (error) {
    console.error('Error updating reviewer comment:', error);
    res.status(500).json({ 
      error: 'Failed to update reviewer comment',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Approve company after review (Data Reviewer)
const approveCompanyReview = async (req, res) => {
  try {
    const { companyId } = req.params;
    const reviewerId = req.user.id;

    // Check if user is a data reviewer or template reviewer
    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Handle roles as array or string (supporting both formats)
    const userRoles = Array.isArray(reviewer.role) ? reviewer.role : (reviewer.role ? [reviewer.role] : []);
    const isDataReviewer = userRoles.includes('data_reviewer');
    const isTemplateReviewer = userRoles.includes('template_reviewer');
    
    if (!isDataReviewer && !isTemplateReviewer) {
      return res.status(403).json({ error: 'Only data reviewers and template reviewers can approve companies' });
    }

    // Check if company exists and is assigned to this reviewer
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const isAssignedDataReviewer =
      isDataReviewer && Number(company.assigned_to) === Number(reviewerId);
    const isAssignedTemplateReviewer =
      isTemplateReviewer &&
      (Number(company.template_reviewer_id) === Number(reviewerId) ||
        Number(company.assigned_to) === Number(reviewerId));

    if (!isAssignedDataReviewer && !isAssignedTemplateReviewer) {
      return res.status(403).json({ error: 'You can only approve companies assigned to you' });
    }

    // Update company status to completed
    await company.update({ status: 'completed' });

    if (isTemplateReviewer) {
      await CompanyTemplate.update(
        { review_status: 'done' },
        { where: { company_id: companyId, is_selected: true } }
      );
    }

    // Get company with case details for notification
    const companyWithCase = await Company.findByPk(companyId, {
      include: [{
        model: Case,
        as: 'case',
        attributes: ['id', 'case_id', 'case_title', 'client_name']
      }]
    });

    // Determine review type and create appropriate notification
    const reviewType = isDataReviewer ? 'data_review' : 'template_review';
    
    // Create notification for the employee who created the company
    if (company.created_by) {
      await Notification.create({
        user_id: company.created_by,
        company_id: companyId,
        case_id: company.case_id,
        type: isDataReviewer ? 'data_review_approved' : 'template_review_approved',
        title: `${isDataReviewer ? 'Data Review' : 'Template Review'} Approved`,
        message: `Your company "${company.company_name}" has been approved by ${reviewer.name}. ${companyWithCase.case ? `Case: ${companyWithCase.case.case_title}` : ''}`,
        metadata: {
          reviewer_name: reviewer.name,
          reviewer_email: reviewer.email,
          review_type: reviewType,
          company_name: company.company_name,
          case_title: companyWithCase.case?.case_title,
          case_id: companyWithCase.case?.case_id
        }
      });
    }

    res.json({
      message: 'Company approved successfully. Ready for template generation.',
      company: company.toJSON()
    });
  } catch (error) {
    console.error('Error approving company:', error);
    res.status(500).json({ error: 'Failed to approve company' });
  }
};

// Reject company and send back to employee (Data Reviewer)
const rejectCompanyReview = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { rejection_reason } = req.body;
    const reviewerId = req.user.id;

    // Check if user is a data reviewer or template reviewer
    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Handle roles as array or string (supporting both formats)
    const userRoles = Array.isArray(reviewer.role) ? reviewer.role : (reviewer.role ? [reviewer.role] : []);
    const isDataReviewer = userRoles.includes('data_reviewer');
    const isTemplateReviewer = userRoles.includes('template_reviewer');
    
    if (!isDataReviewer && !isTemplateReviewer) {
      return res.status(403).json({ error: 'Only data reviewers and template reviewers can reject companies' });
    }

    // Check if company exists and is assigned to this reviewer
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const isAssignedReviewer =
      company.assigned_to === reviewerId ||
      company.template_reviewer_id === reviewerId;

    if (!isAssignedReviewer) {
      return res.status(403).json({ error: 'You can only reject companies assigned to you' });
    }

    // Update company status to rejected and reassign to original creator
    await company.update({
      status: 'rejected',
      assigned_to: company.created_by
    });

    // Get company with case details for notification
    const companyWithCase = await Company.findByPk(companyId, {
      include: [{
        model: Case,
        as: 'case',
        attributes: ['id', 'case_id', 'case_title', 'client_name']
      }]
    });

    // Determine review type and create appropriate notification
    const reviewType = isDataReviewer ? 'data_review' : 'template_review';
    
    // Create notification for the employee who created the company
    if (company.created_by) {
      await Notification.create({
        user_id: company.created_by,
        company_id: companyId,
        case_id: company.case_id,
        type: isDataReviewer ? 'data_review_rejected' : 'template_review_rejected',
        title: `${isDataReviewer ? 'Data Review' : 'Template Review'} Rejected`,
        message: `Your company "${company.company_name}" has been rejected by ${reviewer.name} and sent back for corrections. ${rejection_reason ? `Reason: ${rejection_reason}` : ''} ${companyWithCase.case ? `Case: ${companyWithCase.case.case_title}` : ''}`,
        metadata: {
          reviewer_id: reviewerId, // Store reviewer ID to track who rejected
          reviewer_name: reviewer.name,
          reviewer_email: reviewer.email,
          review_type: reviewType,
          rejection_reason: rejection_reason || 'No reason provided',
          company_name: company.company_name,
          case_title: companyWithCase.case?.case_title,
          case_id: companyWithCase.case?.case_id
        }
      });
    }

    res.json({
      message: 'Company rejected and sent back to employee for corrections.',
      company: company.toJSON()
    });
  } catch (error) {
    console.error('Error rejecting company:', error);
    res.status(500).json({ error: 'Failed to reject company' });
  }
};

// Remove joint holder fields
const removeJointHolder = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { jointHolderNumber } = req.body;

    // Check if company exists
    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Validate joint holder number
    if (jointHolderNumber < 4) {
      return res.status(400).json({ 
        error: 'Cannot remove C1, C2, C3 (basic claimant and joint holders)' 
      });
    }

    const cnSuffix = `C${jointHolderNumber}`;

    // Find all fields for this joint holder
    const fields = await CaseField.findAll({
      where: {
        field_key: {
          [require('sequelize').Op.like]: `%${cnSuffix}`
        }
      }
    });

    // Delete company values for this joint holder
    const deletedValues = await CompanyValue.destroy({
      where: {
        company_id: companyId,
        field_key: {
          [require('sequelize').Op.like]: `%${cnSuffix}`
        }
      }
    });

    res.json({
      message: `Joint Holder ${jointHolderNumber} removed successfully`,
      deletedValues,
      affectedFields: fields.map(f => f.field_key)
    });

  } catch (error) {
    console.error('Error removing joint holder:', error);
    res.status(500).json({ error: 'Failed to remove joint holder' });
  }
};

// Duplicate a company with all its values
const duplicateCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { company_name, assigned_to } = req.body;
    const created_by = req.user.id;

    // Check if original company exists
    const originalCompany = await Company.findByPk(companyId);
    if (!originalCompany) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Validate company name
    if (!company_name || company_name.trim() === '') {
      return res.status(400).json({ error: 'Company name is required' });
    }

    // Create the new company
    const newCompany = await Company.create({
      case_id: originalCompany.case_id,
      company_name: company_name.trim(),
      created_by,
      assigned_to: assigned_to ? parseInt(assigned_to) : originalCompany.assigned_to,
      status: 'pending' // Start with pending status for the duplicate
    });

    // Get all company values from the original company
    const originalValues = await CompanyValue.findAll({
      where: { company_id: companyId }
    });

    // Copy all company values to the new company
    const newValues = [];
    for (const originalValue of originalValues) {
      const newValue = await CompanyValue.create({
        company_id: newCompany.id,
        field_key: originalValue.field_key,
        field_value: originalValue.field_value, // Copy the value
        last_updated_by: created_by
        // Note: We don't copy reviewer_comment as it's specific to the original review
      });
      newValues.push(newValue);
    }

    // Fetch the created company with user details
    const createdCompany = await Company.findByPk(newCompany.id, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      message: 'Company duplicated successfully',
      company: createdCompany,
      valuesCopied: newValues.length
    });
  } catch (error) {
    console.error('Error duplicating company:', error);
    res.status(500).json({ error: 'Failed to duplicate company' });
  }
};

// Assign company for data review using round-robin among eligible reviewers
const assignForDataReview = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findByPk(companyId, {
      include: [
        {
          model: Case,
          as: 'case',
          attributes: ['id', 'case_id', 'case_title', 'client_name']
        }
      ]
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    if (normalizeCompanyStatus(company.status) === 'in_review') {
      return res.status(400).json({ error: 'Company is already under data review.' });
    }

    const hasData = await companyHasWorkData(companyId);
    if (!hasData) {
      return res.status(400).json({
        error:
          'Company data is required before assigning for review. Fill fields in Company Work View first.'
      });
    }

    const eligibleReviewers = await fetchEligibleDataReviewers(company);
    if (!eligibleReviewers.length) {
      return res.status(400).json({
        error:
          'No eligible data reviewers available. Add a data or template reviewer, or ensure the assigned employee is not the only reviewer.'
      });
    }

    const reviewerId = await pickRoundRobinReviewerId(eligibleReviewers);
    const reviewer = eligibleReviewers.find((r) => Number(r.id) === Number(reviewerId));

    await ensureCompanyStatusDefaults();

    await company.update({
      status: 'in_review',
      assigned_to: reviewerId
    });

    try {
      await Notification.create({
        user_id: reviewerId,
        company_id: Number(companyId),
        case_id: company.case_id,
        type: 'data_review_assigned',
        title: 'New Data Review Assignment',
        message: `Company "${company.company_name}" has been assigned to you for data review.${
          company.case ? ` Case: ${company.case.case_title}` : ''
        }`,
        metadata: {
          assignment_method: 'round_robin',
          company_name: company.company_name,
          assigned_by: req.user?.id ?? null,
          assigned_by_name: req.user?.name ?? null
        }
      });
    } catch (notificationError) {
      console.error('Failed to create reviewer assignment notification:', notificationError);
    }

    const updatedCompany = await Company.findByPk(companyId, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.json({
      message: 'Company assigned for data review successfully.',
      company: updatedCompany,
      assigned_reviewer: {
        id: reviewer.id,
        name: reviewer.name,
        email: reviewer.email
      },
      assignment_method: 'round_robin'
    });
  } catch (error) {
    console.error('Error assigning company for data review:', error);
    res.status(500).json({ error: 'Failed to assign company for data review' });
  }
};

// Get reviewer tracking statistics
const getReviewerStats = async (req, res) => {
  try {
    const reviewerId = req.user.id;
    
    // Check if user is a data reviewer or template reviewer
    const reviewer = await User.findByPk(reviewerId);
    if (!reviewer) {
      return res.status(403).json({ error: 'User not found' });
    }
    
    // Handle roles as array or string (supporting both formats)
    const userRoles = Array.isArray(reviewer.role) ? reviewer.role : (reviewer.role ? [reviewer.role] : []);
    const isDataReviewer = userRoles.includes('data_reviewer');
    const isTemplateReviewer = userRoles.includes('template_reviewer');
    
    if (!isDataReviewer && !isTemplateReviewer) {
      return res.status(403).json({ error: 'Only data reviewers and template reviewers can access this endpoint' });
    }

    // Get statistics grouped by status
    const statusStats = await Company.findAll({
      where: { assigned_to: reviewerId },
      attributes: [
        'status',
        [sequelize.fn('COUNT', sequelize.col('id')), 'count']
      ],
      group: ['status'],
      raw: true
    });

    // Calculate total
    const total = await Company.count({
      where: { assigned_to: reviewerId }
    });

    // Format the response
    const stats = {
      inReview: 0,
      completed: 0,
      rejected: 0,
      pending: 0,
      inProgress: 0,
      total: total
    };

    statusStats.forEach(stat => {
      const status = stat.status;
      const count = parseInt(stat.count);
      
      if (status === 'in_review') stats.inReview = count;
      else if (status === 'completed') stats.completed = count;
      else if (status === 'rejected') stats.rejected = count;
      else if (status === 'pending') stats.pending = count;
      else if (status === 'in_progress') stats.inProgress = count;
    });

    res.json({
      success: true,
      stats: stats,
      breakdown: statusStats.map(stat => ({
        status: stat.status,
        count: parseInt(stat.count)
      }))
    });
  } catch (error) {
    console.error('Error fetching reviewer stats:', error);
    res.status(500).json({ error: 'Failed to fetch reviewer statistics' });
  }
};

// Submit company for template review (separate from data review)
const submitForTemplateReview = async (req, res) => {
  try {
    const legacyTemplateReview = !isTemplateReviewerColumnAvailable();
    const { companyId } = req.params;
    const { template_reviewer_id } = req.body;

    if (!template_reviewer_id) {
      return res.status(400).json({ error: 'Template reviewer ID is required' });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    // Check if template reviewer exists
    const templateReviewer = await User.findByPk(template_reviewer_id);
    if (!templateReviewer) {
      return res.status(404).json({ error: 'Template reviewer not found' });
    }

    // Check if user is a template reviewer
    const userRoles = Array.isArray(templateReviewer.role) 
      ? templateReviewer.role 
      : (templateReviewer.role ? [templateReviewer.role] : []);
    
    if (!userRoles.includes('template_reviewer') && !userRoles.includes('admin')) {
      return res.status(403).json({ error: 'Selected user is not a template reviewer' });
    }

    // Check if company has selected templates
    const selectedTemplates = await CompanyTemplate.findAll({
      where: {
        company_id: companyId,
        is_selected: true
      }
    });

    if (selectedTemplates.length === 0) {
      return res.status(400).json({ error: 'No templates selected for this company. Please select templates before submitting for review.' });
    }

    // IMPORTANT: Don't overwrite assigned_to if company is already in data review
    // Only update assigned_to if company is not currently in data review
    const isInDataReview = company.status === 'in_review' && company.assigned_to !== null;
    
    if (legacyTemplateReview && isInDataReview) {
      return res.status(409).json({
        error:
          'This company is already in data review. Parallel template review needs the template_reviewer_id database column — ask an admin to run the RDS migration.'
      });
    }

    const reviewerId = parseInt(template_reviewer_id, 10);
    const updateData = {};

    if (!legacyTemplateReview) {
      updateData.template_reviewer_id = reviewerId;
    }

    // Without template_reviewer_id column, template reviewer is tracked via assigned_to
    if (!isInDataReview) {
      updateData.assigned_to = reviewerId;
      if (company.status !== 'in_review') {
        updateData.status = 'in_review';
      }
    }

    await company.update(updateData);

    // Mark all selected templates as pending template review
    await CompanyTemplate.update(
      { 
        review_status: 'pending',
        // Store template reviewer ID in selected_by field if not already set
        // This helps track which template reviewer should review these templates
      },
      {
        where: {
          company_id: companyId,
          is_selected: true
        }
      }
    );

    // Fetch updated company with user details
    const updatedCompany = await Company.findByPk(companyId, {
      include: [
        {
          model: User,
          as: 'assignedUser',
          attributes: ['id', 'name', 'email']
        },
        getTemplateReviewerInclude(User)
      ].filter(Boolean)
    });

    const companyPayload = updatedCompany
      ? updatedCompany.toJSON()
      : company.toJSON();

    if (legacyTemplateReview) {
      companyPayload.template_reviewer_id = reviewerId;
      companyPayload.templateReviewer = {
        id: templateReviewer.id,
        name: templateReviewer.name,
        email: templateReviewer.email
      };
    }

    res.json({
      message: isInDataReview && !legacyTemplateReview
        ? 'Company submitted for template review. Data review is already in progress and will continue separately.'
        : 'Company submitted for template review successfully',
      company: companyPayload,
      isInDataReview: isInDataReview,
      templateReviewer: updatedCompany?.templateReviewer || templateReviewer,
      legacyTemplateReview
    });
  } catch (error) {
    console.error('Error submitting company for template review:', error);
    res.status(500).json({ error: 'Failed to submit company for template review' });
  }
};

const getCompanyNotes = async (req, res) => {
  try {
    const { companyId } = req.params;

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const notes = await CompanyNote.findAll({
      where: { company_id: companyId },
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['createdAt', 'DESC']]
    });

    res.json({ notes });
  } catch (error) {
    console.error('Error fetching company notes:', error);
    res.status(500).json({ error: 'Failed to fetch company notes' });
  }
};

const addCompanyNote = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { note } = req.body;
    const userId = req.user.id;

    if (!note || !String(note).trim()) {
      return res.status(400).json({ error: 'Note is required' });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const created = await CompanyNote.create({
      company_id: companyId,
      user_id: userId,
      note: String(note).trim()
    });

    const createdWithUser = await CompanyNote.findByPk(created.id, {
      include: [
        {
          model: User,
          as: 'user',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    res.status(201).json({
      message: 'Note added successfully',
      note: createdWithUser
    });
  } catch (error) {
    console.error('Error adding company note:', error);
    res.status(500).json({ error: 'Failed to add company note' });
  }
};

module.exports = {
  getAllCompanies,
  getCompaniesByCase,
  createCompany,
  getCompanyDetails,
  getCompanyValues,
  updateCompanyValues,
  updateCompanyStatus,
  deleteCompany,
  addJointHolder,
  removeJointHolder,
  updateReviewerComment,
  approveCompanyReview,
  rejectCompanyReview,
  duplicateCompany,
  getReviewerStats,
  submitForTemplateReview,
  assignForDataReview,
  getCompanyNotes,
  addCompanyNote
};
