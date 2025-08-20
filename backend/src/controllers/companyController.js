const { Company, CompanyValue, User, Case, CaseField } = require('../models');

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
      order: [['field_category', 'ASC'], ['field_order', 'ASC']]
    });

    // Get existing values for this company
    const companyValues = await CompanyValue.findAll({
      where: { company_id: companyId }
    });

    // Create a map of field values
    const valuesMap = {};
    companyValues.forEach(value => {
      valuesMap[value.field_key] = value.field_value;
    });

    // Combine fields with their values
    const fieldsWithValues = caseFields.map(field => ({
      ...field.toJSON(),
      field_value: valuesMap[field.field_key] || ''
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
    const { status } = req.body;

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    await company.update({ status });

    res.json({ 
      message: 'Company status updated successfully',
      company 
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

module.exports = {
  getCompaniesByCase,
  createCompany,
  getCompanyDetails,
  getCompanyValues,
  updateCompanyValues,
  updateCompanyStatus,
  deleteCompany
};
