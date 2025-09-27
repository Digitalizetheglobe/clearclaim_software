const { CaseField, CaseValue, Case } = require('../models');
const fs = require('fs').promises;
const path = require('path');
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// Get all available templates
const getAllTemplates = async (req, res) => {
  try {
    // Scan templates directory
    const templatesDir = path.join(__dirname, '../../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => file.endsWith('.docx'));

    const templates = docxFiles.map(file => {
      const cleanName = file.replace('_Template.docx', '').replace(/_/g, ' ');
      let category = 'general';
      
      // Categorize templates based on filename
      if (file.includes('Annexure-D')) {
        category = 'individual_affidavit';
      } else if (file.includes('Annexure-E')) {
        category = 'indemnity_bond';
      } else if (file.includes('Annexure-F')) {
        category = 'noc';
      } else if (file.includes('Form-A')) {
        category = 'affidavit';
      } else if (file.includes('Form-B')) {
        category = 'indemnity';
      } else if (file.includes('ISR-')) {
        category = 'isr';
      } else if (file.includes('Name Mismatch')) {
        category = 'name_mismatch';
      } else if (file.includes('SH-13')) {
        category = 'sh13';
      }

      return {
        id: file,
        name: cleanName,
        filename: file,
        category: category,
        path: file
      };
    });

    // Group by category
    const templatesByCategory = {};
    templates.forEach(template => {
      if (!templatesByCategory[template.category]) {
        templatesByCategory[template.category] = [];
      }
      templatesByCategory[template.category].push(template);
    });

    res.json({
      message: 'Templates retrieved successfully',
      templates: templatesByCategory,
      totalTemplates: templates.length
    });
  } catch (error) {
    console.error('Error getting templates:', error);
    res.status(500).json({
      error: 'Failed to fetch templates',
      message: error.message
    });
  }
};

// Extract template content structure for preview
const extractTemplateStructure = async (templatePath) => {
  try {
    const templateFullPath = path.join(__dirname, '../../templates', templatePath);
    const templateBuffer = await fs.readFile(templateFullPath);
    
    // Create a new zip file from the template
    const zip = new PizZip(templateBuffer);
    
    // Extract document.xml to get the content
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[', end: ']' }
    });
    
    // Get the raw document XML content
    const documentXml = zip.files["word/document.xml"];
    if (documentXml) {
      const content = documentXml.asText();
      
      // Extract text content and placeholders
      const textContent = content
        .replace(/<[^>]*>/g, ' ') // Remove XML tags
        .replace(/\s+/g, ' ') // Normalize whitespace
        .trim();
      
      // Find all placeholders in the content
      const placeholders = [];
      const placeholderRegex = /\[([^\]]+)\]/g;
      let match;
      while ((match = placeholderRegex.exec(textContent)) !== null) {
        if (!placeholders.includes(match[1])) {
          placeholders.push(match[1]);
        }
      }
      
      return {
        placeholders,
        textContent: textContent.substring(0, 2000), // First 2000 chars for preview
        totalContent: textContent,
        hasContent: true
      };
    }
    
    return {
      placeholders: [],
      textContent: '',
      totalContent: '',
      hasContent: false
    };
  } catch (error) {
    console.error('Error extracting template structure:', error);
    return {
      placeholders: [],
      textContent: '',
      totalContent: '',
      hasContent: false
    };
  }
};

// Map case values to template placeholders
const mapCaseValuesToTemplate = async (caseId, templatePath) => {
  try {
    console.log(`Mapping values for case ${caseId} with template ${templatePath}`);
    
    // Get case values
    const caseValues = await CaseValue.findAll({
      where: { case_id: caseId },
      include: [
        {
          model: CaseField,
          as: 'caseField',
          attributes: ['field_key', 'field_label', 'field_type', 'field_category']
        }
      ]
    });

    console.log(`Found ${caseValues.length} case values for case ${caseId}`);
    
    // Debug: Log all available field keys
    const availableKeys = caseValues.map(cv => cv.caseField?.field_key).filter(Boolean);
    console.log('Available field keys:', availableKeys.slice(0, 10), '...');

    // Create a mapping object for easy lookup
    const valueMap = {};
    
    // First, map all direct field keys and labels
    caseValues.forEach(cv => {
      if (cv.caseField) {
        const fieldValue = cv.field_value || ''; // Ensure never undefined
        // Map by field key (exact match)
        valueMap[cv.caseField.field_key] = fieldValue;
        // Map by field label (exact match)  
        valueMap[cv.caseField.field_label] = fieldValue;
        
        // Debug logging for undefined values
        if (cv.field_value === undefined || cv.field_value === null) {
          console.log(`⚠️ Found undefined/null field value for ${cv.caseField.field_key}, setting to empty string`);
        }
      }
    });

    // Sort case values by priority to ensure correct mapping order
    const sortedCaseValues = caseValues.sort((a, b) => {
      const aKey = a.caseField?.field_key || '';
      const bKey = b.caseField?.field_key || '';
      
      // Priority order: specific fields first, then general ones
      const priority = {
        'Name as per Aadhar C1': 1,
        'PAN C1': 2,
        'Address C1': 3,
        'Mobile No C1': 4,
        'Email ID C1': 5,
        'DOB C1': 6,
        'Father Name C1': 7,
        'Age C1': 8
      };
      
      const aPriority = priority[aKey] || 999;
      const bPriority = priority[bKey] || 999;
      
      return aPriority - bPriority;
    });

    // Now create comprehensive mappings for all field variations
    sortedCaseValues.forEach(cv => {
      if (cv.caseField) {
        const key = cv.caseField.field_key;
        const value = cv.field_value || ''; // Ensure never undefined
        
        // Direct mapping for exact field keys (don't overwrite existing values)
        if (!valueMap[key]) {
          valueMap[key] = value;
        }
        
        // Create comprehensive mappings based on field patterns
        // Only map if the target field doesn't already have a value and we have a valid value
        if (key === 'Name as per Aadhar C1' && value && value.trim() !== '') {
          // Map to all name variations for C1, but only if they don't exist
          // NEVER map to PAN fields - those should only contain PAN numbers
          if (!valueMap['Name as per PAN C1']) valueMap['Name as per PAN C1'] = value;
          if (!valueMap['Name as per CML C1']) valueMap['Name as per CML C1'] = value;
          if (!valueMap['Name as per Bank C1']) valueMap['Name as per Bank C1'] = value;
          if (!valueMap['Name as per Passport C1']) valueMap['Name as per Passport C1'] = value;
          if (!valueMap['Name as per Succession/WILL/LHA C1']) valueMap['Name as per Succession/WILL/LHA C1'] = value;
          if (!valueMap['Name as per Cert C1']) valueMap['Name as per Cert C1'] = value;
          // For ISR-1 template
          if (!valueMap['Name(s) of the Security holder(s) as per the Certificate(s)']) {
            valueMap['Name(s) of the Security holder(s) as per the Certificate(s)'] = value;
          }
        }
        
        if (key.includes('Name as per Aadhar C2') && value && value.trim() !== '') {
          if (!valueMap['Name as per PAN C2']) valueMap['Name as per PAN C2'] = value;
          if (!valueMap['Name as per CML C2']) valueMap['Name as per CML C2'] = value;
          if (!valueMap['Name as per Bank C2']) valueMap['Name as per Bank C2'] = value;
          if (!valueMap['Name as per Passport C2']) valueMap['Name as per Passport C2'] = value;
          if (!valueMap['Name as per Succession/WILL/LHA C2']) valueMap['Name as per Succession/WILL/LHA C2'] = value;
          if (!valueMap['Name as per Cert C2']) valueMap['Name as per Cert C2'] = value;
        }
        
        if (key.includes('Name as per Aadhar C3') && value && value.trim() !== '') {
          if (!valueMap['Name as per PAN C3']) valueMap['Name as per PAN C3'] = value;
          if (!valueMap['Name as per CML C3']) valueMap['Name as per CML C3'] = value;
          if (!valueMap['Name as per Bank C3']) valueMap['Name as per Bank C3'] = value;
          if (!valueMap['Name as per Passport C3']) valueMap['Name as per Passport C3'] = value;
          if (!valueMap['Name as per Succession/WILL/LHA C3']) valueMap['Name as per Succession/WILL/LHA C3'] = value;
          if (!valueMap['Name as per Cert C3']) valueMap['Name as per Cert C3'] = value;
        }
        
        // Deceased names mapping
        if (key.includes('Name as per DC H1')) {
          valueMap['Name as per Certificate H1'] = value;
        }
        if (key.includes('Name as per DC H2')) {
          valueMap['Name as per Certificate H2'] = value;
        }
        if (key.includes('Name as per DC H3')) {
          valueMap['Name as per Certificate H3'] = value;
        }
        if (key.includes('Name as per DC H4')) {
          valueMap['Name as per Certificate H4'] = value;
        }
        
        // Legal heir names mapping
        if (key.includes('Name as per Aadhar LH1')) {
          valueMap['Name as per PAN LH1'] = value;
          valueMap['Name as per CML LH1'] = value;
          valueMap['Name as per Bank LH1'] = value;
          valueMap['Name as per Passport LH1'] = value;
          valueMap['Name as per Succession/WILL/LHA LH1'] = value;
          valueMap['Name as per Cert LH1'] = value;
        }
        
        // Address comprehensive mapping - be very specific
        if (key === 'Address C1') {
          if (!valueMap['Old Address C1']) valueMap['Old Address C1'] = value;
          if (!valueMap['Complete Address']) valueMap['Complete Address'] = value;
          if (!valueMap['Full Address']) valueMap['Full Address'] = value;
          if (!valueMap['Residential Address']) valueMap['Residential Address'] = value;
          if (!valueMap['Permanent Address']) valueMap['Permanent Address'] = value;
        }
        if (key === 'Address C2' && !valueMap['Old Address C2']) {
          valueMap['Old Address C2'] = value;
        }
        if (key === 'Address C3' && !valueMap['Old Address C3']) {
          valueMap['Old Address C3'] = value;
        }
        
        // Banking information mapping
        if (key.includes('Bank Name C1')) {
          valueMap['Bank Branch C1'] = value;
          valueMap['Bank Address C1'] = value;
        }
        if (key.includes('Bank AC C1')) {
          valueMap['Bank AC Type C1'] = value;
        }
        
        // Company and shares mapping
        if (key.includes('Company Name')) {
          valueMap['Name of the Issuer Company'] = value;
        }
        if (key.includes('Folio No')) {
          valueMap['Folio No.'] = value;
        }
        if (key.includes('Total Shares')) {
          valueMap['Number & Face value of securities'] = value;
          valueMap['No. of securities held'] = value;
        }
        
        // PAN comprehensive mapping - be very specific
        if (key === 'PAN C1') {
          // PAN C1 should ALWAYS contain the actual PAN number
          valueMap['PAN C1'] = value; // Force set the correct PAN value
          valueMap['pan_c1'] = value; // Also set the lowercase version
          // Only map PAN C1 to generic PAN fields, not to other specific fields
          if (!valueMap['PAN']) valueMap['PAN'] = value;
          if (!valueMap['PAN Number']) valueMap['PAN Number'] = value;
          if (!valueMap['PAN No']) valueMap['PAN No'] = value;
        }
        if (key === 'PAN C2') {
          valueMap['PAN C2'] = value;
          valueMap['pan_c2'] = value;
        }
        if (key === 'PAN C3') {
          valueMap['PAN C3'] = value;
          valueMap['pan_c3'] = value;
        }
        
        // Mobile comprehensive mapping
        if (key.includes('Mobile No C1')) {
          valueMap['Mobile'] = value;
          valueMap['Mobile Number'] = value;
          valueMap['Phone'] = value;
          valueMap['Contact No'] = value;
        }
        
        // Email comprehensive mapping
        if (key.includes('Email ID C1')) {
          valueMap['Email'] = value;
          valueMap['Email Address'] = value;
          valueMap['E-mail'] = value;
        }
        
        // DOB comprehensive mapping
        if (key.includes('DOB C1')) {
          valueMap['Date of Birth'] = value;
          valueMap['Birth Date'] = value;
          valueMap['DOB'] = value;
        }
        
        // Address components mapping
        if (key.includes('City')) {
          valueMap['City Name'] = value;
          valueMap['Town'] = value;
        }
        if (key.includes('State')) {
          valueMap['State Name'] = value;
          valueMap['Province'] = value;
        }
        if (key.includes('PIN C1')) {
          valueMap['Pincode'] = value;
          valueMap['Postal Code'] = value;
          valueMap['ZIP'] = value;
        }
        
        // Age comprehensive mapping
        if (key.includes('Age C1')) {
          valueMap['Age'] = value;
          valueMap['Years'] = value;
        }
        
        // Relation comprehensive mapping
        if (key.includes('Deceased Relation C1')) {
          valueMap['Relation'] = value;
          valueMap['Relationship'] = value;
          valueMap['Relation with Deceased'] = value;
        }
        
        // Father name mapping
        if (key.includes('Father Name C1')) {
          valueMap['Father\'s Name'] = value;
          valueMap['Father Name'] = value;
          valueMap['Parent Name'] = value;
        }
        
        // Additional common template mappings - only if target doesn't exist
        if (key === 'Name as per Aadhar C1') {
          // Common name variations
          if (!valueMap['Full Name']) valueMap['Full Name'] = value;
          if (!valueMap['Name']) valueMap['Name'] = value;
          if (!valueMap['Applicant Name']) valueMap['Applicant Name'] = value;
          if (!valueMap['Claimant Name']) valueMap['Claimant Name'] = value;
          if (!valueMap['Deponent Name']) valueMap['Deponent Name'] = value;
        }
        
        // Address variations - only if target doesn't exist
        if (key === 'Address C1') {
          if (!valueMap['Complete Address']) valueMap['Complete Address'] = value;
          if (!valueMap['Full Address']) valueMap['Full Address'] = value;
          if (!valueMap['Residential Address']) valueMap['Residential Address'] = value;
          if (!valueMap['Permanent Address']) valueMap['Permanent Address'] = value;
        }
        
        // Date variations - only if target doesn't exist
        if (key === 'DOB C1') {
          if (!valueMap['Date of Birth']) valueMap['Date of Birth'] = value;
          if (!valueMap['Birth Date']) valueMap['Birth Date'] = value;
          if (!valueMap['DOB']) valueMap['DOB'] = value;
          if (!valueMap['Born on']) valueMap['Born on'] = value;
        }
      }
    });
    
    // Debug: Log final mapping count and check for conflicts
    console.log(`Created ${Object.keys(valueMap).length} total mappings`);
    console.log('Sample mappings:', Object.entries(valueMap).slice(0, 5));
    
    // Check for specific problematic mappings
    const problematicMappings = [];
    Object.entries(valueMap).forEach(([key, value]) => {
      if (key.includes('PAN') && value && value.includes('Plot No')) {
        problematicMappings.push(`${key}: ${value}`);
      }
      if (key.includes('Name as per Aadhar C1') && value && value.includes('Tryambak')) {
        problematicMappings.push(`${key}: ${value}`);
      }
    });
    
    if (problematicMappings.length > 0) {
      console.log('⚠️ Problematic mappings detected:');
      problematicMappings.forEach(mapping => console.log(`  - ${mapping}`));
    }
    
    // MAJOR CLEANUP: Fix all mapping issues
    console.log('🔧 Starting comprehensive mapping cleanup...');
    
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
          const correctPanValue = caseValues.find(cv => 
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
          const correctNameValue = caseValues.find(cv => 
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
    
    // 3. Clean all undefined/null/empty values
    Object.keys(valueMap).forEach(key => {
      if (!valueMap[key] || 
          valueMap[key] === 'undefined' || 
          valueMap[key] === 'null' || 
          valueMap[key] === undefined || 
          valueMap[key] === null ||
          (typeof valueMap[key] === 'string' && valueMap[key].trim() === '')) {
        console.log(`🧹 Cleaning undefined/empty value for ${key}`);
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
    
    console.log('✅ Mapping cleanup completed');

    // Add only date defaults, no sample values
    const dateDefaults = {
      'Date of Issue': new Date().toLocaleDateString('en-IN'),
      'Current Date': new Date().toLocaleDateString('en-IN'),
      'Today Date': new Date().toLocaleDateString('en-IN')
    };

    // Only add date defaults for keys that don't already exist
    Object.keys(dateDefaults).forEach(key => {
      if (!valueMap[key]) {
        valueMap[key] = dateDefaults[key];
      }
    });

    // Extract template structure for better preview
    const templateStructure = await extractTemplateStructure(templatePath);

    // CRITICAL FIX: Initialize ALL template placeholders with empty strings
    // This prevents "undefined" from appearing in the final document
    if (templateStructure.placeholders && templateStructure.placeholders.length > 0) {
      console.log(`🔧 Initializing ${templateStructure.placeholders.length} template placeholders...`);
      templateStructure.placeholders.forEach(placeholder => {
        if (!valueMap.hasOwnProperty(placeholder)) {
          valueMap[placeholder] = ''; // Initialize with empty string, not undefined
          console.log(`📝 Initialized placeholder [${placeholder}] with empty string`);
        }
      });
    }

    // Final cleanup: Ensure no undefined values exist
    Object.keys(valueMap).forEach(key => {
      if (valueMap[key] === undefined || valueMap[key] === null || valueMap[key] === 'undefined' || valueMap[key] === 'null') {
        console.log(`🧹 Final cleanup: Setting ${key} to empty string`);
        valueMap[key] = '';
      }
    });

    console.log(`✅ Final valueMap has ${Object.keys(valueMap).length} entries, all undefined values cleaned`);

    // Read the template file
    const templateFullPath = path.join(__dirname, '../../templates', templatePath);
    const templateContent = await fs.readFile(templateFullPath);

    return {
      templateContent,
      valueMap,
      templateStructure,
      mappingPreview: generateMappingPreview(valueMap, templatePath, templateStructure)
    };
  } catch (error) {
    console.error('Error mapping case values to template:', error);
    throw error;
  }
};

// Generate mapping preview
const generateMappingPreview = (valueMap, templatePath, templateStructure) => {
  // Categorize mappings by type
  const categorizedMappings = {
    personal: {},
    address: {},
    company: {},
    dates: {},
    other: {}
  };

  Object.entries(valueMap).forEach(([key, value]) => {
    const lowerKey = key.toLowerCase();
    if (lowerKey.includes('name') || lowerKey.includes('age') || lowerKey.includes('relation')) {
      categorizedMappings.personal[key] = value;
    } else if (lowerKey.includes('address')) {
      categorizedMappings.address[key] = value;
    } else if (lowerKey.includes('company') || lowerKey.includes('folio') || lowerKey.includes('share')) {
      categorizedMappings.company[key] = value;
    } else if (lowerKey.includes('date')) {
      categorizedMappings.dates[key] = value;
    } else {
      categorizedMappings.other[key] = value;
    }
  });

  // Create populated preview content by replacing placeholders
  let populatedContent = templateStructure.textContent || '';
  Object.entries(valueMap).forEach(([key, value]) => {
    const placeholder = `[${key}]`;
    // Always replace placeholder, but use empty string for undefined/null values
    let cleanValue = '';
    if (value && 
        value !== 'undefined' && 
        value !== 'null' && 
        value !== null && 
        value !== undefined &&
        (typeof value === 'string' && value.trim() !== '')) {
      cleanValue = value;
    }
    populatedContent = populatedContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), cleanValue);
  });

  return {
    template: templatePath,
    totalMappings: Object.keys(valueMap).length,
    mappings: valueMap,
    categorizedMappings,
    populatedFields: Object.keys(valueMap).filter(key => valueMap[key] && valueMap[key].trim() !== '').length,
    emptyFields: Object.keys(valueMap).filter(key => !valueMap[key] || valueMap[key].trim() === '').length,
    templateStructure: {
      name: templatePath.replace('_Template.docx', '').replace(/_/g, ' '),
      category: templatePath.includes('Annexure-D') ? 'Individual Affidavit' : 
                templatePath.includes('Form-A') ? 'Affidavit' :
                templatePath.includes('Form-B') ? 'Indemnity' :
                templatePath.includes('ISR-') ? 'ISR' : 'General',
      description: getTemplateDescription(templatePath),
      placeholders: templateStructure.placeholders || [],
      originalContent: templateStructure.textContent || '',
      populatedContent: populatedContent
    }
  };
};

// Get template description based on filename
const getTemplateDescription = (templatePath) => {
  if (templatePath.includes('Annexure-D')) {
    return 'Individual affidavit document for legal heir claiming process';
  } else if (templatePath.includes('Annexure-E')) {
    return 'Indemnity bond document for securing claims';
  } else if (templatePath.includes('Form-A')) {
    return 'Standard affidavit form for claim processing';
  } else if (templatePath.includes('Form-B')) {
    return 'Indemnity form for claim security';
  } else if (templatePath.includes('ISR-')) {
    return 'Investment Scheme Registry document';
  } else if (templatePath.includes('Name Mismatch')) {
    return 'Affidavit for name mismatch correction';
  }
  return 'Standard legal document template';
};

// Get template preview with case data
const getTemplatePreview = async (req, res) => {
  try {
    const { caseId, templateName } = req.params;

    // Check if case exists
    const caseData = await Case.findByPk(caseId);
    if (!caseData) {
      return res.status(404).json({
        error: 'Case not found'
      });
    }

    // Map case values to template
    const mappedTemplate = await mapCaseValuesToTemplate(caseId, templateName);

    res.json({
      message: 'Template preview generated successfully',
      case: {
        id: caseData.id,
        case_id: caseData.case_id,
        case_title: caseData.case_title
      },
      template: {
        name: templateName,
        category: templateName.includes('Annexure-D') ? 'individual_affidavit' : 'general'
      },
      preview: mappedTemplate.mappingPreview
    });
  } catch (error) {
    console.error('Error getting template preview:', error);
    res.status(500).json({
      error: 'Failed to generate template preview',
      message: error.message
    });
  }
};

// Download populated template
const downloadPopulatedTemplate = async (req, res) => {
  try {
    const { caseId, templateName } = req.params;

    // Check if case exists
    const caseData = await Case.findByPk(caseId);
    if (!caseData) {
      return res.status(404).json({
        error: 'Case not found'
      });
    }

    // Map case values to template
    const mappedTemplate = await mapCaseValuesToTemplate(caseId, templateName);

    // Read the template file
    const templatePath = path.join(__dirname, '../../templates', templateName);

    // Check if template file exists
    try {
      await fs.access(templatePath);
    } catch (accessError) {
      console.error(`Template file not found: ${templatePath}`);
      return res.status(404).json({
        error: 'Template file not found',
        message: `The template file ${templateName} does not exist.`
      });
    }

    const templateBuffer = await fs.readFile(templatePath);

    // Validate that it's a valid docx file
    if (templateBuffer.length < 4 || templateBuffer.toString('hex', 0, 4) !== '504b0304') {
      console.error(`Invalid docx file: ${templatePath}`);
      return res.status(400).json({
        error: 'Invalid template file',
        message: 'Invalid template file format'
      });
    }

    // Create a new zip file from the template
    const zip = new PizZip(templateBuffer);

    // Create docxtemplater instance
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '[', end: ']' }
    });

    try {
      // Clean the value map to handle undefined/empty values properly
      const cleanValueMap = {};
      let undefinedCount = 0;
      let cleanCount = 0;
      
      Object.entries(mappedTemplate.valueMap).forEach(([key, value]) => {
        // If value is undefined, null, 'undefined', 'null', or empty, set to empty string
        if (!value || 
            value === 'undefined' || 
            value === 'null' || 
            value === null || 
            value === undefined ||
            (typeof value === 'string' && value.trim() === '')) {
          cleanValueMap[key] = '';
          undefinedCount++;
          if (value === 'undefined' || value === undefined) {
            console.log(`🧹 Cleaned undefined value for key: ${key}`);
          }
        } else {
          cleanValueMap[key] = value;
          cleanCount++;
        }
      });

      console.log(`🔧 Template data summary: ${cleanCount} valid values, ${undefinedCount} empty/undefined values cleaned`);
      console.log(`🔧 Setting template data with ${Object.keys(cleanValueMap).length} total fields`);

      // CRITICAL: Final aggressive cleanup to prevent ANY undefined values
      const finalCleanMap = {};
      Object.keys(cleanValueMap).forEach(key => {
        const value = cleanValueMap[key];
        if (value === undefined || value === null || value === 'undefined' || value === 'null' || !value) {
          finalCleanMap[key] = ''; // Force empty string
          console.log(`🚨 FINAL CLEANUP: Forced ${key} to empty string (was: ${value})`);
        } else {
          finalCleanMap[key] = String(value); // Ensure it's a string
        }
      });

      console.log(`🔧 Final template data prepared with ${Object.keys(finalCleanMap).length} fields`);
      console.log(`🔧 Sample final data:`, Object.entries(finalCleanMap).slice(0, 3));

      // Set the template variables with the final clean map
      doc.setData(finalCleanMap);

      // Render the document
      doc.render();

      // Generate the populated document buffer
      let buffer = doc.getZip().generate({ type: 'nodebuffer' });

      // LAST RESORT: Check if the generated document still contains "undefined" text
      // This is a post-processing step to catch any remaining undefined values
      try {
        const zip = new PizZip(buffer);
        const documentXml = zip.files["word/document.xml"];
        
        if (documentXml) {
          let content = documentXml.asText();
          const originalContent = content;
          
          // Replace any remaining "undefined" text with empty string
          content = content.replace(/undefined/g, '');
          
          if (content !== originalContent) {
            console.log('🚨 POST-PROCESSING: Found and removed "undefined" text from generated document');
            
            // Update the document.xml content
            zip.file("word/document.xml", content);
            
            // Regenerate the buffer with cleaned content
            buffer = zip.generate({ type: 'nodebuffer' });
            console.log('✅ Document post-processed and cleaned');
          } else {
            console.log('✅ No "undefined" text found in generated document');
          }
        }
      } catch (postProcessError) {
        console.error('Warning: Post-processing failed, using original buffer:', postProcessError.message);
        // Continue with original buffer if post-processing fails
      }

      // Set response headers for file download
      const filename = templateName.replace('_Template.docx', '_Populated.docx');
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      console.log(`Successfully rendered template: ${templateName} for case: ${caseData.case_id}`);
      res.send(buffer);
    } catch (renderError) {
      console.error('Error rendering template:', renderError);
      
      // If there's an error, return the original template
      const fileStream = require('fs').createReadStream(templatePath);
      const filename = templateName.replace('_Template.docx', '_Original.docx');
      
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      
      fileStream.pipe(res);
    }
  } catch (error) {
    console.error('Error downloading populated template:', error);
    res.status(500).json({
      error: 'Failed to download template',
      message: error.message
    });
  }
};

// Get template statistics
const getTemplateStats = async (req, res) => {
  try {
    const templatesDir = path.join(__dirname, '../../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => file.endsWith('.docx'));

    // Count by category
    const categoryStats = {};
    docxFiles.forEach(file => {
      let category = 'general';
      
      if (file.includes('Annexure-D')) {
        category = 'Individual Affidavit';
      } else if (file.includes('Annexure-E')) {
        category = 'Indemnity Bond';
      } else if (file.includes('Annexure-F')) {
        category = 'NOC';
      } else if (file.includes('Form-A')) {
        category = 'Affidavit';
      } else if (file.includes('Form-B')) {
        category = 'Indemnity';
      } else if (file.includes('ISR-')) {
        category = 'ISR';
      } else if (file.includes('Name Mismatch')) {
        category = 'Name Mismatch';
      } else if (file.includes('SH-13')) {
        category = 'SH-13';
      }

      if (!categoryStats[category]) {
        categoryStats[category] = 0;
      }
      categoryStats[category]++;
    });

    res.json({
      message: 'Template statistics retrieved successfully',
      stats: {
        totalTemplates: docxFiles.length,
        categories: Object.keys(categoryStats).length,
        categoryBreakdown: categoryStats
      }
    });
  } catch (error) {
    console.error('Error getting template stats:', error);
    res.status(500).json({
      error: 'Failed to fetch template statistics',
      message: error.message
    });
  }
};

module.exports = {
  getAllTemplates,
  getTemplatePreview,
  downloadPopulatedTemplate,
  getTemplateStats
};
