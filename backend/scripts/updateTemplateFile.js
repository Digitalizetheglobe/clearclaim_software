const { sequelize } = require('../src/config/database');
const CompanyTemplate = require('../src/models/CompanyTemplate')(sequelize);
const path = require('path');
const fs = require('fs').promises;

// Script to update template file references in database
const updateTemplateFile = async (oldFilename, newFilename) => {
  try {
    console.log(`🔄 Updating template file reference from "${oldFilename}" to "${newFilename}"`);
    
    // Check if new file exists
    const newFilePath = path.join(__dirname, '../templates', newFilename);
    try {
      await fs.access(newFilePath);
      console.log(`✅ New template file found: ${newFilename}`);
    } catch (error) {
      console.error(`❌ New template file not found: ${newFilename}`);
      console.error(`Please place the new template file in backend/templates/`);
      return;
    }
    
    // Find all records with the old filename
    const templates = await CompanyTemplate.findAll({
      where: { template_path: oldFilename }
    });
    
    console.log(`📊 Found ${templates.length} template records to update`);
    
    if (templates.length === 0) {
      console.log(`⚠️ No records found with filename: ${oldFilename}`);
      console.log(`Available templates in database:`);
      const allTemplates = await CompanyTemplate.findAll({
        attributes: ['template_path'],
        group: ['template_path']
      });
      allTemplates.forEach(t => console.log(`  - ${t.template_path}`));
      return;
    }
    
    // Update all records
    const updateResult = await CompanyTemplate.update(
      { template_path: newFilename },
      { where: { template_path: oldFilename } }
    );
    
    console.log(`✅ Updated ${updateResult[0]} template records`);
    
    // Show affected companies
    const updatedTemplates = await CompanyTemplate.findAll({
      where: { template_path: newFilename },
      attributes: ['company_id', 'template_name', 'template_category']
    });
    
    console.log(`📋 Updated templates:`);
    updatedTemplates.forEach(t => {
      console.log(`  - Company ID: ${t.company_id}, Name: ${t.template_name}, Category: ${t.template_category}`);
    });
    
    console.log(`🎉 Template file update completed successfully!`);
    
  } catch (error) {
    console.error('❌ Error updating template file:', error);
  } finally {
    await sequelize.close();
  }
};

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

// Function to add a completely new template
const addNewTemplate = async (filename) => {
  try {
    console.log(`➕ Adding new template: ${filename}`);
    
    // Check if file exists
    const filePath = path.join(__dirname, '../templates', filename);
    try {
      await fs.access(filePath);
      console.log(`✅ Template file found: ${filename}`);
    } catch (error) {
      console.error(`❌ Template file not found: ${filename}`);
      return;
    }
    
    // Get all companies
    const Company = require('../src/models/Company')(sequelize);
    const companies = await Company.findAll();
    
    console.log(`📊 Found ${companies.length} companies`);
    
    // Create template records for each company
    const templateRecords = [];
    const category = categorizeTemplate(filename);
    const templateName = cleanTemplateName(filename);
    
    for (const company of companies) {
      templateRecords.push({
        company_id: company.id,
        template_name: templateName,
        template_category: category,
        template_path: filename,
        is_selected: false,
        selected_by: null,
        selected_at: null
      });
    }
    
    // Bulk create templates
    if (templateRecords.length > 0) {
      await CompanyTemplate.bulkCreate(templateRecords);
      console.log(`✅ Created ${templateRecords.length} template records for ${companies.length} companies`);
    }
    
    console.log(`🎉 New template added successfully!`);
    
  } catch (error) {
    console.error('❌ Error adding new template:', error);
  } finally {
    await sequelize.close();
  }
};

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'update') {
  const oldFilename = args[1];
  const newFilename = args[2];
  
  if (!oldFilename || !newFilename) {
    console.log('Usage: node updateTemplateFile.js update <old_filename> <new_filename>');
    console.log('Example: node updateTemplateFile.js update "old_template.docx" "new_template.docx"');
    process.exit(1);
  }
  
  updateTemplateFile(oldFilename, newFilename);
} else if (command === 'add') {
  const filename = args[1];
  
  if (!filename) {
    console.log('Usage: node updateTemplateFile.js add <filename>');
    console.log('Example: node updateTemplateFile.js add "new_template.docx"');
    process.exit(1);
  }
  
  addNewTemplate(filename);
} else {
  console.log('Template File Management Script');
  console.log('');
  console.log('Usage:');
  console.log('  node updateTemplateFile.js update <old_filename> <new_filename>  - Update existing template file reference');
  console.log('  node updateTemplateFile.js add <filename>                        - Add completely new template');
  console.log('');
  console.log('Examples:');
  console.log('  node updateTemplateFile.js update "old_template.docx" "new_template.docx"');
  console.log('  node updateTemplateFile.js add "brand_new_template.docx"');
}
