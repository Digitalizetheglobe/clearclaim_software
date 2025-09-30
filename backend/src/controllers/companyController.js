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
      order: [['field_category', 'ASC'], ['display_order', 'ASC']]
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

module.exports = {
  getCompaniesByCase,
  createCompany,
  getCompanyDetails,
  getCompanyValues,
  updateCompanyValues,
  updateCompanyStatus,
  deleteCompany,
  addJointHolder,
  removeJointHolder
};
