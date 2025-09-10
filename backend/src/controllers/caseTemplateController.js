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

    // Create a mapping object for easy lookup
    const valueMap = {};
    caseValues.forEach(cv => {
      if (cv.caseField && cv.field_value) {
        // Map by field key
        valueMap[cv.caseField.field_key] = cv.field_value;
        // Map by field label
        valueMap[cv.caseField.field_label] = cv.field_value;
        
        // Create specific mappings based on field keys
        const key = cv.caseField.field_key.toLowerCase();
        
        // Common name mappings
        if (key.includes('client_name')) {
          valueMap['Name as per Aadhar C1'] = cv.field_value;
          valueMap['Name as per Aadhar C2'] = cv.field_value;
          valueMap['Name as per Aadhar C3'] = cv.field_value;
          valueMap['Name as per DC H1'] = cv.field_value;
          valueMap['Name as per DC H2'] = cv.field_value;
          valueMap['Name as per DC H3'] = cv.field_value;
          valueMap['Name as per DC H4'] = cv.field_value;
          valueMap['Name as per Aadhar LH1'] = cv.field_value;
          valueMap['Name as per Aadhar LH2'] = cv.field_value;
          valueMap['Name as per Aadhar LH3'] = cv.field_value;
          valueMap['Name as per Aadhar LH4'] = cv.field_value;
          valueMap['Name as per Aadhar LH5'] = cv.field_value;
        }
        
        // Address mappings
        if (key.includes('client_address') || key.includes('address')) {
          valueMap['Address C1'] = cv.field_value;
          valueMap['Address C2'] = cv.field_value;
          valueMap['Address C3'] = cv.field_value;
          valueMap['Address LH1'] = cv.field_value;
          valueMap['Address LH2'] = cv.field_value;
          valueMap['Address LH3'] = cv.field_value;
          valueMap['Address LH4'] = cv.field_value;
          valueMap['Address LH5'] = cv.field_value;
        }
        
        // Age mappings
        if (key.includes('age')) {
          valueMap['Age C1'] = cv.field_value;
          valueMap['Age C2'] = cv.field_value;
          valueMap['Age C3'] = cv.field_value;
          valueMap['Age LH1'] = cv.field_value;
          valueMap['Age LH2'] = cv.field_value;
          valueMap['Age LH3'] = cv.field_value;
          valueMap['Age LH4'] = cv.field_value;
          valueMap['Age LH5'] = cv.field_value;
        }
        
        // Relation mappings
        if (key.includes('relation')) {
          valueMap['Relation C1'] = cv.field_value;
          valueMap['Relation C2'] = cv.field_value;
          valueMap['Relation C3'] = cv.field_value;
          valueMap['Relation LH1'] = cv.field_value;
          valueMap['Relation LH2'] = cv.field_value;
          valueMap['Relation LH3'] = cv.field_value;
          valueMap['Relation LH4'] = cv.field_value;
          valueMap['Relation LH5'] = cv.field_value;
        }
        
        // Company specific mappings
        if (key.includes('company_name')) {
          valueMap['Company Name'] = cv.field_value;
        }
        
        if (key.includes('folio_no')) {
          valueMap['Folio No'] = cv.field_value;
        }
        
        if (key.includes('total_shares')) {
          valueMap['Total Shares'] = cv.field_value;
        }
        
        // Deceased information
        if (key.includes('deceased_name')) {
          valueMap['Name as per Aadhar C1'] = cv.field_value;
          valueMap['Deceased Name C1'] = cv.field_value;
          valueMap['Deceased Name C2'] = cv.field_value;
          valueMap['Deceased Name C3'] = cv.field_value;
        }
      }
    });

    // Add default values for common empty placeholders
    const defaultValues = {
      'Date of Issue': new Date().toLocaleDateString('en-IN'),
      'Current Date': new Date().toLocaleDateString('en-IN'),
      'Today Date': new Date().toLocaleDateString('en-IN'),
      // Add sample values if no case data exists
      'Name as per Aadhar C1': valueMap['Name as per Aadhar C1'] || 'Sample Name C1',
      'Name as per Aadhar C2': valueMap['Name as per Aadhar C2'] || 'Sample Name C2', 
      'Name as per Aadhar C3': valueMap['Name as per Aadhar C3'] || 'Sample Name C3',
      'Address C1': valueMap['Address C1'] || 'Sample Address C1',
      'Address C2': valueMap['Address C2'] || 'Sample Address C2',
      'Address C3': valueMap['Address C3'] || 'Sample Address C3',
      'Age C1': valueMap['Age C1'] || '30',
      'Age C2': valueMap['Age C2'] || '28',
      'Age C3': valueMap['Age C3'] || '25',
      'Relation C1': valueMap['Relation C1'] || 'Son',
      'Relation C2': valueMap['Relation C2'] || 'Daughter',
      'Relation C3': valueMap['Relation C3'] || 'Spouse',
      'Company Name': valueMap['Company Name'] || 'Sample Company Ltd.',
      'Folio No': valueMap['Folio No'] || 'FOL123456',
      'Total Shares': valueMap['Total Shares'] || '1000'
    };

    // Only add default values for keys that don't already exist
    Object.keys(defaultValues).forEach(key => {
      if (!valueMap[key]) {
        valueMap[key] = defaultValues[key];
      }
    });

    // Extract template structure for better preview
    const templateStructure = await extractTemplateStructure(templatePath);

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
    if (value) {
      const placeholder = `[${key}]`;
      populatedContent = populatedContent.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
    }
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
      // Set the template variables
      doc.setData(mappedTemplate.valueMap);

      // Render the document
      doc.render();

      // Generate the populated document
      const buffer = doc.getZip().generate({ type: 'nodebuffer' });

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
