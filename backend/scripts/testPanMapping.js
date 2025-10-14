const models = require('../src/models');
const { sequelize } = require('../src/config/database');
const path = require('path');
const fs = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const CompanyValue = models.CompanyValue;
const Company = models.Company;

/**
 * Script to test the PAN field mapping fix
 * This script will test the template processing with actual data
 */
async function testPanMapping() {
  try {
    console.log('🔍 Testing PAN field mapping fix...');
    
    // Get a company with data
    const company = await Company.findOne({
      where: { id: 17 } // Use company ID 17 which has data
    });
    
    if (!company) {
      console.log('❌ No company found with ID 17');
      return;
    }
    
    console.log(`📋 Testing with company: ${company.company_name} (ID: ${company.id})`);
    
    // Get company values
    const companyValues = await CompanyValue.findAll({
      where: { company_id: company.id }
    });
    
    console.log(`📊 Found ${companyValues.length} company values`);
    
    // Create valueMap like the template processing does
    const valueMap = {};
    companyValues.forEach(cv => {
      if (cv.field_key && cv.field_value) {
        valueMap[cv.field_key] = cv.field_value;
        
        // Add the PAN mapping logic
        const key = cv.field_key.toLowerCase();
        if (key.includes('name as per pan c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Name as per PAN C${suffix}`;
          if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
          if (!valueMap[`name_pan_c${suffix}`]) valueMap[`name_pan_c${suffix}`] = cv.field_value;
          console.log(`✅ Mapped Name as per PAN C${suffix}: ${cv.field_value}`);
        }
      }
    });
    
    // Check if Name as per PAN C1 is in the valueMap
    console.log('\n🔍 Checking valueMap for Name as per PAN C1:');
    console.log(`   valueMap['Name as per PAN C1']: ${valueMap['Name as per PAN C1'] || 'NOT FOUND'}`);
    console.log(`   valueMap['name_pan_c1']: ${valueMap['name_pan_c1'] || 'NOT FOUND'}`);
    
    // Test template processing
    console.log('\n🔍 Testing template processing...');
    const templatePath = path.join(__dirname, '../templates/Name Mismatch SELF Affidavit_C1_Template.docx');
    
    try {
      const templateBuffer = await fs.readFile(templatePath);
      const zip = new PizZip(templateBuffer);
      
      const doc = new Docxtemplater(zip, {
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
      
      // Set the data
      doc.setData(valueMap);
      
      try {
        doc.render();
        console.log('✅ Template rendered successfully');
        
        // Check if the rendered content contains the PAN name
        const renderedText = doc.getFullText();
        if (renderedText.includes('Name as per PAN C1')) {
          console.log('❌ ISSUE: Template still contains placeholder [Name as per PAN C1]');
        } else {
          console.log('✅ SUCCESS: Template placeholder [Name as per PAN C1] has been replaced');
        }
        
        // Check for the actual PAN name
        const panName = valueMap['Name as per PAN C1'];
        if (panName && renderedText.includes(panName)) {
          console.log(`✅ SUCCESS: Template contains the PAN name: ${panName}`);
        } else {
          console.log(`❌ ISSUE: Template does not contain the PAN name: ${panName}`);
        }
        
      } catch (renderError) {
        console.error('❌ Error rendering template:', renderError.message);
      }
      
    } catch (templateError) {
      console.error('❌ Error reading template:', templateError.message);
    }
    
    console.log('\n✅ PAN field mapping test completed');
    
  } catch (error) {
    console.error('❌ Error testing PAN field mapping:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`PAN Field Mapping Test Tool`);
console.log(`${'='.repeat(60)}\n`);

testPanMapping().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PAN field mapping test complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});

