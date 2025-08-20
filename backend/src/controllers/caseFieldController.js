const { CaseField, CaseValue, Case, User } = require('../models');

// Get all predefined case fields
const getAllCaseFields = async (req, res) => {
  try {
    const fields = await CaseField.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC'], ['field_key', 'ASC']]
    });

    res.json({
      fields,
      total: fields.length,
      message: 'Case fields fetched successfully'
    });
  } catch (error) {
    console.error('Get case fields error:', error);
    res.status(500).json({ error: 'Failed to fetch case fields.' });
  }
};

// Get case fields by category
const getCaseFieldsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    
    const fields = await CaseField.findAll({
      where: { 
        category: category,
        is_active: true 
      },
      order: [['display_order', 'ASC'], ['field_key', 'ASC']]
    });

    res.json({
      fields,
      total: fields.length,
      category,
      message: `Case fields for category '${category}' fetched successfully`
    });
  } catch (error) {
    console.error('Get case fields by category error:', error);
    res.status(500).json({ error: 'Failed to fetch case fields by category.' });
  }
};

// Get all values for a specific case
const getCaseValues = async (req, res) => {
  try {
    const caseId = req.params.caseId;
    
    // Check if case exists
    const caseExists = await Case.findByPk(caseId);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    // Get all case values
    const caseValues = await CaseValue.findAll({
      where: { case_id: caseId },
      include: [
        {
          model: User,
          as: 'lastUpdatedByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['created_at', 'ASC']]
    });

    // Get all predefined fields
    const allFields = await CaseField.findAll({
      where: { is_active: true },
      order: [['display_order', 'ASC'], ['field_key', 'ASC']]
    });

    // Create a map of field values
    const valuesMap = {};
    caseValues.forEach(cv => {
      valuesMap[cv.field_key] = {
        value: cv.field_value,
        last_updated: cv.updated_at,
        last_updated_by: cv.lastUpdatedByUser
      };
    });

    // Combine fields with values
    const fieldsWithValues = allFields.map(field => ({
      field_key: field.field_key,
      field_label: field.field_label,
      field_type: field.field_type,
      field_category: field.field_category,
      is_required: field.is_required,
      display_order: field.display_order,
      value: valuesMap[field.field_key]?.value || null,
      last_updated: valuesMap[field.field_key]?.last_updated || null,
      last_updated_by: valuesMap[field.field_key]?.last_updated_by || null
    }));

    res.json({
      case_id: caseId,
      fields: fieldsWithValues,
      total_fields: allFields.length,
      filled_fields: caseValues.length,
      message: 'Case values fetched successfully'
    });
  } catch (error) {
    console.error('Get case values error:', error);
    res.status(500).json({ error: 'Failed to fetch case values.' });
  }
};

// Add or update case values
const updateCaseValues = async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const { field_values } = req.body; // Array of { field_key, field_value }
    const userId = req.user.id;

    // Check if case exists
    const caseExists = await Case.findByPk(caseId);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    // Validate field_values format
    if (!Array.isArray(field_values)) {
      return res.status(400).json({ error: 'field_values must be an array.' });
    }

    const results = [];
    const errors = [];

    // Process each field value
    for (const item of field_values) {
      try {
        if (!item.field_key || item.field_value === undefined) {
          errors.push({ field_key: item.field_key, error: 'field_key and field_value are required' });
          continue;
        }

        // Check if field exists
        const fieldExists = await CaseField.findOne({ 
          where: { field_key: item.field_key, is_active: true } 
        });
        
        if (!fieldExists) {
          errors.push({ field_key: item.field_key, error: 'Field does not exist' });
          continue;
        }

        // Upsert the value
        const [caseValue, created] = await CaseValue.upsert({
          case_id: caseId,
          field_key: item.field_key,
          field_value: item.field_value,
          last_updated_by: userId
        }, {
          returning: true
        });

        results.push({
          field_key: item.field_key,
          field_value: item.field_value,
          status: created ? 'created' : 'updated',
          id: caseValue.id
        });

      } catch (error) {
        errors.push({ 
          field_key: item.field_key, 
          error: error.message 
        });
      }
    }

    res.json({
      case_id: caseId,
      message: 'Case values updated successfully',
      results,
      errors,
      total_processed: field_values.length,
      successful: results.length,
      failed: errors.length
    });

  } catch (error) {
    console.error('Update case values error:', error);
    res.status(500).json({ error: 'Failed to update case values.' });
  }
};

// Delete a specific case value
const deleteCaseValue = async (req, res) => {
  try {
    const { caseId, fieldKey } = req.params;
    const userId = req.user.id;

    // Check if case exists
    const caseExists = await Case.findByPk(caseId);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    // Find and delete the case value
    const caseValue = await CaseValue.findOne({
      where: { case_id: caseId, field_key: fieldKey }
    });

    if (!caseValue) {
      return res.status(404).json({ error: 'Case value not found.' });
    }

    await caseValue.destroy();

    res.json({
      message: 'Case value deleted successfully',
      case_id: caseId,
      field_key: fieldKey
    });

  } catch (error) {
    console.error('Delete case value error:', error);
    res.status(500).json({ error: 'Failed to delete case value.' });
  }
};

// Bulk delete case values
const deleteCaseValues = async (req, res) => {
  try {
    const caseId = req.params.caseId;
    const { field_keys } = req.body; // Array of field keys to delete

    // Check if case exists
    const caseExists = await Case.findByPk(caseId);
    if (!caseExists) {
      return res.status(404).json({ error: 'Case not found.' });
    }

    // Validate field_keys format
    if (!Array.isArray(field_keys)) {
      return res.status(400).json({ error: 'field_keys must be an array.' });
    }

    // Delete multiple case values
    const deletedCount = await CaseValue.destroy({
      where: {
        case_id: caseId,
        field_key: field_keys
      }
    });

    res.json({
      message: 'Case values deleted successfully',
      case_id: caseId,
      deleted_count: deletedCount,
      field_keys
    });

  } catch (error) {
    console.error('Delete case values error:', error);
    res.status(500).json({ error: 'Failed to delete case values.' });
  }
};

module.exports = {
  getAllCaseFields,
  getCaseFieldsByCategory,
  getCaseValues,
  updateCaseValues,
  deleteCaseValue,
  deleteCaseValues
};
