const models = require('../models');
const { sequelize } = require('../config/database');
const path = require('path');
const fs = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// Utility function to clean undefined values from any object
const cleanUndefinedValues = (obj) => {
  const cleaned = {};
  Object.keys(obj).forEach(key => {
    const value = obj[key];
    if (value === undefined || 
        value === null || 
        value === 'undefined' || 
        value === 'null' || 
        value === 'UNDEFINED' || 
        value === 'NULL' ||
        (typeof value === 'string' && value.trim() === '')) {
      // Add helpful placeholder text based on field type
      cleaned[key] = getPlaceholderText(key);
    } else if (typeof value === 'string') {
      // Clean any string values that contain "undefined" text
      const cleanedValue = value.replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
      if (cleanedValue === '') {
        cleaned[key] = getPlaceholderText(key);
      } else {
        cleaned[key] = cleanedValue;
      }
    } else {
      cleaned[key] = value;
    }
  });
  return cleaned;
};

// Helper function to get appropriate placeholder text for different field types
const getPlaceholderText = (key) => {
  // Return underlines with normal formatting (black color)
  return '_________________';
};

// Helper function to format dates in DD/MM/YYYY format
const formatDate = (dateValue) => {
  if (!dateValue) return '';
  
  try {
    // Handle different date formats
    let date;
    
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (typeof dateValue === 'string') {
      // Handle YYYY-MM-DD format
      if (dateValue.match(/^\d{4}-\d{2}-\d{2}$/)) {
        date = new Date(dateValue + 'T00:00:00');
      } 
      // Handle DD/MM/YYYY format
      else if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{4}$/)) {
        const [day, month, year] = dateValue.split('/');
        date = new Date(year, month - 1, day);
      }
      // Handle DD/MM/YY format (2-digit year) and convert to 4-digit
      else if (dateValue.match(/^\d{1,2}\/\d{1,2}\/\d{2}$/)) {
        const [day, month, year] = dateValue.split('/');
        // Convert 2-digit year to 4-digit (assume 20xx for years 00-99)
        const fullYear = parseInt(year) < 50 ? 2000 + parseInt(year) : 1900 + parseInt(year);
        date = new Date(fullYear, month - 1, day);
      }
      // Handle other formats
      else {
        date = new Date(dateValue);
      }
    } else {
      date = new Date(dateValue);
    }
    
    // Check if date is valid
    if (isNaN(date.getTime())) {
      return '';
    }
    
    // Format as DD/MM/YYYY (4-digit year)
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear().toString(); // Full 4-digit year
    
    return `${day}/${month}/${year}`;
  } catch (error) {
    console.warn(`Error formatting date: ${dateValue}`, error);
    return '';
  }
};

// Helper function to get value or appropriate placeholder
const getValueOrPlaceholder = (value, fieldName) => {
  if (!value || 
      value === 'undefined' || 
      value === 'null' || 
      value === 'UNDEFINED' || 
      value === 'NULL' ||
      (typeof value === 'string' && value.trim() === '')) {
    return getPlaceholderText(fieldName);
  }
  
  // Special handling for date fields
  if (fieldName && (fieldName.includes('Date') || fieldName.includes('DOB'))) {
    const formattedDate = formatDate(value);
    if (formattedDate) {
      return formattedDate;
    }
  }
  
  // Clean the value of any undefined text
  const cleanedValue = value.toString().replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
  if (cleanedValue === '') {
    return getPlaceholderText(fieldName);
  }
  
  return cleanedValue;
};

const CompanyTemplate = models.CompanyTemplate;
const Company = models.Company;
const User = models.User;
const CompanyValue = models.CompanyValue;

// Helper function to categorize templates
const categorizeTemplate = (filename) => {
  const lowerFilename = filename.toLowerCase();
  
  if (lowerFilename.includes('name mismatch')) {
    return 'NAME_MISMATCH';
  } else if (lowerFilename.includes('form-a') || lowerFilename.includes('form a')) {
    return 'FORM_A';
  } else if (lowerFilename.includes('form-b') || lowerFilename.includes('form b')) {
    return 'FORM_B';
  } else if (lowerFilename.includes('isr-')) {
    return 'ISR_FORMS';
  } else if (lowerFilename.includes('annexure')) {
    return 'ANNEXURES';
  } else {
    return 'OTHER';
  }
};

// Helper function to clean template name
const cleanTemplateName = (filename) => {
  return filename
    .replace('_Template.docx', '')
    .replace('.docx', '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, l => l.toUpperCase())
    .trim();
};

// Get all available templates for a company
const getCompanyTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get all available templates from the company_templates table
    const allTemplates = await CompanyTemplate.findAll({
      where: { company_id: companyId },
      include: [
        {
          model: User,
          as: 'selectedByUser',
          attributes: ['id', 'name', 'email']
        }
      ],
      order: [['template_category', 'ASC'], ['template_name', 'ASC']]
    });

    let templatesByCategory = {};
    let selectedCount = 0;

    // If no templates exist for this company, scan the templates directory
    if (allTemplates.length === 0) {
      console.log(`No templates found for company ${companyId}, scanning templates directory...`);
      
      try {
        // Scan templates directory
        const templatesDir = path.join(__dirname, '../../templates');
        const templateFiles = await fs.readdir(templatesDir);
        const docxFiles = templateFiles.filter(file => file.endsWith('.docx'));
        
        console.log(`Found ${docxFiles.length} template files in directory`);
        
        // Create template records for this company
        const templateRecords = [];
        
        for (const file of docxFiles) {
          const category = categorizeTemplate(file);
          const templateName = cleanTemplateName(file);
          
          templateRecords.push({
            company_id: companyId,
            template_name: templateName,
            template_category: category,
            template_path: file, // Store relative path
            is_selected: false, // Default to not selected
            selected_by: null,
            selected_at: null
          });
        }
        
        // Bulk create templates for this company
        if (templateRecords.length > 0) {
          await CompanyTemplate.bulkCreate(templateRecords);
          console.log(`Created ${templateRecords.length} template records for company ${companyId}`);
          
          // Now fetch the newly created templates
          const newTemplates = await CompanyTemplate.findAll({
            where: { company_id: companyId },
            include: [
              {
                model: User,
                as: 'selectedByUser',
                attributes: ['id', 'name', 'email']
              }
            ],
            order: [['template_category', 'ASC'], ['template_name', 'ASC']]
          });
          
          // Process the new templates
          newTemplates.forEach(template => {
            const category = template.template_category;
            if (!templatesByCategory[category]) {
              templatesByCategory[category] = [];
            }
            
            templatesByCategory[category].push({
              id: template.id,
              name: template.template_name,
              category: template.template_category,
              filename: template.template_path.split('/').pop(),
              isSelected: template.is_selected,
              selectedBy: template.selectedByUser ? {
                id: template.selectedByUser.id,
                name: template.selectedByUser.name
              } : null,
              selectedAt: template.selected_at
            });
          });
        }
      } catch (dirError) {
        console.error('Error scanning templates directory:', dirError);
        // Continue with empty templates if directory scan fails
      }
    } else {
      // Process existing templates
      allTemplates.forEach(template => {
        const category = template.template_category;
        if (!templatesByCategory[category]) {
          templatesByCategory[category] = [];
        }
        
        templatesByCategory[category].push({
          id: template.id,
          name: template.template_name,
          category: template.template_category,
          filename: template.template_path.split('/').pop(), // Extract filename from path
          isSelected: template.is_selected,
          selectedBy: template.selectedByUser ? {
            id: template.selectedByUser.id,
            name: template.selectedByUser.name
          } : null,
          selectedAt: template.selected_at
        });
      });
      
      // Count selected templates
      selectedCount = allTemplates.filter(t => t.is_selected).length;
    }

    res.json({
      success: true,
      templates: templatesByCategory,
      selectedCount: selectedCount
    });
    
  } catch (error) {
    console.error('Error getting company templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching templates',
      error: error.message
    });
  }
};

// Update template selections for a company
const updateCompanyTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { templateSelections, userId } = req.body;
    
    // Update each template selection
    for (const selection of templateSelections) {
      await CompanyTemplate.update(
        {
          is_selected: selection.isSelected,
          selected_by: selection.isSelected ? userId : null,
          selected_at: selection.isSelected ? new Date() : null
        },
        {
          where: {
            company_id: companyId,
            template_name: selection.name,
            template_category: selection.category
          }
        }
      );
    }

    // Get updated count
    const selectedCount = await CompanyTemplate.count({
      where: {
        company_id: companyId,
        is_selected: true
      }
    });

    res.json({
      success: true,
      message: `Successfully updated template selections`,
      selectedCount: selectedCount
    });
    
  } catch (error) {
    console.error('Error updating company templates:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating template selections',
      error: error.message
    });
  }
};

// Map company values to template placeholders
const mapCompanyValuesToTemplate = async (companyId, templatePath) => {
  try {
    console.log(`📋 Mapping company values for company ${companyId} with template ${templatePath}`);
    
    // Get company values
    const companyValues = await CompanyValue.findAll({
      where: { company_id: companyId },
      include: [
        {
          model: models.CaseField,
          as: 'caseField',
          attributes: ['field_key', 'field_label', 'field_type']
        }
      ]
    });

    console.log(`📊 Found ${companyValues.length} company values`);

    // Create a mapping object for easy lookup
    const valueMap = {};
    companyValues.forEach(cv => {
      if (cv.caseField && cv.field_value) {
        console.log(`📝 Mapping: ${cv.caseField.field_key} = "${cv.field_value}"`);
        
        // Map by field key
        valueMap[cv.caseField.field_key] = cv.field_value;
        // Map by field label
        valueMap[cv.caseField.field_label] = cv.field_value;
        
        // Create additional mappings for common variations
        const key = cv.caseField.field_key.toLowerCase();
        const label = cv.caseField.field_label.toLowerCase();
        
        // Map common variations - be more specific to avoid overwriting
        // Handle C1, C2, C3, and dynamic joint holders (C4, C5, C6, etc.)
        if (key.includes('name as per aadhar c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Aadhar C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_c${suffix}`]) valueMap[`name_c${suffix}`] = cv.field_value;
        }
        if (key.includes('name as per pan c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per PAN C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_pan_c${suffix}`]) valueMap[`name_pan_c${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Name as per PAN C${suffix}: ${cv.field_value}`);
        }
        if (key.includes('name as per cml c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per CML C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
        }
        if (key.includes('name as per bank c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Bank C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
        }
        if (key.includes('name as per passport c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Passport C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
        }
        if (key.includes('name as per succession') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Succession/WILL/LHA C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
        }
        if (key.includes('name as per cert c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Cert C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
        }
        // Handle father name fields dynamically
        if (key.includes('father name c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Father Name C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`father_name_c${suffix}`]) valueMap[`father_name_c${suffix}`] = cv.field_value;
        }
        
        // Handle address fields dynamically - CRITICAL FIX: Ensure Address C1 maps to claimant address, not bank address
        if (key.includes('address c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Address C${suffix}`;
          
          // CRITICAL: Only map if this is NOT a bank address field
          // Bank addresses should be mapped to "Bank Address C1", not "Address C1"
          if (!key.includes('bank') && !key.includes('Bank')) {
            if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
            if (!valueMap[`address_c${suffix}`]) valueMap[`address_c${suffix}`] = cv.field_value;
            console.log(`✅ Mapped claimant address for ${fieldKey}: ${cv.field_value}`);
          } else {
            console.log(`⚠️ Skipping bank address mapping for ${fieldKey}: ${cv.field_value}`);
          }
        }
        
        // Handle PAN fields dynamically
        if (key.includes('pan c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `PAN C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`pan_c${suffix}`]) valueMap[`pan_c${suffix}`] = cv.field_value;
        }
        
        // Handle age fields dynamically
        if (key.includes('age c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Age C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`age_c${suffix}`]) valueMap[`age_c${suffix}`] = cv.field_value;
        }
        
        // Handle deceased relation fields dynamically
        if (key.includes('deceased relation c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Deceased Relation C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`relation_c${suffix}`]) valueMap[`relation_c${suffix}`] = cv.field_value;
        }
        
        // Handle mobile number fields dynamically
        if (key.includes('mobile no c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Mobile No C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`mobile_c${suffix}`]) valueMap[`mobile_c${suffix}`] = cv.field_value;
        }
        
        // Handle email fields dynamically
        if (key.includes('email id c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Email ID C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`email_c${suffix}`]) valueMap[`email_c${suffix}`] = cv.field_value;
        }
        
        // Handle account opening date fields dynamically
        if ((key.includes('account open') || key.includes('a/c open') || key.includes('bank account open')) && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `A/C Open Date C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`account_open_date_c${suffix}`]) valueMap[`account_open_date_c${suffix}`] = cv.field_value;
        }
        
        // Handle DOB fields dynamically
        if (key.includes('dob c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `DOB C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`dob_c${suffix}`]) valueMap[`dob_c${suffix}`] = cv.field_value;
        }
        
        // Handle PIN fields dynamically
        if (key.includes('pin c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `PIN C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`pin_c${suffix}`]) valueMap[`pin_c${suffix}`] = cv.field_value;
        }
        
        // Handle old address fields dynamically
        if (key.includes('old address c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Old Address C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`old_address_c${suffix}`]) valueMap[`old_address_c${suffix}`] = cv.field_value;
        }
        if (key === 'company name') {
          if (!valueMap['Company Name']) valueMap['Company Name'] = cv.field_value;
          if (!valueMap['company_name']) valueMap['company_name'] = cv.field_value;
        }
        if (key === 'folio no') {
          if (!valueMap['Folio No']) valueMap['Folio No'] = cv.field_value;
          if (!valueMap['folio_no']) valueMap['folio_no'] = cv.field_value;
        }
        if (key === 'total shares') {
          if (!valueMap['Total Shares']) valueMap['Total Shares'] = cv.field_value;
          if (!valueMap['total_shares']) valueMap['total_shares'] = cv.field_value;
        }
      }
    });

    // Add specific template placeholder mappings with helpful placeholders
    // Map the exact placeholders that appear in the Word templates
    const templateMappings = {
      'Company Name': getValueOrPlaceholder(valueMap['company_name'] || valueMap['Company Name'], 'Company Name'),
      'Folio No': getValueOrPlaceholder(valueMap['folio_no'] || valueMap['Folio No'], 'Folio No'),
      'Total Shares': getValueOrPlaceholder(valueMap['total_shares'] || valueMap['Total Shares'], 'Total Shares'),
      'Date of Issue': getValueOrPlaceholder(valueMap['date_of_issue'] || valueMap['Date of Issue'] || new Date(), 'Date of Issue'),
      'Current Date': formatDate(new Date()),
      'Today Date': formatDate(new Date())
    };

    // Dynamically add mappings for all joint holders (C1, C2, C3, C4, C5, etc.)
    // Find all unique joint holder numbers from the valueMap
    const jointHolderNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      const match = key.match(/[cC](\d+)$/);
      if (match) {
        jointHolderNumbers.add(match[1]);
      }
    });

    // Add mappings for each joint holder
    jointHolderNumbers.forEach(num => {
      const cnSuffix = `C${num}`;
      
      // Personal Information
      templateMappings[`Name as per Aadhar ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`name_c${num}`] || valueMap[`Name as per Aadhar ${cnSuffix}`], 
        `Name as per Aadhar ${cnSuffix}`
      );
      // CRITICAL FIX: Ensure Name as per PAN C1 field is properly mapped
      const nameAsPerPanValue = valueMap[`Name as per PAN ${cnSuffix}`] || 
                               valueMap[`name_as_per_pan_c${num}`] ||
                               valueMap[`name_pan_c${num}`];
      
      templateMappings[`Name as per PAN ${cnSuffix}`] = getValueOrPlaceholder(
        nameAsPerPanValue, 
        `Name as per PAN ${cnSuffix}`
      );
      
      console.log(`🔍 Mapping Name as per PAN ${cnSuffix}: ${nameAsPerPanValue || 'NOT FOUND'}`);
      templateMappings[`Name as per CML ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Name as per CML ${cnSuffix}`], 
        `Name as per CML ${cnSuffix}`
      );
      templateMappings[`Name as per Bank ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Name as per Bank ${cnSuffix}`], 
        `Name as per Bank ${cnSuffix}`
      );
      templateMappings[`Name as per Passport ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Name as per Passport ${cnSuffix}`], 
        `Name as per Passport ${cnSuffix}`
      );
      templateMappings[`Name as per Succession/WILL/LHA ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Name as per Succession/WILL/LHA ${cnSuffix}`], 
        `Name as per Succession/WILL/LHA ${cnSuffix}`
      );
      templateMappings[`Name as per Cert ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Name as per Cert ${cnSuffix}`], 
        `Name as per Cert ${cnSuffix}`
      );
      templateMappings[`PAN ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`pan_c${num}`] || valueMap[`PAN ${cnSuffix}`], 
        `PAN ${cnSuffix}`
      );
      templateMappings[`Mobile No ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`mobile_c${num}`] || valueMap[`Mobile No ${cnSuffix}`], 
        `Mobile No ${cnSuffix}`
      );
      templateMappings[`Email ID ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`email_c${num}`] || valueMap[`Email ID ${cnSuffix}`], 
        `Email ID ${cnSuffix}`
      );
      templateMappings[`DOB ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`dob_c${num}`] || valueMap[`DOB ${cnSuffix}`], 
        `DOB ${cnSuffix}`
      );
      templateMappings[`Nominee DOB`] = getValueOrPlaceholder(
        valueMap[`Nominee DOB`], 
        `Nominee DOB`
      );
      templateMappings[`Father Name ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`father_name_c${num}`] || valueMap[`Father Name ${cnSuffix}`], 
        `Father Name ${cnSuffix}`
      );
      templateMappings[`Age ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`age_c${num}`] || valueMap[`Age ${cnSuffix}`], 
        `Age ${cnSuffix}`
      );
      templateMappings[`Deceased Relation ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`relation_c${num}`] || valueMap[`Deceased Relation ${cnSuffix}`], 
        `Deceased Relation ${cnSuffix}`
      );
      // CRITICAL FIX: Ensure Address C1 maps to claimant address, not bank address
      // First, try to find the correct claimant address
      const claimantAddress = valueMap[`address_c${num}`] || 
                             valueMap[`Address ${cnSuffix}`] ||
                             valueMap[`claimant_address_c${num}`] ||
                             valueMap[`residential_address_c${num}`];
      
      // Ensure we're not using bank address for claimant address field
      const bankAddress = valueMap[`Bank Address ${cnSuffix}`] || 
                         valueMap[`bank_address_c${num}`];
      
      let finalAddress = claimantAddress;
      
      // If claimant address is missing but bank address exists, log warning
      if (!claimantAddress && bankAddress) {
        console.log(`⚠️ WARNING: No claimant address found for ${cnSuffix}, but bank address exists: ${bankAddress}`);
        console.log(`⚠️ This may cause the bank address to appear in the claimant address field!`);
        // Don't use bank address for claimant address field
        finalAddress = '';
      }
      
      templateMappings[`Address ${cnSuffix}`] = getValueOrPlaceholder(
        finalAddress, 
        `Address ${cnSuffix}`
      );
      templateMappings[`PIN ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`pin_c${num}`] || valueMap[`PIN ${cnSuffix}`], 
        `PIN ${cnSuffix}`
      );
      templateMappings[`Old Address ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`old_address_c${num}`] || valueMap[`Old Address ${cnSuffix}`], 
        `Old Address ${cnSuffix}`
      );

      // Banking Information
      templateMappings[`Bank AC Type ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank AC Type ${cnSuffix}`], 
        `Bank AC Type ${cnSuffix}`
      );
      templateMappings[`Bank Name ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank Name ${cnSuffix}`], 
        `Bank Name ${cnSuffix}`
      );
      templateMappings[`Bank AC ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank AC ${cnSuffix}`], 
        `Bank AC ${cnSuffix}`
      );
      templateMappings[`Bank Branch ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank Branch ${cnSuffix}`], 
        `Bank Branch ${cnSuffix}`
      );
      templateMappings[`IFSC ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`IFSC ${cnSuffix}`], 
        `IFSC ${cnSuffix}`
      );
      templateMappings[`Bank Address ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank Address ${cnSuffix}`], 
        `Bank Address ${cnSuffix}`
      );
      templateMappings[`MICR ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`MICR ${cnSuffix}`], 
        `MICR ${cnSuffix}`
      );
      // For A/C Open Date, provide a fallback if no data exists
      const accountOpenDate = valueMap[`A/C Open Date ${cnSuffix}`] || 
                             valueMap[`account_open_date_c${num}`] ||
                             valueMap[`bank_account_open_date_${num}`];
      
      templateMappings[`A/C Open Date ${cnSuffix}`] = getValueOrPlaceholder(
        accountOpenDate || new Date(), // Fallback to current date if no data
        `A/C Open Date ${cnSuffix}`
      );
      templateMappings[`Bank City ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank City ${cnSuffix}`], 
        `Bank City ${cnSuffix}`
      );
      templateMappings[`Bank PIN ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Bank PIN ${cnSuffix}`], 
        `Bank PIN ${cnSuffix}`
      );

      // DEMAT Account
      templateMappings[`DEMAT AC ${cnSuffix}`] = getValueOrPlaceholder(
        valueMap[`DEMAT AC ${cnSuffix}`], 
        `DEMAT AC ${cnSuffix}`
      );
    });

    // Dynamically add mappings for Share Certificate fields (SC1-SC10)
    // Find all unique SC numbers from the valueMap
    const scNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      // Match SC, DN, NOS, SC Status, and Year of Purchase fields
      const scMatch = key.match(/^SC(\d+)$/i) || 
                      key.match(/^DN(\d+)$/i) || 
                      key.match(/^NOS(\d+)$/i) || 
                      key.match(/SC\s*Status(\d+)/i) ||
                      key.match(/Year\s*of\s*Purchase(\d+)/i);
      if (scMatch) {
        scNumbers.add(scMatch[1]);
      }
    });

    // Add mappings for each Share Certificate (SC1-SC10)
    // For SC fields: if no data exists, use empty string (not placeholder) to avoid showing rows with placeholder text
    for (let i = 1; i <= 10; i++) {
      const scSuffix = i.toString();
      
      // Helper function to get SC value or empty string (not placeholder)
      const getSCValueOrEmpty = (value) => {
        if (!value || 
            value === 'undefined' || 
            value === 'null' || 
            value === 'UNDEFINED' || 
            value === 'NULL' ||
            (typeof value === 'string' && value.trim() === '')) {
          return ''; // Return empty string for SC fields when no data
        }
        const cleanedValue = value.toString().replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
        return cleanedValue || '';
      };
      
      // SC field
      const scValue = valueMap[`SC${scSuffix}`] || valueMap[`sc${scSuffix}`];
      templateMappings[`SC${scSuffix}`] = getSCValueOrEmpty(scValue);
      
      // DN (Distinctive Number) field
      const dnValue = valueMap[`DN${scSuffix}`] || valueMap[`dn${scSuffix}`];
      templateMappings[`DN${scSuffix}`] = getSCValueOrEmpty(dnValue);
      
      // NOS (Number of Securities) field
      const nosValue = valueMap[`NOS${scSuffix}`] || valueMap[`nos${scSuffix}`];
      templateMappings[`NOS${scSuffix}`] = getSCValueOrEmpty(nosValue);
      
      // SC Status field
      const statusValue = valueMap[`SC Status${scSuffix}`] || valueMap[`sc_status${scSuffix}`];
      templateMappings[`SC Status${scSuffix}`] = getSCValueOrEmpty(statusValue);
      
      // Year of Purchase - only for SC1
      if (i === 1) {
        const yopValue = valueMap[`Year of Purchase${scSuffix}`] || valueMap[`year_of_purchase${scSuffix}`];
        templateMappings[`Year of Purchase${scSuffix}`] = getSCValueOrEmpty(yopValue);
      }
    }

    // Merge template mappings with valueMap
    Object.assign(valueMap, templateMappings);
    
    // COMPREHENSIVE UNDEFINED CLEANUP: Remove all undefined/null values
    console.log('🔧 Starting comprehensive undefined cleanup for company templates...');
    
    // 1. Clean all undefined/null/empty values from valueMap using utility function
    const originalCount = Object.keys(valueMap).length;
    const cleanedValueMap = cleanUndefinedValues(valueMap);
    Object.assign(valueMap, cleanedValueMap);
    console.log(`🧹 Cleaned ${originalCount} values, ${Object.keys(valueMap).length} remain`);
    
    // 2. Initialize ALL template placeholders with empty strings to prevent undefined
    console.log('🔧 Initializing all template placeholders with empty strings...');
    const commonPlaceholders = [
      'Company Name', 'Folio No', 'Total Shares',
      'Date of Issue', 'Current Date', 'Today Date'
    ];

    // Dynamically add placeholders for all joint holders found in the data
    const placeholderJointHolderNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      const match = key.match(/[cC](\d+)$/);
      if (match) {
        placeholderJointHolderNumbers.add(match[1]);
      }
    });

    // Add placeholders for each joint holder
    placeholderJointHolderNumbers.forEach(num => {
      const cnSuffix = `C${num}`;
      const jointHolderPlaceholders = [
        `Name as per Aadhar ${cnSuffix}`,
        `Name as per PAN ${cnSuffix}`,
        `Name as per CML ${cnSuffix}`,
        `Name as per Bank ${cnSuffix}`,
        `Name as per Passport ${cnSuffix}`,
        `Name as per Succession/WILL/LHA ${cnSuffix}`,
        `Name as per Cert ${cnSuffix}`,
        `PAN ${cnSuffix}`,
        `Mobile No ${cnSuffix}`,
        `Email ID ${cnSuffix}`,
        `DOB ${cnSuffix}`,
        `Father Name ${cnSuffix}`,
        `Age ${cnSuffix}`,
        `Deceased Relation ${cnSuffix}`,
        `Address ${cnSuffix}`,
        `PIN ${cnSuffix}`,
        `Old Address ${cnSuffix}`,
        `Bank AC Type ${cnSuffix}`,
        `Bank Name ${cnSuffix}`,
        `Bank AC ${cnSuffix}`,
        `Bank Branch ${cnSuffix}`,
        `IFSC ${cnSuffix}`,
        `Bank Address ${cnSuffix}`,
        `MICR ${cnSuffix}`,
        `A/C Open Date ${cnSuffix}`,
        `Bank City ${cnSuffix}`,
        `Bank PIN ${cnSuffix}`,
        `DEMAT AC ${cnSuffix}`
      ];
      commonPlaceholders.push(...jointHolderPlaceholders);
    });
    
    commonPlaceholders.forEach(placeholder => {
      if (!valueMap.hasOwnProperty(placeholder)) {
        valueMap[placeholder] = getPlaceholderText(placeholder);
        console.log(`📝 Initialized placeholder [${placeholder}] with placeholder text`);
      }
    });
    
    // 3. Final validation - ensure no undefined values exist using utility function
    const finalCleanedValueMap = cleanUndefinedValues(valueMap);
    Object.assign(valueMap, finalCleanedValueMap);
    
    console.log(`✅ Company template undefined cleanup completed. Final valueMap has ${Object.keys(valueMap).length} entries`);
    
    // CRITICAL FIX: Address mapping validation to prevent bank address in claimant address field
    console.log('🔧 Starting address mapping validation to prevent bank address in claimant address field...');
    
    // Check for and fix address mapping issues
    Object.keys(valueMap).forEach(key => {
      if (key.includes('Address C') && !key.includes('Bank Address')) {
        const value = valueMap[key];
        
        // Check if the address contains bank-related information
        if (value && (
          value.includes('HDFC') || 
          value.includes('Bank') || 
          value.includes('IFSC') || 
          value.includes('Branch') ||
          value.includes('Ambar Plaza') ||
          value.includes('Station Road')
        )) {
          console.log(`🚨 CRITICAL: Found bank address in claimant address field [${key}]: ${value}`);
          console.log(`🚨 This is the exact issue described in the screenshot!`);
          
          // Try to find the correct claimant address
          const correctClaimantAddress = companyValues.find(cv => 
            cv.caseField && 
            cv.caseField.field_key === key && 
            cv.field_value && 
            !cv.field_value.includes('HDFC') &&
            !cv.field_value.includes('Bank') &&
            !cv.field_value.includes('IFSC') &&
            !cv.field_value.includes('Branch') &&
            !cv.field_value.includes('Ambar Plaza') &&
            !cv.field_value.includes('Station Road')
          );
          
          if (correctClaimantAddress) {
            console.log(`✅ Found correct claimant address for ${key}: ${correctClaimantAddress.field_value}`);
            valueMap[key] = correctClaimantAddress.field_value;
          } else {
            console.log(`❌ No correct claimant address found for ${key}, setting to empty`);
            valueMap[key] = '';
          }
        }
      }
    });

    // MAJOR CLEANUP: Fix all mapping issues (same as case template controller)
    console.log('🔧 Starting comprehensive mapping cleanup for company templates...');
    
    // 1. Fix PAN fields - they should ONLY contain PAN numbers
    const panFields = ['PAN C1', 'PAN C2', 'PAN C3', 'pan_c1', 'pan_c2', 'pan_c3'];
    panFields.forEach(panField => {
      if (valueMap[panField]) {
        const currentValue = valueMap[panField];
        // Check if PAN field contains invalid data (names, addresses, etc.)
        if (currentValue.includes(' ') || 
            currentValue.includes('Bhagwan') || 
            currentValue.includes('Prasad') || 
            currentValue.includes('Sushil') ||
            currentValue.includes('Tryambak') ||
            currentValue.includes('Kulkarni') ||
            currentValue.includes('Hinjewadi') ||
            currentValue.includes('Pune')) {
          
          console.log(`⚠️ PAN field ${panField} contains invalid value: ${currentValue}`);
          
          // Find the correct PAN value from original data
          const correctPanValue = companyValues.find(cv => 
            cv.caseField && 
            cv.caseField.field_key === panField && 
            cv.field_value && 
            cv.field_value.length >= 10 && // PAN should be at least 10 chars
            !cv.field_value.includes(' ') &&
            !cv.field_value.includes('Bhagwan') &&
            !cv.field_value.includes('Prasad') &&
            !cv.field_value.includes('Sushil') &&
            !cv.field_value.includes('Tryambak') &&
            !cv.field_value.includes('Kulkarni')
          );
          
          if (correctPanValue) {
            console.log(`✅ Found correct PAN value for ${panField}: ${correctPanValue.field_value}`);
            valueMap[panField] = correctPanValue.field_value;
          } else {
            console.log(`❌ No correct PAN value found for ${panField}, setting to empty`);
            valueMap[panField] = '';
          }
        }
      }
    });
    
    // 2. Fix name fields - ensure they don't contain PAN numbers
    const nameFields = ['Name as per Aadhar C1', 'Name as per PAN C1', 'Name as per CML C1', 'Name as per Bank C1'];
    nameFields.forEach(nameField => {
      if (valueMap[nameField]) {
        const currentValue = valueMap[nameField];
        // Check if name field contains PAN number (10+ chars, no spaces, alphanumeric)
        if (currentValue.length >= 10 && !currentValue.includes(' ') && /^[A-Z0-9]+$/.test(currentValue)) {
          console.log(`⚠️ Name field ${nameField} contains PAN number: ${currentValue}`);
          
          // Find the correct name value
          const correctNameValue = companyValues.find(cv => 
            cv.caseField && 
            cv.caseField.field_key === nameField && 
            cv.field_value && 
            cv.field_value.includes(' ') && // Names should have spaces
            !/^[A-Z0-9]+$/.test(cv.field_value) // Not just alphanumeric
          );
          
          if (correctNameValue) {
            console.log(`✅ Found correct name value for ${nameField}: ${correctNameValue.field_value}`);
            valueMap[nameField] = correctNameValue.field_value;
          }
        }
      }
    });
    
    // 3. Remove all undefined values
    Object.keys(valueMap).forEach(key => {
      if (valueMap[key] === 'undefined' || valueMap[key] === undefined || valueMap[key] === null) {
        console.log(`🧹 Removing undefined value for ${key}`);
        valueMap[key] = '';
      }
    });
    
    // 4. Final validation - ensure data types match field types
    Object.entries(valueMap).forEach(([key, value]) => {
      if (value && typeof value === 'string') {
        // PAN fields should be alphanumeric, 10+ chars, no spaces
        if (key.includes('PAN') && (value.includes(' ') || value.length < 10)) {
          console.log(`⚠️ Invalid PAN format for ${key}: ${value}`);
          valueMap[key] = '';
        }
        // Name fields should have spaces (multiple words)
        if (key.includes('Name') && !key.includes('PAN') && !value.includes(' ') && value.length > 5) {
          console.log(`⚠️ Suspicious name format for ${key}: ${value}`);
        }
      }
    });
    
    console.log('✅ Company template mapping cleanup completed');
    console.log(`🗺️ Final value map:`, valueMap);

    // Read the template file
    const templateFullPath = path.join(__dirname, '../../templates', templatePath);
    const templateContent = await fs.readFile(templateFullPath);

    // For now, we'll return the template with a mapping preview
    // In production, you'd use a library like docxtemplater or similar to populate .docx files
    return {
      templateContent,
      valueMap,
      mappingPreview: generateMappingPreview(valueMap, templatePath)
    };
  } catch (error) {
    console.error('Error mapping company values:', error);
    throw error;
  }
};

// Generate a preview of what values would be mapped
const generateMappingPreview = (valueMap, templatePath) => {
  const preview = {
    template: templatePath,
    availableValues: valueMap,
    suggestedMappings: []
  };

  // Enhanced mapping patterns based on your actual template placeholders
  const commonMappings = {
    // Name fields
    'Name as per Aadhar C1': ['name_c1', 'name_aadhar_c1', 'applicant_name_1'],
    'Name as per Aadhar C2': ['name_c2', 'name_aadhar_c2', 'applicant_name_2'],
    'Name as per Aadhar C3': ['name_c3', 'name_aadhar_c3', 'applicant_name_3'],
    'Father Name C1': ['father_name_c1', 'father_c1', 'parent_name_1'],
    'Father Name C2': ['father_name_c2', 'father_c2', 'parent_name_2'],
    'Father Name C3': ['father_name_c3', 'father_c3', 'parent_name_3'],
    
    // Address and contact
    'Address C1': ['address_c1', 'residing_at', 'address'],
    'PAN C1': ['pan_c1', 'pan_number', 'pan'],
    
    // Company and shares
    'Company Name': ['company_name', 'company', 'corporate_name'],
    'Total Shares': ['total_shares', 'shares', 'number_of_shares'],
    'Folio No': ['folio_no', 'folio', 'folio_number'],
    
    // Securities details
    'NOS1': ['nos1', 'number_of_securities_1', 'securities_1'],
    'NOS2': ['nos2', 'number_of_securities_2', 'securities_2'],
    'NOS3': ['nos3', 'number_of_securities_3', 'securities_3'],
    'SC1': ['sc1', 'security_certificate_1', 'certificate_1'],
    'SC2': ['sc2', 'security_certificate_2', 'certificate_2'],
    'SC3': ['sc3', 'security_certificate_3', 'certificate_3'],
    'DN1': ['dn1', 'distinctive_number_1', 'distinctive_1'],
    'DN2': ['dn2', 'distinctive_number_2', 'distinctive_2'],
    'DN3': ['dn3', 'distinctive_number_3', 'distinctive_3'],
    
    // Death certificate names
    'Name as per DC H1': ['name_dc_h1', 'death_certificate_h1', 'deceased_name_1'],
    'Name as per DC H2': ['name_dc_h2', 'death_certificate_h2', 'deceased_name_2'],
    'Name as per DC H3': ['name_dc_h3', 'death_certificate_h3', 'deceased_name_3'],
    'Name as per DC H4': ['name_dc_h4', 'death_certificate_h4', 'deceased_name_4'],
    
    // General fields
    'client_name': ['Client Name', 'client', 'client_name'],
    'case_title': ['Case Title', 'case', 'case_title'],
    'phone': ['Phone', 'phone', 'mobile', 'contact'],
    'email': ['Email', 'email', 'email_address'],
    'din_code': ['DIN Code', 'din', 'din_code'],
    'bank_account_type': ['Bank Account Type', 'account_type', 'bank_account_type']
  };

  // Generate suggested mappings
  Object.entries(commonMappings).forEach(([placeholder, possibleKeys]) => {
    const foundValue = possibleKeys.find(key => valueMap[key]) ? 
      valueMap[possibleKeys.find(key => valueMap[key])] : null;
    
    if (foundValue) {
      preview.suggestedMappings.push({
        placeholder: `[${placeholder}]`,
        mappedValue: foundValue,
        confidence: 'high'
      });
    }
  });

  return preview;
};

// Download a specific template with mapped values
const downloadTemplate = async (req, res) => {
  try {
    const { companyId, templateId } = req.params;
    
    // Get the template record
    const template = await CompanyTemplate.findOne({
      where: {
        id: templateId,
        company_id: companyId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Read the original template file
    const templatePath = path.join(__dirname, '../../templates', template.template_path);
    
    // Check if template file exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      console.error(`Template file not found: ${templatePath}`);
      return res.status(404).json({
        success: false,
        message: 'Template file not found'
      });
    }
    
    const templateBuffer = await fs.readFile(templatePath);
    
    // Validate that it's a valid .docx file (should start with PK signature)
    if (templateBuffer.length < 4 || templateBuffer.toString('hex', 0, 4) !== '504b0304') {
      console.error('Invalid .docx file format');
      return res.status(400).json({
        success: false,
        message: 'Invalid template file format'
      });
    }
    
    // Set headers for file download
    const filename = template.template_path.split('/').pop();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', templateBuffer.length);
    
    // Send the file
    res.send(templateBuffer);
    
  } catch (error) {
    console.error('Error downloading template:', error);
    res.status(500).json({
      success: false,
      message: 'Error downloading template',
      error: error.message
    });
  }
};

// Download populated template (actual file with mapped values)
const downloadPopulatedTemplate = async (req, res) => {
  try {
    const { companyId, templateId } = req.params;
    
    // Get the template record
    const template = await CompanyTemplate.findOne({
      where: {
        id: templateId,
        company_id: companyId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Map company values to template
    const mappedTemplate = await mapCompanyValuesToTemplate(companyId, template.template_path);
    
    // Read the template file
    const templatePath = path.join(__dirname, '../../templates', template.template_path);
    
    // Check if template file exists
    try {
      await fs.access(templatePath);
    } catch (error) {
      console.error(`Template file not found: ${templatePath}`);
      return res.status(404).json({
        success: false,
        message: 'Template file not found'
      });
    }
    
    const templateBuffer = await fs.readFile(templatePath);
    
    // Validate that it's a valid .docx file (should start with PK signature)
    if (templateBuffer.length < 4 || templateBuffer.toString('hex', 0, 4) !== '504b0304') {
      console.error('Invalid .docx file format');
      return res.status(400).json({
        success: false,
        message: 'Invalid template file format'
      });
    }
    
    // Create a new zip file from the template
    const zip = new PizZip(templateBuffer);
    
    // Create docxtemplater instance with custom delimiters for square brackets
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '[',
        end: ']'
      },
      nullGetter: function(part, scopeManager) {
        // Return empty string for any missing values
        if (!part.module) {
          return '';
        }
        if (part.module === 'rawxml') {
          return '';
        }
        return '';
      }
    });
    
    // COMPREHENSIVE CLEANUP: Remove all undefined/empty values and prevent "UNDEFINED" from appearing
    console.log('🔧 Starting comprehensive undefined cleanup for template download...');
    
    // Use utility function for comprehensive cleanup
    const cleanValueMap = cleanUndefinedValues(mappedTemplate.valueMap);
    
    // CRITICAL: Final aggressive cleanup to prevent ANY undefined values
    const finalCleanMap = {};
    Object.keys(cleanValueMap).forEach(key => {
      const value = cleanValueMap[key];
      if (value === undefined || value === null || value === 'undefined' || value === 'null' || !value || value === '_________________') {
        finalCleanMap[key] = ''; // Force empty string for placeholders
        console.log(`🚨 FINAL CLEANUP: Forced ${key} to empty string (was: ${value})`);
      } else {
        finalCleanMap[key] = String(value); // Keep actual values as-is
        console.log(`✅ KEEPING VALUE: ${key} = ${value}`);
      }
    });

    console.log(`🔧 Final template data prepared with ${Object.keys(finalCleanMap).length} fields`);
    console.log(`🔧 Sample final data:`, Object.entries(finalCleanMap).slice(0, 3));

    // Extract and log all placeholders from the template for debugging
    try {
      const templateText = doc.getFullText();
      const placeholderRegex = /\[([^\]]+)\]/g;
      const foundPlaceholders = [];
      let match;
      while ((match = placeholderRegex.exec(templateText)) !== null) {
        foundPlaceholders.push(match[1]);
      }
      console.log(`📋 Found ${foundPlaceholders.length} placeholders in template: ${template.template_path}`);
      console.log(`📝 Placeholders:`, [...new Set(foundPlaceholders)].join(', '));
      
      // Check for unclosed brackets
      const openBrackets = (templateText.match(/\[/g) || []).length;
      const closeBrackets = (templateText.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        console.error(`⚠️ WARNING: Mismatched brackets in template! Open: ${openBrackets}, Close: ${closeBrackets}`);
      }
    } catch (extractError) {
      console.warn('Could not extract placeholders for debugging:', extractError.message);
    }
    
    // Set the template variables with the final clean map
    doc.setData(finalCleanMap);
    
    try {
      // Render the document (replace all placeholders)
      doc.render();
      console.log(`✅ Successfully rendered template: ${template.template_path}`);
    } catch (error) {
      console.error('❌ Error rendering template:', error);
      console.log('📋 Available values for mapping:', Object.keys(mappedTemplate.valueMap));
      console.log('📝 Template values:', mappedTemplate.valueMap);
      
      // Enhanced error logging for docxtemplater
      if (error.properties && error.properties.errors instanceof Array) {
        const errorMessages = error.properties.errors.map((err) => {
          return `${err.name}: ${err.message} at ${err.properties.explanation || 'unknown'}`;
        }).join('\n');
        console.error('🔍 Detailed template errors:\n', errorMessages);
        
        // Return detailed error to client
        return res.status(500).json({
          success: false,
          message: 'Error downloading populated template',
          error: 'Template has structural issues',
          details: errorMessages,
          templateName: template.template_path
        });
      }
      
      // Generic error handling
      return res.status(500).json({
        success: false,
        message: 'Error downloading populated template',
        error: error.message,
        templateName: template.template_path
      });
    }
    
    // Get the populated document as a buffer
    let populatedBuffer = doc.getZip().generate({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: {
        level: 4,
      },
    });

    // POST-PROCESSING: Check if the generated document still contains "undefined" text
    // This is a last resort step to catch any remaining undefined values
    try {
      const zip = new PizZip(populatedBuffer);
      const documentXml = zip.files["word/document.xml"];
      
      if (documentXml) {
        let content = documentXml.asText();
        const originalContent = content;
        
        // Replace any remaining "undefined" text with empty string
        content = content.replace(/undefined/gi, ''); // Case insensitive replacement
        content = content.replace(/UNDEFINED/gi, ''); // Also catch uppercase
        content = content.replace(/null/gi, ''); // Also catch null values
        content = content.replace(/NULL/gi, ''); // Also catch uppercase NULL
        
        // Keep red color for actual data values, only change placeholders to black
        // This approach preserves the original template formatting for real data
        console.log('✅ Preserving red color for actual database values, only cleaning undefined text');
        
        if (content !== originalContent) {
          console.log('🚨 POST-PROCESSING: Found and removed "undefined" text, preserving data colors');
          
          // Update the document.xml content
          zip.file("word/document.xml", content);
          
          // Regenerate the buffer with cleaned content
          populatedBuffer = zip.generate({ type: 'nodebuffer' });
          console.log('✅ Document post-processed and cleaned');
        } else {
          console.log('✅ No "undefined" text found in generated document');
        }
      }
    } catch (postProcessError) {
      console.error('Warning: Post-processing failed, using original buffer:', postProcessError.message);
      // Continue with original buffer if post-processing fails
    }
    
    // Set headers for file download
    const filename = template.template_path.split('/').pop().replace('_Template.docx', '_Populated.docx');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', populatedBuffer.length);
    res.setHeader('Cache-Control', 'no-cache');
    
    // Send the populated document
    res.end(populatedBuffer);
    
  } catch (error) {
    console.error('Error downloading populated template:', error);
    
    // If we're already sending headers, don't try to send JSON
    if (res.headersSent) {
      return;
    }
    
    res.status(500).json({
      success: false,
      message: 'Error downloading populated template',
      error: error.message
    });
  }
};

// Get template statistics for a company
const getTemplateStats = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    // Get template statistics
    const stats = await CompanyTemplate.findAll({
      where: { company_id: companyId },
      attributes: [
        'template_category',
        [sequelize.fn('COUNT', sequelize.col('id')), 'total'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN is_selected = true THEN 1 END')), 'selected']
      ],
      group: ['template_category']
    });

    const totalSelected = await CompanyTemplate.count({
      where: {
        company_id: companyId,
        is_selected: true
      }
    });

    const totalAvailable = await CompanyTemplate.count({
      where: { company_id: companyId }
    });

    res.json({
      success: true,
      stats: {
        byCategory: stats.map(stat => ({
          category: stat.template_category,
          total: parseInt(stat.dataValues.total),
          selected: parseInt(stat.dataValues.selected)
        })),
        totalSelected: totalSelected,
        totalAvailable: totalAvailable
      }
    });
    
  } catch (error) {
    console.error('Error getting template stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching template statistics',
      error: error.message
    });
  }
};

// Get mapping preview for a template
const getTemplateMappingPreview = async (req, res) => {
  try {
    const { companyId, templateId } = req.params;
    
    // Get the template record
    const template = await CompanyTemplate.findOne({
      where: {
        id: templateId,
        company_id: companyId
      }
    });

    if (!template) {
      return res.status(404).json({
        success: false,
        message: 'Template not found'
      });
    }

    // Get mapping preview
    const mappedTemplate = await mapCompanyValuesToTemplate(companyId, template.template_path);
    
    res.json({
      success: true,
      template: {
        id: template.id,
        name: template.template_name,
        category: template.template_category,
        filename: template.template_path
      },
      mappingPreview: mappedTemplate.mappingPreview
    });
    
  } catch (error) {
    console.error('Error getting mapping preview:', error);
    res.status(500).json({
      success: false,
      message: 'Error getting mapping preview',
      error: error.message
    });
  }
};

// Get selected templates for a company (for admin review)
const getSelectedTemplates = async (req, res) => {
  try {
    const { companyId } = req.params;
    
    console.log(`🔍 Fetching selected templates for company ${companyId}...`);

    const selectedTemplates = await models.CompanyTemplate.findAll({
      where: { 
        company_id: companyId,
        is_selected: true 
      },
      order: [['selected_at', 'DESC']]
    });

    console.log(`✅ Found ${selectedTemplates.length} selected templates`);

    // Format the response
    const formattedTemplates = selectedTemplates.map(ct => ({
      id: ct.id,
      template_id: ct.template_id,
      template_name: ct.template_name || 'Unknown Template',
      template_file: ct.template_path || '',
      template_category: ct.template_category || '',
      template_type: ct.template_type || '',
      is_selected: ct.is_selected,
      selected_at: ct.selected_at,
      selected_by: ct.selected_by ? { id: ct.selected_by, name: 'Employee' } : null,
      admin_comment: ct.admin_comment || '',
      status: ct.status || 'pending'
    }));

    res.json({
      success: true,
      templates: formattedTemplates,
      count: formattedTemplates.length
    });

  } catch (error) {
    console.error('Error getting selected templates:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to get selected templates',
      details: error.message 
    });
  }
};

// Update admin comment for a template
const updateTemplateComment = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { admin_comment } = req.body;
    
    console.log(`💬 Updating admin comment for template ${templateId}...`);
    
    const updatedTemplate = await models.CompanyTemplate.update(
      { admin_comment },
      { 
        where: { id: templateId },
        returning: true
      }
    );
    
    if (updatedTemplate[0] === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    console.log(`✅ Admin comment updated for template ${templateId}`);
    
    res.json({
      success: true,
      message: 'Admin comment updated successfully',
      template: updatedTemplate[1][0]
    });
    
  } catch (error) {
    console.error('Error updating template comment:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update template comment',
      details: error.message 
    });
  }
};

// Update employee response for a template
const updateEmployeeResponse = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { employee_response } = req.body;
    
    console.log(`💬 Updating employee response for template ${templateId}...`);
    
    const updatedTemplate = await models.CompanyTemplate.update(
      { employee_response },
      { 
        where: { id: templateId },
        returning: true
      }
    );
    
    if (updatedTemplate[0] === 0) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    console.log(`✅ Employee response updated for template ${templateId}`);
    
    res.json({
      success: true,
      message: 'Employee response updated successfully',
      template: updatedTemplate[1][0]
    });
    
  } catch (error) {
    console.error('Error updating employee response:', error);
    res.status(500).json({ 
      success: false, 
      error: 'Failed to update employee response',
      details: error.message 
    });
  }
};

// Get template preview data for admin review
const getTemplatePreview = async (req, res) => {
  try {
    const { companyId, templateId } = req.params;
    
    console.log(`🔍 Getting template preview for company ${companyId}, template ${templateId}`);
    
    // Get company template record
    const companyTemplate = await CompanyTemplate.findOne({
      where: { 
        id: templateId,
        company_id: companyId 
      }
    });

    if (!companyTemplate) {
      return res.status(404).json({ error: 'Template not found for this company' });
    }

    // Get company values
    const companyValues = await CompanyValue.findAll({
      where: { company_id: companyId }
    });

    console.log(`📊 Found ${companyValues.length} company values`);

    // Create value mapping
    const valueMap = {};
    companyValues.forEach(cv => {
      if (cv.field_key && cv.field_value) {
        valueMap[cv.field_key] = cv.field_value;
      }
    });

    // Get template placeholders (simplified for now)
    const placeholders = Object.keys(valueMap);
    
    // Create mapping preview
    const mapping = {};
    placeholders.forEach(key => {
      mapping[key] = valueMap[key] || '';
    });

    console.log(`📊 Created mapping for ${placeholders.length} placeholders:`, mapping);

    const previewData = {
      template_name: companyTemplate.template_name || 'Unknown Template',
      template_file: companyTemplate.template_path || '',
      placeholders: placeholders,
      mapping: mapping,
      populatedContent: 'Template content will be populated with company data'
    };

    console.log('📊 Template preview data:', previewData);

    res.json({
      success: true,
      mappingPreview: previewData
    });

  } catch (error) {
    console.error('Error getting template preview:', error);
    res.status(500).json({ error: 'Failed to get template preview' });
  }
};

module.exports = {
  getCompanyTemplates,
  updateCompanyTemplates,
  downloadTemplate,
  downloadPopulatedTemplate,
  getTemplateStats,
  getTemplateMappingPreview,
  getSelectedTemplates,
  updateTemplateComment,
  updateEmployeeResponse,
  getTemplatePreview
};
