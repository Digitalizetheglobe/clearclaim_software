const { sequelize } = require('../src/config/database');
const CompanyTemplate = require('../src/models/CompanyTemplate')(sequelize);
const Company = require('../src/models/Company')(sequelize);
const path = require('path');
const fs = require('fs').promises;

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

const populateCompanyTemplates = async () => {
  try {
    console.log('Starting to populate company templates...');
    
    // Get all companies
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    if (companies.length === 0) {
      console.log('No companies found. Please create companies first.');
      return;
    }
    
    // Scan templates directory
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => file.endsWith('.docx'));
    
    console.log(`Found ${docxFiles.length} template files`);
    
    // Process each company
    for (const company of companies) {
      console.log(`Processing company: ${company.name} (ID: ${company.id})`);
      
      // Check if templates already exist for this company
      const existingTemplates = await CompanyTemplate.count({
        where: { company_id: company.id }
      });
      
      if (existingTemplates > 0) {
        console.log(`  Templates already exist for company ${company.name}, skipping...`);
        continue;
      }
      
      // Create template records for this company
      const templateRecords = [];
      
      for (const file of docxFiles) {
        const category = categorizeTemplate(file);
        const templateName = cleanTemplateName(file);
        
        templateRecords.push({
          company_id: company.id,
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
        console.log(`  Created ${templateRecords.length} template records for company ${company.name}`);
      }
    }
    
    console.log('Company templates population completed successfully!');
    
  } catch (error) {
    console.error('Error populating company templates:', error);
  } finally {
    await sequelize.close();
  }
};

// Run the script
populateCompanyTemplates();
