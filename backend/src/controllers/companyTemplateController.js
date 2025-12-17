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
      // Return empty string when value is not present (no placeholders)
      cleaned[key] = getPlaceholderText(key);
    } else if (typeof value === 'string') {
      // Clean any string values that contain "undefined" text
      const cleanedValue = value.replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
      if (cleanedValue === '') {
        cleaned[key] = getPlaceholderText(key); // Returns empty string
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
  // Return empty string instead of placeholders when values are not present
  // This prevents showing underscores, ampersands, and other placeholder characters
  return '';
};

// Helper function to clean comma-separated lists (for certificate numbers, distinctive numbers, etc.)
const cleanCommaSeparatedList = (value) => {
  if (!value || typeof value !== 'string') return '';
  
  // Split by comma and filter out empty values, placeholders, and unwanted characters
  const parts = value.split(',').map(part => part.trim()).filter(part => {
    return part && 
           part !== '' && 
           part !== '&' && 
           part !== '&amp;' && 
           part !== 'undefined' && 
           part !== 'null' &&
           part !== '_________________' &&
           !part.match(/^[.,\s&]+$/); // Not just separators
  });
  
  // Join back with commas, but clean up the result
  let cleaned = parts.join(', ');
  
  // Remove any trailing separators
  cleaned = cleaned.replace(/[,.\s&]+$/g, '');
  cleaned = cleaned.replace(/^[,.\s&]+/g, '');
  
  return cleaned.trim();
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
  
  // Special handling for date fields - include DOD, Date of demise, and all date variations
  if (fieldName && (
    fieldName.includes('Date') || 
    fieldName.includes('DOB') || 
    fieldName.includes('DOD') || 
    fieldName.toLowerCase().includes('date of demise') ||
    fieldName.toLowerCase().includes('demise')
  )) {
    const formattedDate = formatDate(value);
    if (formattedDate) {
      return formattedDate;
    }
  }
  
  // Clean the value of any undefined text
  let cleanedValue = value.toString().replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
  
  // Remove trailing commas, "&", dots, etc. from all values
  cleanedValue = cleanedValue.replace(/[,.\s]*&[\s,]*$/g, ''); // Remove trailing "&" with any surrounding commas/spaces
  cleanedValue = cleanedValue.replace(/[,.\s]*&amp;[\s,]*$/g, ''); // Remove trailing "&amp;"
  cleanedValue = cleanedValue.replace(/[,.\s]+$/g, ''); // Remove trailing commas, dots, and spaces
  cleanedValue = cleanedValue.replace(/^[\s,]+/g, ''); // Remove leading commas and spaces
  cleanedValue = cleanedValue.replace(/,{2,}/g, ','); // Remove multiple consecutive commas
  cleanedValue = cleanedValue.replace(/,\s*&/g, ''); // Remove ", &"
  cleanedValue = cleanedValue.replace(/\.\s*&/g, ''); // Remove ". &"
  cleanedValue = cleanedValue.trim();
  
  if (cleanedValue === '' || 
      cleanedValue === '&' || 
      cleanedValue === '&amp;' ||
      cleanedValue === ',' ||
      cleanedValue === '.' ||
      cleanedValue.match(/^[,.\s&]+$/)) {
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

    // Always scan templates directory to sync with filesystem (for new templates like LH6-LH10)
    console.log(`Scanning templates directory for company ${companyId} to sync with database...`);
    
    try {
      // Scan templates directory
      const templatesDir = path.join(__dirname, '../../templates');
      const templateFiles = await fs.readdir(templatesDir);
      const docxFiles = templateFiles.filter(file => file.endsWith('.docx') && !file.startsWith('~$'));
      
      console.log(`Found ${docxFiles.length} template files in directory`);
      
      // Get existing template filenames from database
      const existingTemplatePaths = new Set(allTemplates.map(t => t.template_path));
      
      // Find new templates that exist in filesystem but not in database
      const newTemplateRecords = [];
      
      for (const file of docxFiles) {
        // Skip if this template already exists in database
        if (existingTemplatePaths.has(file)) {
          continue;
        }
        
        // This is a new template, add it to database
        const category = categorizeTemplate(file);
        const templateName = cleanTemplateName(file);
        
        console.log(`Adding new template to database: ${file} (category: ${category})`);
        
        newTemplateRecords.push({
          company_id: companyId,
          template_name: templateName,
          template_category: category,
          template_path: file, // Store relative path
          is_selected: false, // Default to not selected
          selected_by: null,
          selected_at: null
        });
      }
      
      // Bulk create new templates for this company
      if (newTemplateRecords.length > 0) {
        await CompanyTemplate.bulkCreate(newTemplateRecords);
        console.log(`Created ${newTemplateRecords.length} new template records for company ${companyId}`);
      }
      
      // Now fetch all templates (existing + newly added)
      const updatedTemplates = await CompanyTemplate.findAll({
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
      
      // Process all templates (existing + newly added)
      updatedTemplates.forEach(template => {
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
      
      // Count selected templates
      selectedCount = updatedTemplates.filter(t => t.is_selected).length;
      
    } catch (dirError) {
      console.error('Error scanning templates directory:', dirError);
      
      // Fallback to existing templates if directory scan fails
      allTemplates.forEach(template => {
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
    
    // Log all company values for debugging
    console.log(`📋 All company values:`, companyValues.map(cv => ({
      key: cv.caseField?.field_key,
      label: cv.caseField?.field_label,
      value: cv.field_value
    })));

    // Create a mapping object for easy lookup
    const valueMap = {};
    const allNameFields = {}; // Store all name fields for fallback (C fields)
    const allHFields = {}; // Store all H fields for fallback
    
    companyValues.forEach(cv => {
      if (cv.caseField && cv.field_value) {
        console.log(`📝 Mapping: ${cv.caseField.field_key} = "${cv.field_value}"`);
        
        // Map by field key (exact match)
        valueMap[cv.caseField.field_key] = cv.field_value;
        // Map by field label (exact match)
        valueMap[cv.caseField.field_label] = cv.field_value;
        
        // Store all name fields for fallback
        const key = cv.caseField.field_key.toLowerCase();
        const label = cv.caseField.field_label.toLowerCase();
        
        // If this is any kind of name field with C, store it for fallback
        // Check both field_key and field_label
        const hasCInKey = key.includes('name') && (key.match(/c\d+$/i) || key.match(/c\s*\d+/i));
        const hasCInLabel = label.includes('name') && (label.match(/c\d+$/i) || label.match(/c\s*\d+/i));
        
        if (hasCInKey || hasCInLabel) {
          const cMatch = key.match(/c\s*(\d+)/i) || label.match(/c\s*(\d+)/i);
          if (cMatch) {
            const cNum = cMatch[1];
            if (!allNameFields[`c${cNum}`]) allNameFields[`c${cNum}`] = [];
            allNameFields[`c${cNum}`].push({
              key: cv.caseField.field_key,
              label: cv.caseField.field_label,
              value: cv.field_value
            });
            console.log(`📝 Stored name field for C${cNum}: ${cv.caseField.field_key} = "${cv.field_value}"`);
          }
        }
        
        // If this is any kind of name field with H, store it for fallback
        // Check both field_key and field_label
        const hasHInKey = key.includes('name') && (key.match(/h\d+$/i) || key.match(/h\s*\d+/i));
        const hasHInLabel = label.includes('name') && (label.match(/h\d+$/i) || label.match(/h\s*\d+/i));
        
        if (hasHInKey || hasHInLabel) {
          const hMatch = key.match(/h\s*(\d+)/i) || label.match(/h\s*(\d+)/i);
          if (hMatch) {
            const hNum = hMatch[1];
            if (!allHFields[`h${hNum}`]) allHFields[`h${hNum}`] = [];
            allHFields[`h${hNum}`].push({
              key: cv.caseField.field_key,
              label: cv.caseField.field_label,
              value: cv.field_value
            });
            console.log(`📝 Stored name field for H${hNum}: ${cv.caseField.field_key} = "${cv.field_value}"`);
          }
        }
        
        // Create additional mappings for common variations
        
        // Map common variations - be more specific to avoid overwriting
        // Handle C1, C2, C3, and dynamic joint holders (C4, C5, C6, etc.)
        if (key.includes('name as per aadhar c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per Aadhar C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_c${suffix}`]) valueMap[`name_c${suffix}`] = cv.field_value;
        }
        // Handle "Name as per PAN C1" with multiple variations
        // Check both field_key and field_label for "name as per pan"
        const isNameAsPerPan = (key.includes('name as per pan') || key.includes('name_as_per_pan') || 
                                label.includes('name as per pan') || label.includes('name_as_per_pan'));
        
        // Match patterns like "c1", "c 1", "C1", "C 1" at the end or in the middle
        const panMatch = key.match(/c\s*(\d+)/i) || label.match(/c\s*(\d+)/i) || 
                           cv.caseField.field_key.match(/c\s*(\d+)/i) || 
                           cv.caseField.field_label.match(/c\s*(\d+)/i);
        
        if (isNameAsPerPan) {
          if (panMatch) {
            // Has C number suffix (e.g., "Name as per PAN C1")
            const suffix = panMatch[1];
            const fieldKey = `Name as per PAN C${suffix}`;
            
            // Map to all possible variations (case-insensitive and with/without spaces)
            const variations = [
              fieldKey, // "Name as per PAN C1"
              `name_pan_c${suffix}`, // snake_case
              `name_as_per_pan_c${suffix}`, // snake_case full
              `Name As Per PAN C${suffix}`, // Title Case
              `Name As Per Pan C${suffix}`, // Mixed case
              `name as per pan c${suffix}`, // lowercase
              `Name as per PAN C ${suffix}`, // With space before number
            ];
            
            variations.forEach(variation => {
              if (!valueMap[variation]) {
                valueMap[variation] = cv.field_value;
              }
            });
            
            console.log(`✅ Mapped Name as per PAN C${suffix} from key "${cv.caseField.field_key}" (label: "${cv.caseField.field_label}"): ${cv.field_value}`);
          } else {
            // No C number suffix - this is likely "Name as per PAN" from Excel form
            // Map it to C1 by default (most common case)
            const variations = [
              'Name as per PAN C1', // Map to C1
              'name_as_per_pan_c1',
              'name_pan_c1',
              'Name as per PAN', // Keep original
              'name_as_per_pan',
              'name_pan'
            ];
            
            variations.forEach(variation => {
              if (!valueMap[variation]) {
                valueMap[variation] = cv.field_value;
              }
            });
            
            console.log(`✅ Mapped "Name as per PAN" (no suffix) to C1 from key "${cv.caseField.field_key}" (label: "${cv.caseField.field_label}"): ${cv.field_value}`);
          }
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
        
        // Handle H fields (H1, H2, H3, H4) for deceased/holder names
        // Name as per Certificate H3
        if ((key.includes('name as per cert') || key.includes('name as per certificate')) && key.match(/h\d+$/i)) {
          const suffix = key.match(/h(\d+)$/i)[1];
          const fieldKey = `Name as per Certificate H${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_cert_h${suffix}`]) valueMap[`name_cert_h${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Name as per Certificate H${suffix} from key "${cv.caseField.field_key}": ${cv.field_value}`);
        }
        
        // Name as per DC H3 (Death Certificate)
        if ((key.includes('name as per dc') || key.includes('name as per death') || key.includes('death certificate')) && key.match(/h\d+$/i)) {
          const suffix = key.match(/h(\d+)$/i)[1];
          const fieldKey = `Name as per DC H${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_dc_h${suffix}`]) valueMap[`name_dc_h${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Name as per DC H${suffix} from key "${cv.caseField.field_key}": ${cv.field_value}`);
        }
        
        // Claimant Relation H3
        if ((key.includes('claimant relation') || key.includes('relation')) && key.match(/h\d+$/i)) {
          const suffix = key.match(/h(\d+)$/i)[1];
          const fieldKey = `Claimant Relation H${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`claimant_relation_h${suffix}`]) valueMap[`claimant_relation_h${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Claimant Relation H${suffix} from key "${cv.caseField.field_key}": ${cv.field_value}`);
        }
        
        // DOD (Date of Death) H fields
        if ((key.includes('dod') || key.includes('date of death')) && key.match(/h\d+$/i)) {
          const suffix = key.match(/h(\d+)$/i)[1];
          const fieldKey = `DOD H${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`dod_h${suffix}`]) valueMap[`dod_h${suffix}`] = cv.field_value;
          console.log(`✅ Mapped DOD H${suffix} from key "${cv.caseField.field_key}": ${cv.field_value}`);
        }
        
        // Deceased Place H fields
        if ((key.includes('deceased place') || key.includes('deceased_place')) && key.match(/h\d+$/i)) {
          const suffix = key.match(/h(\d+)$/i)[1];
          const fieldKey = `Deceased Place H${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`deceased_place_h${suffix}`]) valueMap[`deceased_place_h${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Deceased Place H${suffix} from key "${cv.caseField.field_key}": ${cv.field_value}`);
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
        // CRITICAL FIX: Ensure PIN C1 maps to claimant PIN, not bank PIN
        if (key.includes('pin c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `PIN C${suffix}`;
          
          // CRITICAL: Only map if this is NOT a bank PIN field
          // Bank PIN should be mapped to "Bank PIN C1", not "PIN C1"
          if (!key.includes('bank') && !key.includes('Bank')) {
            if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
            if (!valueMap[`pin_c${suffix}`]) valueMap[`pin_c${suffix}`] = cv.field_value;
            console.log(`✅ Mapped claimant PIN for ${fieldKey}: ${cv.field_value}`);
          } else {
            console.log(`⚠️ Skipping bank PIN mapping for ${fieldKey}: ${cv.field_value}`);
          }
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
        // Handle Date of Issue field
        if (key === 'date of issue' || key === 'date_of_issue' || key.includes('date of issue')) {
          if (!valueMap['Date of Issue']) valueMap['Date of Issue'] = cv.field_value;
          if (!valueMap['date_of_issue']) valueMap['date_of_issue'] = cv.field_value;
        }
        
        // Handle Year of Purchase fields dynamically
        // CRITICAL FIX: Map to both formats (with and without space) to match template
        if ((key.includes('year of purchase') || key.includes('year_of_purchase')) && key.match(/\d+$/)) {
          const yopMatch = key.match(/(\d+)$/);
          if (yopMatch) {
            const yopNum = yopMatch[1];
            const fieldKey1 = `Year of Purchase${yopNum}`; // "Year of Purchase1" (no space)
            const fieldKey2 = `Year of Purchase ${yopNum}`; // "Year of Purchase 1" (with space) - template format
            
            // Map to both formats
            if (!valueMap[fieldKey1]) valueMap[fieldKey1] = cv.field_value;
            if (!valueMap[fieldKey2]) valueMap[fieldKey2] = cv.field_value;
            if (!valueMap[`year_of_purchase${yopNum}`]) valueMap[`year_of_purchase${yopNum}`] = cv.field_value;
            if (!valueMap[`year_of_purchase_${yopNum}`]) valueMap[`year_of_purchase_${yopNum}`] = cv.field_value;
            
            console.log(`✅ Mapped Year of Purchase${yopNum} from key "${cv.caseField.field_key}" (both formats): ${cv.field_value}`);
          }
        }
      }
    });

    // Add specific template placeholder mappings with helpful placeholders
    // Map the exact placeholders that appear in the Word templates
    const templateMappings = {
      'Company Name': getValueOrPlaceholder(valueMap['company_name'] || valueMap['Company Name'], 'Company Name'),
      'Folio No': getValueOrPlaceholder(valueMap['folio_no'] || valueMap['Folio No'], 'Folio No'),
      'Total Shares': getValueOrPlaceholder(valueMap['total_shares'] || valueMap['Total Shares'], 'Total Shares'),
      // Date of Issue should ONLY come from database, not current date
      'Date of Issue': getValueOrPlaceholder(valueMap['date_of_issue'] || valueMap['Date of Issue'], 'Date of Issue'),
      'Current Date': formatDate(new Date()),
      'Today Date': formatDate(new Date())
    };

    // Dynamically add mappings for all joint holders (C1, C2, C3, C4, C5, etc.)
    // Find all unique joint holder numbers from the valueMap and allNameFields
    const jointHolderNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      const match = key.match(/[cC](\d+)$/);
      if (match) {
        jointHolderNumbers.add(match[1]);
      }
    });
    // Also add from allNameFields
    Object.keys(allNameFields).forEach(key => {
      const match = key.match(/c(\d+)/);
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
      // Check multiple variations of the field name - check snake_case FIRST since that's how it's stored in DB
      let nameAsPerPanValue = valueMap[`name_as_per_pan_c${num}`] ||  // Check snake_case first (most common DB format)
                               valueMap[`name_pan_c${num}`] ||
                               valueMap[`Name as per PAN ${cnSuffix}`] ||
                               valueMap[`Name as per PAN C${num}`] ||
                               valueMap[`name as per pan c${num}`] ||
                               valueMap[`Name As Per PAN ${cnSuffix}`] ||
                               valueMap[`Name As Per Pan ${cnSuffix}`] ||
                               // Also check for "Name as per PAN" without C suffix (common in Excel forms)
                               (num === '1' ? valueMap['Name as per PAN'] || valueMap['name_as_per_pan'] || valueMap['name_pan'] : null);
      
      console.log(`🔍 Looking for Name as per PAN ${cnSuffix}, found: "${nameAsPerPanValue || 'NOT FOUND'}"`);
      if (nameAsPerPanValue) {
        console.log(`✅ Found value from key: ${Object.keys(valueMap).find(k => valueMap[k] === nameAsPerPanValue && k.toLowerCase().includes('pan') && k.toLowerCase().includes(`c${num}`)) || 'unknown'}`);
      }
      
      // AGGRESSIVE FALLBACK: If still not found, check ALL name fields for this C number
      if (!nameAsPerPanValue || nameAsPerPanValue === '_________________' || !nameAsPerPanValue.trim()) {
        console.log(`⚠️ WARNING: Name as per PAN ${cnSuffix} not found, checking all name fields for C${num}...`);
        
        // Check all stored name fields for this C number
        const availableNames = allNameFields[`c${num}`] || [];
        console.log(`🔍 Found ${availableNames.length} name fields for C${num}:`, availableNames.map(n => `${n.key} (${n.label}): ${n.value}`));
        
        // Try to find PAN name first
        const panName = availableNames.find(n => 
          (n.key.toLowerCase().includes('pan') || n.label.toLowerCase().includes('pan')) &&
          n.value && n.value.trim() !== ''
        );
        
        if (panName) {
          nameAsPerPanValue = panName.value;
          console.log(`✅ Found PAN name from field "${panName.key}" (label: "${panName.label}"): ${panName.value}`);
        } else {
          // Fallback to any name field (Aadhar, CML, Bank, etc.) - prioritize Aadhar
          const aadharName = availableNames.find(n => 
            (n.key.toLowerCase().includes('aadhar') || n.label.toLowerCase().includes('aadhar')) &&
            n.value && n.value.trim() !== ''
          );
          
          if (aadharName) {
            nameAsPerPanValue = aadharName.value;
            console.log(`✅ Using Aadhar name as fallback from field "${aadharName.key}" (label: "${aadharName.label}"): ${aadharName.value}`);
          } else {
            // Use ANY name field that has a value
            const anyName = availableNames.find(n => n.value && n.value.trim() !== '' && n.value !== 'undefined' && n.value !== 'null');
            if (anyName) {
              nameAsPerPanValue = anyName.value;
              console.log(`✅ Using ANY available name as fallback from field "${anyName.key}" (label: "${anyName.label}"): ${anyName.value}`);
            } else {
              // Last resort: try valueMap with any name variation - check ALL possible keys
              console.log(`🔍 Last resort: Checking valueMap for any C${num} name fields...`);
              const allPossibleKeys = [
                `name_c${num}`, `Name as per Aadhar ${cnSuffix}`, `Name as per CML ${cnSuffix}`, 
                `Name as per Bank ${cnSuffix}`, `Name as per Passport ${cnSuffix}`,
                `name_aadhar_c${num}`, `name_cml_c${num}`, `name_bank_c${num}`
              ];
              
              for (const possibleKey of allPossibleKeys) {
                if (valueMap[possibleKey] && valueMap[possibleKey].trim() !== '') {
                  nameAsPerPanValue = valueMap[possibleKey];
                  console.log(`✅ Found name in valueMap with key "${possibleKey}": ${nameAsPerPanValue}`);
                  break;
                }
              }
            }
          }
        }
      }
      
      // Final check - if still empty, log all available fields for debugging
      if (!nameAsPerPanValue || nameAsPerPanValue === '_________________' || !nameAsPerPanValue.trim()) {
        console.log(`❌ ERROR: Name as per PAN ${cnSuffix} is STILL empty after all fallbacks!`);
        console.log(`📋 All available fields for C${num}:`, Object.keys(valueMap).filter(k => k.toLowerCase().includes('name') && (k.includes(`c${num}`) || k.includes(cnSuffix))));
        console.log(`📋 All stored name fields:`, allNameFields[`c${num}`]);
      }
      
      // Use the actual value if found, otherwise use placeholder
      // Only use getValueOrPlaceholder if the value is truly empty/undefined
      let finalPanValue;
      if (nameAsPerPanValue && 
          nameAsPerPanValue.trim() !== '' && 
          nameAsPerPanValue !== 'undefined' && 
          nameAsPerPanValue !== 'null' &&
          nameAsPerPanValue !== '_________________') {
        // We have a valid value - use it directly (clean it but don't replace with placeholder)
        finalPanValue = nameAsPerPanValue.toString().replace(/undefined|UNDEFINED|null|NULL/gi, '').trim();
        console.log(`✅ Using actual value for Name as per PAN ${cnSuffix}: "${finalPanValue}"`);
      } else {
        // No value found - use placeholder
        finalPanValue = getValueOrPlaceholder(nameAsPerPanValue, `Name as per PAN ${cnSuffix}`);
        console.log(`⚠️ No value found for Name as per PAN ${cnSuffix}, using placeholder: "${finalPanValue}"`);
      }
      
      console.log(`🔍 Final mapping for Name as per PAN ${cnSuffix}: "${nameAsPerPanValue || 'NOT FOUND'}" -> "${finalPanValue}"`);
      
      // CRITICAL: Set the exact key FIRST to ensure it's not overwritten
      // Create mappings with multiple format variations to ensure matching
      // This ensures the placeholder in the template will match regardless of exact format
      templateMappings[`Name as per PAN ${cnSuffix}`] = finalPanValue; // Standard format: "Name as per PAN C1" - EXACT MATCH
      templateMappings[`Name as per PAN C${num}`] = finalPanValue; // Without space: "Name as per PAN C1" (same but explicit)
      templateMappings[`Name As Per PAN ${cnSuffix}`] = finalPanValue; // Title case: "Name As Per PAN C1"
      templateMappings[`name as per pan ${cnSuffix.toLowerCase()}`] = finalPanValue; // Lowercase: "name as per pan c1"
      templateMappings[`Name as per PAN C ${num}`] = finalPanValue; // With space: "Name as per PAN C 1"
      
      // ALSO ensure it's in valueMap directly (before merging templateMappings)
      // This ensures the value is available for preview and matching
      valueMap[`Name as per PAN ${cnSuffix}`] = finalPanValue;
      console.log(`✅ Set valueMap["Name as per PAN ${cnSuffix}"] = "${finalPanValue}"`);
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
      // CRITICAL FIX: Ensure PIN C1 maps to claimant PIN, not bank PIN
      // First, try to find the correct claimant PIN
      const claimantPin = valueMap[`pin_c${num}`] || 
                         valueMap[`PIN ${cnSuffix}`] ||
                         valueMap[`claimant_pin_c${num}`] ||
                         valueMap[`residential_pin_c${num}`];
      
      // Ensure we're not using bank PIN for claimant PIN field
      const bankPin = valueMap[`Bank PIN ${cnSuffix}`] || 
                     valueMap[`bank_pin_c${num}`];
      
      let finalPin = claimantPin;
      
      // If claimant PIN is missing but bank PIN exists, log warning
      if (!claimantPin && bankPin) {
        console.log(`⚠️ WARNING: No claimant PIN found for ${cnSuffix}, but bank PIN exists: ${bankPin}`);
        console.log(`⚠️ This may cause the bank PIN to appear in the claimant PIN field!`);
        // Don't use bank PIN for claimant PIN field
        finalPin = '';
      }
      
      // CRITICAL: For PIN fields, only use the exact value for this C number
      // Don't allow fallback to other C numbers (e.g., don't use PIN C1 for PIN C2 or PIN C3)
      // If finalPin is empty or doesn't exist, return empty string (not placeholder)
      if (!finalPin || finalPin.trim() === '' || finalPin === 'undefined' || finalPin === 'null') {
        templateMappings[`PIN ${cnSuffix}`] = ''; // Empty string, not placeholder
        console.log(`⚠️ PIN ${cnSuffix} is empty - using empty string (not falling back to other C numbers)`);
      } else {
        templateMappings[`PIN ${cnSuffix}`] = getValueOrPlaceholder(
          finalPin, 
          `PIN ${cnSuffix}`
        );
      }
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

    // Dynamically add mappings for H fields (H1, H2, H3, H4) - deceased/holder names
    // Find all unique H numbers from the valueMap and allHFields
    const holderNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      const match = key.match(/[hH](\d+)$/);
      if (match) {
        holderNumbers.add(match[1]);
      }
    });
    // Also add from allHFields
    Object.keys(allHFields).forEach(key => {
      const match = key.match(/h(\d+)/);
      if (match) {
        holderNumbers.add(match[1]);
      }
    });

    // Add mappings for each holder (H1, H2, H3, H4, etc.)
    holderNumbers.forEach(num => {
      const hnSuffix = `H${num}`;
      
      // Name as per Certificate H3 - with aggressive fallback
      let certName = valueMap[`Name as per Certificate ${hnSuffix}`] || 
                     valueMap[`name_cert_h${num}`] ||
                     valueMap[`name as per cert h${num}`] ||
                     valueMap[`name as per certificate h${num}`];
      
      // AGGRESSIVE FALLBACK: If not found, check all H fields
      if (!certName || certName === '_________________') {
        const availableHNames = allHFields[`h${num}`] || [];
        console.log(`🔍 Found ${availableHNames.length} name fields for H${num}:`, availableHNames.map(n => `${n.key}: ${n.value}`));
        
        // Try to find certificate name
        const certNameField = availableHNames.find(n => 
          (n.key.toLowerCase().includes('cert') || n.key.toLowerCase().includes('certificate')) &&
          !n.key.toLowerCase().includes('dc') && !n.key.toLowerCase().includes('death')
        );
        
        if (certNameField) {
          certName = certNameField.value;
          console.log(`✅ Found Certificate name from field "${certNameField.key}": ${certNameField.value}`);
        } else {
          // Fallback to any name field
          const anyName = availableHNames.find(n => n.value && n.value.trim() !== '');
          if (anyName) {
            certName = anyName.value;
            console.log(`✅ Using fallback name for Certificate H${num} from field "${anyName.key}": ${anyName.value}`);
          }
        }
      }
      
      templateMappings[`Name as per Certificate ${hnSuffix}`] = getValueOrPlaceholder(
        certName,
        `Name as per Certificate ${hnSuffix}`
      );
      
      // Name as per DC H3 (Death Certificate) - with aggressive fallback
      let dcName = valueMap[`Name as per DC ${hnSuffix}`] || 
                   valueMap[`name_dc_h${num}`] ||
                   valueMap[`name as per dc h${num}`] ||
                   valueMap[`name as per death certificate h${num}`] ||
                   valueMap[`death_certificate_h${num}`];
      
      // AGGRESSIVE FALLBACK: If not found, check all H fields
      if (!dcName || dcName === '_________________') {
        const availableHNames = allHFields[`h${num}`] || [];
        
        // Try to find DC/death certificate name
        const dcNameField = availableHNames.find(n => 
          n.key.toLowerCase().includes('dc') || 
          n.key.toLowerCase().includes('death') ||
          n.label.toLowerCase().includes('dc') ||
          n.label.toLowerCase().includes('death')
        );
        
        if (dcNameField) {
          dcName = dcNameField.value;
          console.log(`✅ Found DC name from field "${dcNameField.key}": ${dcNameField.value}`);
        } else {
          // Fallback to any name field
          const anyName = availableHNames.find(n => n.value && n.value.trim() !== '');
          if (anyName) {
            dcName = anyName.value;
            console.log(`✅ Using fallback name for DC H${num} from field "${anyName.key}": ${anyName.value}`);
          }
        }
      }
      
      templateMappings[`Name as per DC ${hnSuffix}`] = getValueOrPlaceholder(
        dcName,
        `Name as per DC ${hnSuffix}`
      );
      
      // Claimant Relation H3
      templateMappings[`Claimant Relation ${hnSuffix}`] = getValueOrPlaceholder(
        valueMap[`Claimant Relation ${hnSuffix}`] || 
        valueMap[`claimant_relation_h${num}`] ||
        valueMap[`relation_h${num}`],
        `Claimant Relation ${hnSuffix}`
      );
      
      // DOD (Date of Death) H fields - format as DD/MM/YYYY
      const dodValue = valueMap[`DOD ${hnSuffix}`] || 
                       valueMap[`dod_h${num}`] ||
                       valueMap[`dod h${num}`] ||
                       valueMap[`date_of_death_h${num}`];
      templateMappings[`DOD ${hnSuffix}`] = getValueOrPlaceholder(
        dodValue,
        `DOD ${hnSuffix}`
      );
      
      // Date of demise** - for ISR-5 templates (maps to DOD fields)
      // Map to both "Date of demise**" and "Date of demise" (with/without asterisks)
      // Also map with H suffix for specific rows: "Date of demise** H1", "Date of demise** H2", etc.
      templateMappings[`Date of demise** ${hnSuffix}`] = getValueOrPlaceholder(
        dodValue || valueMap[`DOD ${hnSuffix}`],
        `Date of demise** ${hnSuffix}`
      );
      templateMappings[`Date of demise ${hnSuffix}`] = getValueOrPlaceholder(
        dodValue || valueMap[`DOD ${hnSuffix}`],
        `Date of demise ${hnSuffix}`
      );
      
      // Deceased Place H fields
      const deceasedPlaceValue = valueMap[`Deceased Place ${hnSuffix}`] || 
                                  valueMap[`deceased_place_h${num}`] ||
                                  valueMap[`deceased place h${num}`];
      templateMappings[`Deceased Place ${hnSuffix}`] = getValueOrPlaceholder(
        deceasedPlaceValue,
        `Deceased Place ${hnSuffix}`
      );
    });
    
    // Global "Date of demise**" mapping for ISR-5 templates (uses first available DOD value)
    // This handles cases where the template has a single "Date of demise**" placeholder
    const firstDODValue = valueMap['DOD H1'] || valueMap['DOD H2'] || valueMap['DOD H3'] || valueMap['DOD H4'] ||
                          valueMap['dod_h1'] || valueMap['dod_h2'] || valueMap['dod_h3'] || valueMap['dod_h4'];
    templateMappings['Date of demise**'] = getValueOrPlaceholder(
      firstDODValue,
      'Date of demise**'
    );
    templateMappings['Date of demise'] = getValueOrPlaceholder(
      firstDODValue,
      'Date of demise'
    );

    // Dynamically add mappings for Share Certificate fields (SC1-SC10)
    // Find all unique SC numbers from the valueMap
    const scNumbers = new Set();
    Object.keys(valueMap).forEach(key => {
      // Match SC, DN, NOS, SC Status, and Year of Purchase fields
      // CRITICAL FIX: Handle both "Year of Purchase1" (no space) and "Year of Purchase 1" (with space)
      const scMatch = key.match(/^SC(\d+)$/i) || 
                      key.match(/^DN(\d+)$/i) || 
                      key.match(/^NOS(\d+)$/i) || 
                      key.match(/SC\s*Status(\d+)/i) ||
                      key.match(/Year\s*of\s*Purchase\s*(\d+)/i); // Matches both "Purchase1" and "Purchase 1"
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
      
      // SC field - apply cleanup to remove commas and "&"
      const scValue = valueMap[`SC${scSuffix}`] || valueMap[`sc${scSuffix}`];
      let cleanedSC = getSCValueOrEmpty(scValue);
      // Clean up any trailing commas, "&", etc. from SC values
      if (cleanedSC && typeof cleanedSC === 'string') {
        cleanedSC = cleanedSC.replace(/[,.\s]*&[\s,]*$/g, '').replace(/[,.\s]+$/g, '').trim();
        if (cleanedSC === '' || cleanedSC === '&' || cleanedSC.match(/^[,.\s&]+$/)) {
          cleanedSC = '';
        }
      }
      templateMappings[`SC${scSuffix}`] = cleanedSC;
      
      // DN (Distinctive Number) field - apply cleanup to remove commas and "&"
      const dnValue = valueMap[`DN${scSuffix}`] || valueMap[`dn${scSuffix}`];
      let cleanedDN = getSCValueOrEmpty(dnValue);
      // Clean up any trailing commas, "&", etc. from DN values
      if (cleanedDN && typeof cleanedDN === 'string') {
        cleanedDN = cleanedDN.replace(/[,.\s]*&[\s,]*$/g, '').replace(/[,.\s]+$/g, '').trim();
        if (cleanedDN === '' || cleanedDN === '&' || cleanedDN.match(/^[,.\s&]+$/)) {
          cleanedDN = '';
        }
      }
      templateMappings[`DN${scSuffix}`] = cleanedDN;
      
      // NOS (Number of Securities) field
      const nosValue = valueMap[`NOS${scSuffix}`] || valueMap[`nos${scSuffix}`];
      templateMappings[`NOS${scSuffix}`] = getSCValueOrEmpty(nosValue);
      
      // SC Status field
      const statusValue = valueMap[`SC Status${scSuffix}`] || valueMap[`sc_status${scSuffix}`];
      templateMappings[`SC Status${scSuffix}`] = getSCValueOrEmpty(statusValue);
      
      // Year of Purchase - only for SC1
      // CRITICAL FIX: Template uses "Year of Purchase 1" (with space), but database stores "Year of Purchase1" (without space)
      // Map to both formats to ensure matching
      if (i === 1) {
        const yopValue = valueMap[`Year of Purchase${scSuffix}`] || 
                        valueMap[`Year of Purchase ${scSuffix}`] || 
                        valueMap[`year_of_purchase${scSuffix}`] ||
                        valueMap[`year_of_purchase_${scSuffix}`];
        const finalYopValue = getSCValueOrEmpty(yopValue);
        
        // Map to both formats: with space and without space
        templateMappings[`Year of Purchase${scSuffix}`] = finalYopValue; // "Year of Purchase1" (no space)
        templateMappings[`Year of Purchase ${scSuffix}`] = finalYopValue; // "Year of Purchase 1" (with space) - template format
        console.log(`✅ Mapped Year of Purchase for SC1: "${finalYopValue}" (both formats)`);
      }
    }

    // Build combined certificate numbers and distinctive numbers for ISR-4 template
    // These are comma-separated lists built from SC1-SC10 and DN1-DN10
    const certificateNumbers = [];
    const distinctiveNumbers = [];
    
    for (let i = 1; i <= 10; i++) {
      const scValue = templateMappings[`SC${i}`];
      const dnValue = templateMappings[`DN${i}`];
      
      // Only add non-empty SC values to certificate numbers list
      if (scValue && scValue.trim() !== '' && scValue !== '&' && !scValue.match(/^[,.\s&]+$/)) {
        certificateNumbers.push(scValue.trim());
      }
      
      // Only add non-empty DN values to distinctive numbers list
      if (dnValue && dnValue.trim() !== '' && dnValue !== '&' && !dnValue.match(/^[,.\s&]+$/)) {
        distinctiveNumbers.push(dnValue.trim());
      }
    }
    
    // Create cleaned comma-separated strings (no trailing commas or "&")
    const certificateNumbersStr = certificateNumbers.length > 0 
      ? certificateNumbers.join(', ') 
      : '';
    const distinctiveNumbersStr = distinctiveNumbers.length > 0 
      ? distinctiveNumbers.join(', ') 
      : '';
    
    // Map to common placeholder names used in ISR-4 template
    templateMappings['Certificate numbers'] = certificateNumbersStr;
    templateMappings['certificate numbers'] = certificateNumbersStr;
    templateMappings['Certificate Numbers'] = certificateNumbersStr;
    templateMappings['Distinctive numbers'] = distinctiveNumbersStr;
    templateMappings['distinctive numbers'] = distinctiveNumbersStr;
    templateMappings['Distinctive Numbers'] = distinctiveNumbersStr;

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
        valueMap[placeholder] = getPlaceholderText(placeholder); // Returns empty string now
        console.log(`📝 Initialized placeholder [${placeholder}] with empty string`);
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

    // Check for and fix PIN mapping issues
    Object.keys(valueMap).forEach(key => {
      if (key.includes('PIN C') && !key.includes('Bank PIN')) {
        const value = valueMap[key];
        
        // Check if the PIN matches Bank PIN (common issue where bank PIN gets mapped to claimant PIN)
        const bankPinKey = key.replace('PIN C', 'Bank PIN C');
        const bankPinValue = valueMap[bankPinKey];
        
        if (bankPinValue && value === bankPinValue) {
          console.log(`🚨 CRITICAL: Found bank PIN in claimant PIN field [${key}]: ${value}`);
          console.log(`🚨 Bank PIN value matches claimant PIN - this is the mapping issue!`);
          
          // Try to find the correct claimant PIN
          const correctClaimantPin = companyValues.find(cv => 
            cv.caseField && 
            (cv.caseField.field_key.toLowerCase().includes('pin c') || 
             cv.caseField.field_key === `PIN ${key.match(/C\d+/)[0]}`) &&
            cv.field_value && 
            cv.field_value !== bankPinValue && // Ensure it's different from bank PIN
            !cv.caseField.field_key.toLowerCase().includes('bank')
          );
          
          if (correctClaimantPin) {
            console.log(`✅ Found correct claimant PIN for ${key}: ${correctClaimantPin.field_value}`);
            valueMap[key] = correctClaimantPin.field_value;
          } else {
            console.log(`❌ No correct claimant PIN found for ${key}, setting to empty`);
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
    
    // Helper function to clean XML tags from placeholder text
    const cleanPlaceholderText = (text) => {
      if (!text) return '';
      
      // Remove XML tags and extract text content
      // Handle cases like: "</w:t></w:r><w:r><w:rPr>...<w:t>Name as per PAN C1</w:t>..."
      let cleaned = text.toString();
      
      // Remove XML tags (both opening and closing)
      cleaned = cleaned.replace(/<[^>]+>/g, '');
      
      // Remove XML entities
      cleaned = cleaned.replace(/&[a-z]+;/gi, '');
      
      // Clean up whitespace
      cleaned = cleaned.trim().replace(/\s+/g, ' ');
      
      return cleaned;
    };
    
    // Helper function to normalize placeholder names for matching
    const normalizePlaceholderName = (name) => {
      // First clean XML tags if present
      const cleaned = cleanPlaceholderText(name);
      return cleaned.toLowerCase();
    };
    
    // Helper function to find value for a placeholder using fuzzy matching
    const findPlaceholderValue = (placeholderName, valueMap) => {
      const normalized = normalizePlaceholderName(placeholderName);
      
      // CRITICAL: For PIN fields, extract the C number to prevent cross-contamination
      // Don't allow PIN C1 to be used for PIN C2 or PIN C3
      const pinMatch = normalized.match(/pin\s*c(\d+)/i);
      const requiredCNumber = pinMatch ? pinMatch[1] : null;
      
      // First, try exact match (case-insensitive)
      for (const [key, value] of Object.entries(valueMap)) {
        if (normalizePlaceholderName(key) === normalized) {
          // For PIN fields, verify the C number matches
          if (requiredCNumber) {
            const keyPinMatch = normalizePlaceholderName(key).match(/pin\s*c(\d+)/i);
            if (keyPinMatch && keyPinMatch[1] === requiredCNumber) {
              return value;
            }
          } else {
            return value;
          }
        }
      }
      
      // Second, try partial match (contains the normalized name)
      // BUT: For PIN fields, ensure C number matches exactly
      for (const [key, value] of Object.entries(valueMap)) {
        const normalizedKey = normalizePlaceholderName(key);
        if (normalizedKey.includes(normalized) || normalized.includes(normalizedKey)) {
          // For PIN fields, verify the C number matches exactly
          if (requiredCNumber) {
            const keyPinMatch = normalizedKey.match(/pin\s*c(\d+)/i);
            if (keyPinMatch && keyPinMatch[1] === requiredCNumber) {
              return value;
            }
            // Don't return if C numbers don't match
            continue;
          }
          return value;
        }
      }
      
      return null;
    };
    
    // Use utility function for comprehensive cleanup
    const cleanValueMap = cleanUndefinedValues(mappedTemplate.valueMap);
    
    // CRITICAL: Final aggressive cleanup to prevent ANY undefined values
    const finalCleanMap = {};
    Object.keys(cleanValueMap).forEach(key => {
      const value = cleanValueMap[key];
      // Don't filter out placeholder text - keep it as is, but log it
      if (value === undefined || value === null || value === 'undefined' || value === 'null') {
        finalCleanMap[key] = ''; // Force empty string for undefined/null
        console.log(`🚨 FINAL CLEANUP: Forced ${key} to empty string (was: ${value})`);
      } else if (value === '_________________') {
        // CRITICAL FIX: Don't use dashes for important fields - try to find the actual value first
        // For "Name as per PAN" fields, try to find the value using fuzzy matching
        if (key.toLowerCase().includes('name as per pan')) {
          console.log(`⚠️ Found dashes for "${key}", attempting to find actual value...`);
          
          // Try to find the value in the original mappedTemplate.valueMap
          const normalizedKey = normalizePlaceholderName(key);
          let foundValue = findPlaceholderValue(key, mappedTemplate.valueMap);
          
          if (!foundValue) {
            // Try fuzzy matching with variations
            for (const [mapKey, mapValue] of Object.entries(mappedTemplate.valueMap)) {
              const normalizedMapKey = normalizePlaceholderName(mapKey);
              if (normalizedMapKey === normalizedKey && 
                  mapValue && 
                  mapValue.trim() !== '' && 
                  mapValue !== 'undefined' && 
                  mapValue !== 'null' &&
                  mapValue !== '_________________') {
                foundValue = mapValue;
                console.log(`✅ Found actual value for "${key}" from key "${mapKey}": "${foundValue}"`);
                break;
              }
            }
          }
          
          if (foundValue && foundValue.trim() !== '' && foundValue !== 'undefined' && foundValue !== 'null') {
            finalCleanMap[key] = foundValue;
            console.log(`✅ Replaced dashes with actual value for "${key}": "${foundValue}"`);
          } else {
            // If still not found, use empty string instead of dashes
            finalCleanMap[key] = '';
            console.log(`⚠️ Could not find value for "${key}", using empty string instead of dashes`);
          }
        } else {
          // For other fields, return empty string instead of placeholder text
          finalCleanMap[key] = '';
          console.log(`⚠️ Removed placeholder text for "${key}", using empty string`);
        }
      } else if (!value || (typeof value === 'string' && value.trim() === '')) {
        finalCleanMap[key] = ''; // Force empty string for empty values
        console.log(`🚨 FINAL CLEANUP: Forced ${key} to empty string (was empty)`);
      } else {
        finalCleanMap[key] = String(value); // Keep actual values as-is
        // Only log important mappings to reduce noise
        if (key.toLowerCase().includes('name as per pan')) {
          console.log(`✅ KEEPING VALUE: ${key} = ${value}`);
        }
      }
    });

    console.log(`🔧 Final template data prepared with ${Object.keys(finalCleanMap).length} fields`);
    console.log(`🔧 Sample final data:`, Object.entries(finalCleanMap).slice(0, 3));
    
    // Extract and log all placeholders from the template for debugging
    const foundPlaceholders = [];
    try {
      const templateText = doc.getFullText();
      const placeholderRegex = /\[([^\]]+)\]/g;
      let match;
      while ((match = placeholderRegex.exec(templateText)) !== null) {
        // CRITICAL FIX: Clean XML tags from placeholder text
        // Some Word templates have formatting that includes XML tags in the placeholder
        const rawPlaceholder = match[1].trim();
        const cleanedPlaceholder = cleanPlaceholderText(rawPlaceholder);
        foundPlaceholders.push(cleanedPlaceholder);
        
        // Log if XML tags were found and removed
        if (rawPlaceholder !== cleanedPlaceholder && rawPlaceholder.includes('<')) {
          console.log(`🔧 Cleaned placeholder: "${rawPlaceholder.substring(0, 50)}..." -> "${cleanedPlaceholder}"`);
        }
      }
      console.log(`📋 Found ${foundPlaceholders.length} placeholders in template: ${template.template_path}`);
      console.log(`📝 Placeholders:`, [...new Set(foundPlaceholders)].join(', '));
      
      // DEBUG: Check if "Name as per PAN C1" placeholder exists
      const panC1Placeholder = foundPlaceholders.find(p => normalizePlaceholderName(p).includes('name as per pan') && normalizePlaceholderName(p).includes('c1'));
      if (panC1Placeholder) {
        console.log(`🔍 DEBUG: Found "Name as per PAN C1" placeholder: "${panC1Placeholder}"`);
        console.log(`🔍 DEBUG: Checking valueMap for this placeholder...`);
        console.log(`🔍 DEBUG: ValueMap keys containing "pan" and "c1":`, Object.keys(mappedTemplate.valueMap).filter(k => 
          normalizePlaceholderName(k).includes('pan') && normalizePlaceholderName(k).includes('c1')
        ));
      }
      
      // Check for unclosed brackets
      const openBrackets = (templateText.match(/\[/g) || []).length;
      const closeBrackets = (templateText.match(/\]/g) || []).length;
      if (openBrackets !== closeBrackets) {
        console.error(`⚠️ WARNING: Mismatched brackets in template! Open: ${openBrackets}, Close: ${closeBrackets}`);
      }
      
      // CRITICAL FIX: Ensure all extracted placeholders have values in finalCleanMap
      // This handles cases where placeholder names might have slight variations
      const uniquePlaceholders = [...new Set(foundPlaceholders)];
      let fixedCount = 0;
      uniquePlaceholders.forEach(placeholder => {
        // CRITICAL: Placeholder is already cleaned during extraction, but ensure it's properly trimmed
        // The placeholder might have been cleaned from XML tags, so use it as-is
        const normalizedPlaceholder = placeholder.trim();
        
        // Also try to find the original key in valueMap that matches this cleaned placeholder
        // This handles cases where the template has XML tags but our valueMap has clean keys
        let matchingKey = null;
        const normalizedPlaceholderLower = normalizePlaceholderName(normalizedPlaceholder);
        
        // First, try to find exact match in finalCleanMap
        const hasExactMatch = finalCleanMap.hasOwnProperty(normalizedPlaceholder);
        
        // Second, try to find normalized match
        const hasNormalizedMatch = Object.keys(finalCleanMap).some(key => {
          const normalizedKey = normalizePlaceholderName(key);
          if (normalizedKey === normalizedPlaceholderLower) {
            matchingKey = key;
            return true;
          }
          return false;
        });
        
        if (!hasExactMatch && !hasNormalizedMatch) {
          // Try to find the value using fuzzy matching - check BOTH cleanValueMap and original valueMap
          let foundValue = findPlaceholderValue(normalizedPlaceholder, cleanValueMap);
          
          // If not found in cleanValueMap, check the original valueMap (before cleaning)
          if (!foundValue) {
            foundValue = findPlaceholderValue(normalizedPlaceholder, mappedTemplate.valueMap);
          }
          
          // If we found a matching key but no value yet, try to get value from that key
          // CRITICAL: For PIN fields, verify C number matches before using the value
          if (!foundValue && matchingKey) {
            const potentialValue = finalCleanMap[matchingKey] || cleanValueMap[matchingKey] || mappedTemplate.valueMap[matchingKey];
            
            // For PIN fields, check if the C number matches
            const pinMatch = normalizedPlaceholder.match(/pin\s*c(\d+)/i);
            if (pinMatch) {
              const requiredCNumber = pinMatch[1];
              const keyPinMatch = normalizePlaceholderName(matchingKey).match(/pin\s*c(\d+)/i);
              
              // Only use the value if C numbers match exactly
              if (keyPinMatch && keyPinMatch[1] === requiredCNumber) {
                foundValue = potentialValue;
              } else {
                // C numbers don't match - don't use this value (prevents PIN C1 from being used for C2/C3)
                foundValue = null;
                console.log(`⚠️ PIN field mismatch: Placeholder requires C${requiredCNumber}, but found C${keyPinMatch ? keyPinMatch[1] : 'unknown'} - not using this value`);
              }
            } else {
              foundValue = potentialValue;
            }
          }
          
          // CRITICAL: Don't use dashes - if value is dashes, try to find the actual value
          // CRITICAL: For PIN fields, ensure we only use values with matching C numbers
          if (foundValue && foundValue.trim() !== '' && foundValue !== 'undefined' && foundValue !== 'null' && foundValue !== '_________________') {
            // For PIN fields, double-check C number matches
            const pinMatch = normalizedPlaceholder.match(/pin\s*c(\d+)/i);
            if (pinMatch) {
              const requiredCNumber = pinMatch[1];
              // Verify the found value is actually for the correct C number
              // This prevents PIN C1 from being used for PIN C2 or PIN C3
              const valueKey = Object.keys(mappedTemplate.valueMap).find(k => 
                mappedTemplate.valueMap[k] === foundValue && 
                normalizePlaceholderName(k).match(/pin\s*c(\d+)/i) &&
                normalizePlaceholderName(k).match(/pin\s*c(\d+)/i)[1] === requiredCNumber
              );
              
              if (!valueKey) {
                // The found value doesn't match the required C number - don't use it
                console.log(`⚠️ PIN C${requiredCNumber} not found - using empty string instead of wrong value`);
                foundValue = null;
              }
            }
            
            if (foundValue) {
              // Use the cleaned placeholder as the key (this is what docxtemplater will look for)
              finalCleanMap[normalizedPlaceholder] = foundValue;
              console.log(`✅ Fixed missing mapping for placeholder "${normalizedPlaceholder}" = "${foundValue}"`);
              fixedCount++;
            } else {
              // No valid value found - use empty string
              finalCleanMap[normalizedPlaceholder] = '';
              console.log(`⚠️ No valid value found for "${normalizedPlaceholder}" - using empty string`);
            }
          } else if (foundValue === '_________________') {
            // Value was found but it's dashes - use empty string instead
            finalCleanMap[normalizedPlaceholder] = '';
            console.log(`⚠️ Found dashes for "${normalizedPlaceholder}", using empty string`);
            fixedCount++;
          } else {
            // Special handling for PIN fields - ensure C numbers match exactly
            let pinHandled = false;
            if (normalizedPlaceholder.toLowerCase().includes('pin')) {
              const pinMatch = normalizedPlaceholder.match(/pin\s*c(\d+)/i);
              if (pinMatch) {
                const requiredCNumber = pinMatch[1];
                const cnSuffix = `C${requiredCNumber}`;
                
                // Try to find the exact PIN field for this C number
                const exactPinKey = `PIN ${cnSuffix}`;
                const exactPinValue = mappedTemplate.valueMap[exactPinKey] || 
                                     cleanValueMap[exactPinKey] ||
                                     mappedTemplate.valueMap[`pin_c${requiredCNumber}`] ||
                                     cleanValueMap[`pin_c${requiredCNumber}`];
                
                // Only use if it's a valid value and matches the C number
                if (exactPinValue && 
                    exactPinValue.trim() !== '' && 
                    exactPinValue !== 'undefined' && 
                    exactPinValue !== 'null' &&
                    exactPinValue !== '_________________') {
                  finalCleanMap[normalizedPlaceholder] = exactPinValue;
                  console.log(`✅ Found exact PIN ${cnSuffix} for placeholder "${normalizedPlaceholder}" = "${exactPinValue}"`);
                  fixedCount++;
                  pinHandled = true;
                } else {
                  // No valid PIN found for this C number - use empty string (don't fallback to C1)
                  finalCleanMap[normalizedPlaceholder] = '';
                  console.log(`⚠️ PIN ${cnSuffix} not found - using empty string (not falling back to other C numbers)`);
                  pinHandled = true;
                }
              }
            }
            
            // Skip other special handling if PIN was already handled
            if (!pinHandled) {
              // Special handling for "Name as per PAN C1" and similar fields
              if (normalizedPlaceholder.toLowerCase().includes('name as per pan')) {
                // Extract the C number
                const cMatch = normalizedPlaceholder.match(/c\s*(\d+)/i);
                if (cMatch) {
                  const cNum = cMatch[1];
                  const cnSuffix = `C${cNum}`;
                  
                  // Try to find using the standard mapping key - check BOTH maps
                  const standardKey = `Name as per PAN ${cnSuffix}`;
                  let standardValue = mappedTemplate.valueMap[standardKey] || 
                                     cleanValueMap[standardKey] ||
                                     mappedTemplate.valueMap[`name_as_per_pan_c${cNum}`] ||
                                     cleanValueMap[`name_as_per_pan_c${cNum}`] ||
                                     mappedTemplate.valueMap[`name_pan_c${cNum}`] ||
                                     cleanValueMap[`name_pan_c${cNum}`] ||
                                     mappedTemplate.valueMap[`Name As Per PAN ${cnSuffix}`] ||
                                     cleanValueMap[`Name As Per PAN ${cnSuffix}`];
                  
                  // Try all variations with case-insensitive matching
                  if (!standardValue) {
                    for (const [key, value] of Object.entries(mappedTemplate.valueMap)) {
                      const normalizedKey = normalizePlaceholderName(key);
                      if (normalizedKey.includes('name') && normalizedKey.includes('pan') && 
                          (normalizedKey.includes(`c${cNum}`) || normalizedKey.includes(`c ${cNum}`))) {
                        if (value && value.trim() !== '' && value !== 'undefined' && value !== 'null') {
                          standardValue = value;
                          console.log(`🔍 Found "Name as per PAN ${cnSuffix}" using fuzzy match on key "${key}" = "${value}"`);
                          break;
                        }
                      }
                    }
                  }
                  
                  // CRITICAL: Don't use dashes - ensure we have a real value
                  if (standardValue && 
                      standardValue.trim() !== '' && 
                      standardValue !== 'undefined' && 
                      standardValue !== 'null' &&
                      standardValue !== '_________________') {
                    finalCleanMap[normalizedPlaceholder] = standardValue;
                    console.log(`✅ Fixed "Name as per PAN ${cnSuffix}" mapping for placeholder "${normalizedPlaceholder}" = "${standardValue}"`);
                    fixedCount++;
                  } else {
                    console.log(`⚠️ WARNING: Could not find value for placeholder "${normalizedPlaceholder}"`);
                    console.log(`🔍 Available keys in valueMap:`, Object.keys(mappedTemplate.valueMap).filter(k => 
                      normalizePlaceholderName(k).includes('name') && normalizePlaceholderName(k).includes('pan')
                    ));
                    // Use empty string instead of dashes to prevent showing dashes in template
                    finalCleanMap[normalizedPlaceholder] = ''; // Set to empty string to prevent undefined
                  }
                }
              } else if (normalizedPlaceholder.toLowerCase().includes('year') && normalizedPlaceholder.toLowerCase().includes('purchase')) {
                // Special handling for "Year of Purchase" fields
                // Extract the number (could be "Year of Purchase 1" or "Year of Purchase1")
                const yopMatch = normalizedPlaceholder.match(/purchase\s*(\d+)/i);
                if (yopMatch) {
                  const yopNum = yopMatch[1];
                  
                  // Try to find using both formats (with and without space)
                  const standardKey1 = `Year of Purchase${yopNum}`; // "Year of Purchase1"
                  const standardKey2 = `Year of Purchase ${yopNum}`; // "Year of Purchase 1"
                  
                  let standardValue = mappedTemplate.valueMap[standardKey1] || 
                                     cleanValueMap[standardKey1] ||
                                     mappedTemplate.valueMap[standardKey2] || 
                                     cleanValueMap[standardKey2] ||
                                     mappedTemplate.valueMap[`year_of_purchase${yopNum}`] ||
                                     cleanValueMap[`year_of_purchase${yopNum}`] ||
                                     mappedTemplate.valueMap[`year_of_purchase_${yopNum}`] ||
                                     cleanValueMap[`year_of_purchase_${yopNum}`];
                  
                  // Try fuzzy matching
                  if (!standardValue) {
                    for (const [key, value] of Object.entries(mappedTemplate.valueMap)) {
                      const normalizedKey = normalizePlaceholderName(key);
                      if (normalizedKey.includes('year') && normalizedKey.includes('purchase') && 
                          (normalizedKey.includes(yopNum) || normalizedKey.includes(` ${yopNum}`))) {
                        if (value && value.trim() !== '' && value !== 'undefined' && value !== 'null') {
                          standardValue = value;
                          console.log(`🔍 Found "Year of Purchase ${yopNum}" using fuzzy match on key "${key}" = "${value}"`);
                          break;
                        }
                      }
                    }
                  }
                  
                  if (standardValue && standardValue.trim() !== '' && standardValue !== 'undefined' && standardValue !== 'null') {
                    finalCleanMap[normalizedPlaceholder] = standardValue;
                    console.log(`✅ Fixed "Year of Purchase ${yopNum}" mapping for placeholder "${normalizedPlaceholder}" = "${standardValue}"`);
                    fixedCount++;
                  } else {
                    console.log(`⚠️ WARNING: Could not find value for placeholder "${normalizedPlaceholder}"`);
                    finalCleanMap[normalizedPlaceholder] = ''; // Set to empty string to prevent undefined
                  }
                } else {
                  console.log(`⚠️ WARNING: Could not find value for placeholder "${normalizedPlaceholder}"`);
                  finalCleanMap[normalizedPlaceholder] = ''; // Set to empty string to prevent undefined
                }
              } else {
                console.log(`⚠️ WARNING: Could not find value for placeholder "${normalizedPlaceholder}"`);
                finalCleanMap[normalizedPlaceholder] = ''; // Set to empty string to prevent undefined
              }
            }
          }
        }
      });
      
      if (fixedCount > 0) {
        console.log(`🔧 Fixed ${fixedCount} missing placeholder mappings`);
      }
    } catch (extractError) {
      console.warn('Could not extract placeholders for debugging:', extractError.message);
    }
    
    // Final cleanup: Remove any unwanted characters like "&", dots, commas, etc. from empty or placeholder values
    const cleanedFinalMap = {};
    Object.keys(finalCleanMap).forEach(key => {
      let value = finalCleanMap[key];
      
      // If value is empty, placeholder text, or contains only unwanted characters, set to empty string
      if (!value || 
          value === '_________________' || 
          value === 'undefined' || 
          value === 'null' ||
          value === '&' ||
          value === '&amp;' ||
          (typeof value === 'string' && value.trim() === '') ||
          (typeof value === 'string' && value.trim() === '&') ||
          (typeof value === 'string' && value.trim() === '&amp;')) {
        cleanedFinalMap[key] = '';
      } else {
        // Check if this is a comma-separated list field (certificate numbers, distinctive numbers, etc.)
        const isListField = key.toLowerCase().includes('certificate') || 
                           key.toLowerCase().includes('distinctive') ||
                           key.toLowerCase().includes('certificate number') ||
                           key.toLowerCase().includes('distinctive number') ||
                           key.toLowerCase().includes('sc') ||
                           key.toLowerCase().includes('dn');
        
        let cleanedValue;
        if (isListField && typeof value === 'string' && value.includes(',')) {
          // Use specialized cleaning for comma-separated lists
          cleanedValue = cleanCommaSeparatedList(value);
        } else {
          // Clean the value: remove unwanted characters like standalone "&", "&amp;", trailing commas, dots, etc.
          cleanedValue = String(value);
          
          // Remove trailing separators and unwanted characters
          // Remove trailing commas, spaces, and "&" (e.g., "123, 456, , &" -> "123, 456")
          cleanedValue = cleanedValue.replace(/[\s,]*&[\s,]*$/g, ''); // Remove trailing "&" with any surrounding commas/spaces
          cleanedValue = cleanedValue.replace(/[\s,]*&amp;[\s,]*$/g, ''); // Remove trailing "&amp;" with any surrounding commas/spaces
          cleanedValue = cleanedValue.replace(/[,.\s]+$/g, ''); // Remove trailing commas, dots, and spaces
          cleanedValue = cleanedValue.replace(/^[\s,]+/g, ''); // Remove leading commas and spaces
          
          // Remove multiple consecutive commas (e.g., ",," -> "")
          cleanedValue = cleanedValue.replace(/,{2,}/g, ',');
          
          // Remove commas/dots followed by spaces and "&" (e.g., ", &" -> "")
          cleanedValue = cleanedValue.replace(/,\s*&/g, '');
          cleanedValue = cleanedValue.replace(/\.\s*&/g, '');
          cleanedValue = cleanedValue.replace(/,\s*&amp;/g, '');
          cleanedValue = cleanedValue.replace(/\.\s*&amp;/g, '');
          
          // Remove standalone "&" characters (but keep "&" in valid text like "A&B Company")
          cleanedValue = cleanedValue.replace(/\s*&\s*$/g, ''); // Remove trailing "&"
          cleanedValue = cleanedValue.replace(/^\s*&\s*/g, ''); // Remove leading "&"
          cleanedValue = cleanedValue.replace(/\s*&amp;\s*$/g, ''); // Remove trailing "&amp;"
          cleanedValue = cleanedValue.replace(/^\s*&amp;\s*/g, ''); // Remove leading "&amp;"
          
          // Remove multiple dots/periods at the end
          cleanedValue = cleanedValue.replace(/\.{2,}$/g, '');
          
          // Remove trailing comma-space combinations (e.g., ", " at the end)
          cleanedValue = cleanedValue.replace(/,\s*$/g, '');
          
          // Trim whitespace
          cleanedValue = cleanedValue.trim();
        }
        
        // If after cleaning the value is empty or only contains separators, set to empty string
        if (cleanedValue === '' || 
            cleanedValue === '&' || 
            cleanedValue === '&amp;' ||
            cleanedValue === ',' ||
            cleanedValue === '.' ||
            cleanedValue.match(/^[,.\s&]+$/)) { // Only separators
          cleanedFinalMap[key] = '';
        } else {
          cleanedFinalMap[key] = cleanedValue;
        }
      }
    });
    
    // Set the template variables with the final clean map
    doc.setData(cleanedFinalMap);
    
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
      include: [{
        model: models.User,
        as: 'selectedByUser',
        attributes: ['id', 'name', 'email']
      }],
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
      selected_by: ct.selectedByUser ? { 
        id: ct.selectedByUser.id, 
        name: ct.selectedByUser.name || 'Unknown',
        email: ct.selectedByUser.email 
      } : null,
      admin_comment: ct.admin_comment || '',
      admin_remark: ct.admin_remark || '',
      review_status: ct.review_status || '',
      employee_response: ct.employee_response || '',
      employee_response_at: ct.employee_response_at || null,
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

// Update admin comment for a template (ADMIN ONLY)
const updateTemplateComment = async (req, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admins can update template comments and review status.'
      });
    }

    const { templateId } = req.params;
    const { admin_comment, admin_remark, review_status } = req.body;
    
    console.log(`💬 Admin ${req.user?.id} updating admin comment/status for template ${templateId}...`);
    console.log(`📝 Data received:`, { admin_comment, admin_remark, review_status });
    
    // Build update object with only provided fields
    const updateData = {};
    if (admin_comment !== undefined) updateData.admin_comment = admin_comment;
    if (admin_remark !== undefined) updateData.admin_remark = admin_remark;
    if (review_status !== undefined) updateData.review_status = review_status;
    
    const updatedTemplate = await models.CompanyTemplate.update(
      updateData,
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
    
    console.log(`✅ Template updated for template ${templateId}`);
    console.log(`📋 Updated template:`, updatedTemplate[1][0]);
    
    res.json({
      success: true,
      message: 'Admin comment and status updated successfully',
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

// Update employee response for a template (EMPLOYEE ONLY - Cannot edit existing responses)
const updateEmployeeResponse = async (req, res) => {
  try {
    const { templateId } = req.params;
    const { employee_response } = req.body;
    
    // Check if template exists and if it already has an employee response
    const existingTemplate = await models.CompanyTemplate.findOne({
      where: { id: templateId }
    });
    
    if (!existingTemplate) {
      return res.status(404).json({
        success: false,
        error: 'Template not found'
      });
    }
    
    // Prevent editing existing responses - employees can only add a response once
    if (existingTemplate.employee_response && existingTemplate.employee_response.trim() !== '') {
      return res.status(403).json({
        success: false,
        error: 'Cannot edit existing response. Your response has already been saved and cannot be modified. Please contact the admin if you need to add more information.'
      });
    }
    
    console.log(`💬 Employee ${req.user?.id} adding response for template ${templateId}...`);
    
    // Only allow adding new response if one doesn't exist
    const updatedTemplate = await models.CompanyTemplate.update(
      { 
        employee_response,
        employee_response_at: new Date()
      },
      { 
        where: { 
          id: templateId,
          employee_response: null // Only update if response is null
        },
        returning: true
      }
    );
    
    if (updatedTemplate[0] === 0) {
      return res.status(400).json({
        success: false,
        error: 'Cannot update response. A response already exists for this template.'
      });
    }
    
    console.log(`✅ Employee response saved for template ${templateId}`);
    
    res.json({
      success: true,
      message: 'Employee response saved successfully. Note: This response cannot be edited once saved.',
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

// Get employee performance metrics
const getEmployeePerformance = async (req, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admins can view employee performance.'
      });
    }

    console.log('📊 Fetching employee performance metrics...');

    // Get all employees (non-admin users)
    const { Op } = require('sequelize');
    const employees = await models.User.findAll({
      where: {
        role: { [Op.ne]: 'admin' }
      },
      attributes: ['id', 'name', 'email', 'role']
    });

    // Get all templates with review status
    const allTemplates = await models.CompanyTemplate.findAll({
      include: [
        {
          model: models.User,
          as: 'selectedByUser',
          attributes: ['id', 'name', 'email']
        }
      ]
    });

    // Fetch case information separately for companies
    const companyIds = [...new Set(allTemplates.map(t => t.company_id).filter(Boolean))];
    const companies = await models.Company.findAll({
      where: { id: { [Op.in]: companyIds } },
      attributes: ['id', 'company_name', 'case_id']
    });
    
    // Fetch cases for these companies
    const caseIds = [...new Set(companies.map(c => c.case_id).filter(Boolean))];
    const cases = await models.Case.findAll({
      where: { id: { [Op.in]: caseIds } },
      attributes: ['id', 'case_title', 'case_id']
    });
    
    // Create a map of company_id to case info
    const companyCaseMap = {};
    companies.forEach(company => {
      const caseData = cases.find(c => c.id === company.case_id);
      companyCaseMap[company.id] = caseData || null;
    });

    // Calculate performance metrics for each employee
    const performanceData = employees.map(employee => {
      // Get templates selected by this employee
      const employeeTemplates = allTemplates.filter(t => 
        t.selected_by === employee.id || 
        (t.selectedByUser && t.selectedByUser.id === employee.id)
      );

      // Count templates marked as "need_to_improve"
      const needImprovementCount = employeeTemplates.filter(t => 
        t.review_status === 'need_to_improve'
      ).length;

      // Count templates approved (done)
      const approvedCount = employeeTemplates.filter(t => 
        t.review_status === 'done'
      ).length;

      // Count templates pending review
      const pendingCount = employeeTemplates.filter(t => 
        !t.review_status || t.review_status === ''
      ).length;

      // Count resubmissions (templates that have employee_response after being marked need_to_improve)
      const resubmissionCount = employeeTemplates.filter(t => 
        t.review_status === 'need_to_improve' && 
        t.employee_response && 
        t.employee_response.trim() !== ''
      ).length;

      // Count total templates submitted
      const totalTemplates = employeeTemplates.length;

      // Count unique companies
      const uniqueCompanies = new Set(
        employeeTemplates
          .filter(t => t.company_id)
          .map(t => t.company_id)
      ).size;

      // Count unique cases
      const uniqueCases = new Set(
        employeeTemplates
          .filter(t => {
            const company = companies.find(c => c.id === t.company_id);
            return company && companyCaseMap[company.id];
          })
          .map(t => {
            const company = companies.find(c => c.id === t.company_id);
            return company && companyCaseMap[company.id] ? companyCaseMap[company.id].id : null;
          })
          .filter(Boolean)
      ).size;

      // Calculate approval rate
      const approvalRate = totalTemplates > 0 
        ? Math.round((approvedCount / totalTemplates) * 100) 
        : 0;

      // Calculate improvement needed rate
      const improvementRate = totalTemplates > 0 
        ? Math.round((needImprovementCount / totalTemplates) * 100) 
        : 0;

      // Calculate resubmission rate (how many times they had to resubmit)
      const resubmissionRate = needImprovementCount > 0 
        ? Math.round((resubmissionCount / needImprovementCount) * 100) 
        : 0;

      return {
        employee_id: employee.id,
        employee_name: employee.name,
        employee_email: employee.email,
        employee_role: employee.role,
        total_templates: totalTemplates,
        approved_count: approvedCount,
        need_improvement_count: needImprovementCount,
        pending_count: pendingCount,
        resubmission_count: resubmissionCount,
        unique_companies: uniqueCompanies,
        unique_cases: uniqueCases,
        approval_rate: approvalRate,
        improvement_rate: improvementRate,
        resubmission_rate: resubmissionRate,
        performance_score: approvalRate - (improvementRate * 0.5) // Penalize for improvements needed
      };
    });

    // Sort by performance score (highest first)
    performanceData.sort((a, b) => b.performance_score - a.performance_score);

    console.log(`✅ Calculated performance for ${performanceData.length} employees`);

    res.json({
      success: true,
      performance: performanceData,
      summary: {
        total_employees: performanceData.length,
        total_templates: performanceData.reduce((sum, emp) => sum + emp.total_templates, 0),
        total_need_improvement: performanceData.reduce((sum, emp) => sum + emp.need_improvement_count, 0),
        total_resubmissions: performanceData.reduce((sum, emp) => sum + emp.resubmission_count, 0),
        average_approval_rate: performanceData.length > 0
          ? Math.round(performanceData.reduce((sum, emp) => sum + emp.approval_rate, 0) / performanceData.length)
          : 0
      }
    });

  } catch (error) {
    console.error('Error getting employee performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee performance',
      details: error.message
    });
  }
};

// Get detailed templates for a specific employee and metric type
const getEmployeePerformanceDetails = async (req, res) => {
  try {
    // Check if user is admin
    const userRole = req.user?.role;
    if (userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Only admins can view employee performance details.'
      });
    }

    const { employeeId } = req.params;
    const { type } = req.query; // 'approved', 'need_improvement', 'resubmission'

    console.log(`📊 Fetching performance details for employee ${employeeId}, type: ${type}`);

    const { Op } = require('sequelize');

    // Build where clause based on type
    let whereClause = {
      selected_by: employeeId
    };

    if (type === 'approved') {
      whereClause.review_status = 'done';
    } else if (type === 'need_improvement') {
      whereClause.review_status = 'need_to_improve';
    } else if (type === 'resubmission') {
      // For resubmissions, we need templates marked need_to_improve that have employee_response
      whereClause.review_status = 'need_to_improve';
      // We'll filter for employee_response in JavaScript after fetching
    }

    // Get templates - for resubmission, we'll filter after fetching
    let templates;
    if (type === 'resubmission') {
      // Fetch all need_to_improve templates, then filter for those with responses
      templates = await models.CompanyTemplate.findAll({
        where: {
          selected_by: employeeId,
          review_status: 'need_to_improve'
        },
        include: [
          {
            model: models.User,
            as: 'selectedByUser',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['updated_at', 'DESC']]
      });
      // Filter for templates with employee_response
      templates = templates.filter(t => 
        t.employee_response && 
        t.employee_response.trim() !== ''
      );
    } else {
      templates = await models.CompanyTemplate.findAll({
        where: whereClause,
        include: [
          {
            model: models.User,
            as: 'selectedByUser',
            attributes: ['id', 'name', 'email']
          }
        ],
        order: [['updated_at', 'DESC']]
      });
    }

    // Get companies for these templates
    const companyIds = [...new Set(templates.map(t => t.company_id).filter(Boolean))];
    const companies = await models.Company.findAll({
      where: { id: { [Op.in]: companyIds } },
      attributes: ['id', 'company_name', 'case_id']
    });

    // Get cases for these companies
    const caseIds = [...new Set(companies.map(c => c.case_id).filter(Boolean))];
    const cases = await models.Case.findAll({
      where: { id: { [Op.in]: caseIds } },
      attributes: ['id', 'case_title', 'case_id']
    });

    // Create a map of company_id to case info
    const companyCaseMap = {};
    companies.forEach(company => {
      const caseData = cases.find(c => c.id === company.case_id);
      companyCaseMap[company.id] = {
        company_name: company.company_name,
        case: caseData
      };
    });

    // Format response
    const formattedTemplates = templates.map(template => {
      const companyInfo = companyCaseMap[template.company_id] || {};
      
      return {
        id: template.id,
        template_name: template.template_name,
        template_category: template.template_category,
        template_file: template.template_path,
        review_status: template.review_status,
        admin_comment: template.admin_comment,
        admin_remark: template.admin_remark,
        employee_response: template.employee_response,
        employee_response_at: template.employee_response_at,
        selected_at: template.selected_at,
        updated_at: template.updated_at,
        company_id: template.company_id,
        company_name: companyInfo.company_name || 'Unknown Company',
        case_id: companyInfo.case ? companyInfo.case.id : null,
        case_title: companyInfo.case ? companyInfo.case.case_title : null,
        case_case_id: companyInfo.case ? companyInfo.case.case_id : null,
      };
    });

    // For resubmission type, filter to only those with employee_response
    let finalTemplates = formattedTemplates;
    if (type === 'resubmission') {
      finalTemplates = formattedTemplates.filter(t => 
        t.employee_response && 
        t.employee_response.trim() !== '' &&
        t.review_status === 'need_to_improve'
      );
    }

    console.log(`✅ Found ${finalTemplates.length} templates for employee ${employeeId}, type: ${type}`);

    res.json({
      success: true,
      templates: finalTemplates,
      count: finalTemplates.length
    });

  } catch (error) {
    console.error('Error getting employee performance details:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch employee performance details',
      details: error.message
    });
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
  getTemplatePreview,
  getEmployeePerformance,
  getEmployeePerformanceDetails
};
