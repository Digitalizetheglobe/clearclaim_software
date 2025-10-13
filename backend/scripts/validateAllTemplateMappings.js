const models = require('../src/models');
const { sequelize } = require('../src/config/database');
const path = require('path');
const fs = require('fs').promises;
const Docxtemplater = require('docxtemplater');
const PizZip = require('pizzip');

const CompanyValue = models.CompanyValue;
const Company = models.Company;

/**
 * Comprehensive script to validate all template mappings
 * This script will test the template processing with actual data to ensure all fields are mapped correctly
 */
async function validateAllTemplateMappings() {
  try {
    console.log('🔍 Starting comprehensive template mapping validation...');
    
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
        
        // Add all the mapping logic from the controller
        const key = cv.field_key.toLowerCase();
        
        // Handle name fields dynamically
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
        
        // Handle address fields dynamically
        if (key.includes('address c') && key.match(/c\d+$/)) {
          const suffix = key.match(/c(\d+)$/)[1];
          const fieldKey = `Address C${suffix}`;
          
          // CRITICAL: Only map if this is NOT a bank address field
          if (!key.includes('bank') && !key.includes('Bank')) {
            if (!valueMap[fieldKey]) valueMap[fieldKey] = cv.field_value;
            if (!valueMap[`address_c${suffix}`]) valueMap[`address_c${suffix}`] = cv.field_value;
          }
        }
      }
    });
    
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
        
        // Check the rendered content for specific fields
        const renderedText = doc.getFullText();
        
        console.log('\n📋 Checking specific field mappings:');
        
        // Check Name as per PAN C1
        if (renderedText.includes('[Name as per PAN C1]')) {
          console.log('❌ ISSUE: [Name as per PAN C1] placeholder still exists');
        } else {
          console.log('✅ SUCCESS: [Name as per PAN C1] placeholder has been replaced');
        }
        
        // Check Address C1
        if (renderedText.includes('[Address C1]')) {
          console.log('❌ ISSUE: [Address C1] placeholder still exists');
        } else {
          console.log('✅ SUCCESS: [Address C1] placeholder has been replaced');
        }
        
        // Check for bank address in claimant address field
        if (renderedText.includes('Ambar Plaza') || renderedText.includes('HDFC')) {
          console.log('❌ ISSUE: Bank address found in claimant address field');
        } else {
          console.log('✅ SUCCESS: No bank address in claimant address field');
        }
        
        // Check for the actual values
        const panName = valueMap['Name as per PAN C1'];
        if (panName && renderedText.includes(panName)) {
          console.log(`✅ SUCCESS: Template contains the PAN name: ${panName}`);
        } else {
          console.log(`❌ ISSUE: Template does not contain the PAN name: ${panName}`);
        }
        
        const address = valueMap['Address C1'];
        if (address && renderedText.includes(address)) {
          console.log(`✅ SUCCESS: Template contains the claimant address: ${address}`);
        } else {
          console.log(`❌ ISSUE: Template does not contain the claimant address: ${address}`);
        }
        
        console.log('\n📊 Summary of key field mappings:');
        console.log(`   Name as per PAN C1: ${valueMap['Name as per PAN C1'] || 'NOT FOUND'}`);
        console.log(`   Address C1: ${valueMap['Address C1'] || 'NOT FOUND'}`);
        console.log(`   Name as per Aadhar C1: ${valueMap['Name as per Aadhar C1'] || 'NOT FOUND'}`);
        console.log(`   Father Name C1: ${valueMap['Father Name C1'] || 'NOT FOUND'}`);
        console.log(`   Age C1: ${valueMap['Age C1'] || 'NOT FOUND'}`);
        
      } catch (renderError) {
        console.error('❌ Error rendering template:', renderError.message);
      }
      
    } catch (templateError) {
      console.error('❌ Error reading template:', templateError.message);
    }
    
    console.log('\n✅ Comprehensive template mapping validation completed');
    
  } catch (error) {
    console.error('❌ Error validating template mappings:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Comprehensive Template Mapping Validation Tool`);
console.log(`${'='.repeat(60)}\n`);

validateAllTemplateMappings().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Comprehensive template mapping validation complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});
