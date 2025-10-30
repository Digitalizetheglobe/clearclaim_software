const { sequelize } = require('../src/config/database');
const CompanyTemplate = require('../src/models/CompanyTemplate')(sequelize);
const Company = require('../src/models/Company')(sequelize);
const CompanyValue = require('../src/models/CompanyValue')(sequelize);
const CaseField = require('../src/models/CaseField')(sequelize);
const path = require('path');
const fs = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

// Test template functionality
const testTemplateFunctionality = async (templateFilename) => {
  try {
    console.log(`🧪 Testing template functionality for: ${templateFilename}`);
    
    // 1. Check if template file exists
    const templatePath = path.join(__dirname, '../templates', templateFilename);
    try {
      await fs.access(templatePath);
      console.log(`✅ Template file exists: ${templateFilename}`);
    } catch (error) {
      console.error(`❌ Template file not found: ${templateFilename}`);
      return false;
    }
    
    // 2. Check if template is valid .docx file
    const templateBuffer = await fs.readFile(templatePath);
    if (templateBuffer.length < 4 || templateBuffer.toString('hex', 0, 4) !== '504b0304') {
      console.error(`❌ Invalid .docx file format`);
      return false;
    }
    console.log(`✅ Template file is valid .docx format`);
    
    // 3. Extract placeholders from template
    const zip = new PizZip(templateBuffer);
    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: {
        start: '[',
        end: ']'
      }
    });
    
    const templateText = doc.getFullText();
    const placeholderRegex = /\[([^\]]+)\]/g;
    const foundPlaceholders = [];
    let match;
    while ((match = placeholderRegex.exec(templateText)) !== null) {
      foundPlaceholders.push(match[1]);
    }
    
    console.log(`📋 Found ${foundPlaceholders.length} placeholders in template:`);
    const uniquePlaceholders = [...new Set(foundPlaceholders)];
    uniquePlaceholders.forEach(placeholder => {
      console.log(`  - [${placeholder}]`);
    });
    
    // 4. Check database records
    const templateRecords = await CompanyTemplate.findAll({
      where: { template_path: templateFilename }
    });
    
    console.log(`📊 Found ${templateRecords.length} database records for this template`);
    templateRecords.forEach(record => {
      console.log(`  - Company ID: ${record.company_id}, Name: ${record.template_name}, Category: ${record.template_category}`);
    });
    
    // 5. Test with sample data (if any company has values)
    if (templateRecords.length > 0) {
      const firstCompanyId = templateRecords[0].company_id;
      
      // Get company values
      const companyValues = await CompanyValue.findAll({
        where: { company_id: firstCompanyId },
        include: [
          {
            model: CaseField,
            as: 'caseField',
            attributes: ['field_key', 'field_label', 'field_type']
          }
        ]
      });
      
      console.log(`📊 Found ${companyValues.length} company values for testing`);
      
      if (companyValues.length > 0) {
        // Create test mapping
        const testValueMap = {};
        companyValues.forEach(cv => {
          if (cv.caseField && cv.field_value) {
            testValueMap[cv.caseField.field_key] = cv.field_value;
            testValueMap[cv.caseField.field_label] = cv.field_value;
          }
        });
        
        // Add common mappings
        testValueMap['Current Date'] = new Date().toLocaleDateString('en-GB');
        testValueMap['Today Date'] = new Date().toLocaleDateString('en-GB');
        
        console.log(`🗺️ Created test mapping with ${Object.keys(testValueMap).length} values`);
        
        // Test template rendering
        try {
          const testDoc = new Docxtemplater(zip, {
            paragraphLoop: true,
            linebreaks: true,
            delimiters: {
              start: '[',
              end: ']'
            },
            nullGetter: function(part, scopeManager) {
              return '';
            }
          });
          
          testDoc.setData(testValueMap);
          testDoc.render();
          
          console.log(`✅ Template rendering test passed!`);
          
          // Check for any remaining placeholders
          const renderedText = testDoc.getFullText();
          const remainingPlaceholders = [];
          let remainingMatch;
          const remainingRegex = /\[([^\]]+)\]/g;
          while ((remainingMatch = remainingRegex.exec(renderedText)) !== null) {
            remainingPlaceholders.push(remainingMatch[1]);
          }
          
          if (remainingPlaceholders.length > 0) {
            console.log(`⚠️ ${remainingPlaceholders.length} placeholders were not mapped:`);
            remainingPlaceholders.forEach(placeholder => {
              console.log(`  - [${placeholder}]`);
            });
          } else {
            console.log(`🎉 All placeholders were successfully mapped!`);
          }
          
        } catch (renderError) {
          console.error(`❌ Template rendering failed:`, renderError.message);
          if (renderError.properties && renderError.properties.errors) {
            renderError.properties.errors.forEach(error => {
              console.error(`  - ${error.name}: ${error.message}`);
            });
          }
          return false;
        }
      }
    }
    
    console.log(`🎉 Template functionality test completed successfully!`);
    return true;
    
  } catch (error) {
    console.error('❌ Error testing template functionality:', error);
    return false;
  } finally {
    await sequelize.close();
  }
};

// List all available templates
const listTemplates = async () => {
  try {
    console.log('📋 Available templates:');
    
    const templatesDir = path.join(__dirname, '../templates');
    const templateFiles = await fs.readdir(templatesDir);
    const docxFiles = templateFiles.filter(file => file.endsWith('.docx') && !file.startsWith('~$'));
    
    docxFiles.forEach(file => {
      console.log(`  - ${file}`);
    });
    
    console.log(`\nTotal: ${docxFiles.length} template files`);
    
  } catch (error) {
    console.error('❌ Error listing templates:', error);
  }
};

// Get command line arguments
const args = process.argv.slice(2);
const command = args[0];

if (command === 'test') {
  const templateFilename = args[1];
  
  if (!templateFilename) {
    console.log('Usage: node testTemplate.js test <template_filename>');
    console.log('Example: node testTemplate.js test "Annexure-D (Individual Affidavit)_C1_Template (2).docx"');
    process.exit(1);
  }
  
  testTemplateFunctionality(templateFilename);
} else if (command === 'list') {
  listTemplates();
} else {
  console.log('Template Testing Script');
  console.log('');
  console.log('Usage:');
  console.log('  node testTemplate.js test <template_filename>  - Test specific template functionality');
  console.log('  node testTemplate.js list                       - List all available templates');
  console.log('');
  console.log('Examples:');
  console.log('  node testTemplate.js test "Annexure-D (Individual Affidavit)_C1_Template (2).docx"');
  console.log('  node testTemplate.js list');
}
