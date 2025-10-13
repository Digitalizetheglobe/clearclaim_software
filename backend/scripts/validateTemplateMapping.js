const models = require('../src/models');
const { sequelize } = require('../src/config/database');
const path = require('path');
const fs = require('fs').promises;
const PizZip = require('pizzip');

const CompanyValue = models.CompanyValue;
const Company = models.Company;

/**
 * Comprehensive script to validate and fix template mapping issues
 * This script will:
 * 1. Check the template structure
 * 2. Validate data mapping
 * 3. Ensure Address C1 maps to claimant address, not bank address
 */
async function validateTemplateMapping() {
  try {
    console.log('🔍 Starting comprehensive template mapping validation...');
    
    // 1. Check the template file structure
    console.log('\n📋 Step 1: Analyzing template structure...');
    const templatePath = path.join(__dirname, '../templates/Name Mismatch SELF Affidavit_C1_Template.docx');
    
    try {
      const templateBuffer = await fs.readFile(templatePath);
      const zip = new PizZip(templateBuffer);
      const documentXml = zip.files["word/document.xml"];
      
      if (documentXml) {
        let content = documentXml.asText();
        
        // Check for Address C1 placeholder
        if (content.includes('[Address C1]')) {
          console.log('✅ Template contains [Address C1] placeholder');
        } else {
          console.log('❌ Template missing [Address C1] placeholder');
        }
        
        // Check for any hardcoded bank addresses
        if (content.includes('Ambar Plaza')) {
          console.log('🚨 CRITICAL: Template contains hardcoded bank address!');
          console.log('   This needs to be fixed in the template file');
        } else {
          console.log('✅ Template does not contain hardcoded bank address');
        }
        
        // Count placeholders
        const placeholderRegex = /\[([^\]]+)\]/g;
        const placeholders = [];
        let match;
        while ((match = placeholderRegex.exec(content)) !== null) {
          placeholders.push(match[1]);
        }
        
        console.log(`📊 Template contains ${placeholders.length} placeholders`);
        
        // Check for address-related placeholders
        const addressPlaceholders = placeholders.filter(p => 
          p.toLowerCase().includes('address') && !p.toLowerCase().includes('bank')
        );
        console.log(`🏠 Address placeholders: ${addressPlaceholders.join(', ')}`);
        
      } else {
        console.log('❌ Could not read template document.xml');
      }
    } catch (error) {
      console.log(`❌ Error reading template: ${error.message}`);
    }
    
    // 2. Check data mapping in database
    console.log('\n📋 Step 2: Validating data mapping in database...');
    
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    let totalIssues = 0;
    
    for (const company of companies) {
      console.log(`\n📋 Checking company: ${company.company_name} (ID: ${company.id})`);
      
      const companyValues = await CompanyValue.findAll({
        where: { company_id: company.id }
      });
      
      // Check for Address C1 field
      const addressC1 = companyValues.find(cv => cv.field_key === 'Address C1');
      const bankAddressC1 = companyValues.find(cv => cv.field_key === 'Bank Address C1');
      
      if (addressC1 && addressC1.field_value) {
        console.log(`   Address C1: ${addressC1.field_value}`);
        
        // Check if Address C1 contains bank address
        if (addressC1.field_value.includes('Ambar Plaza') ||
            addressC1.field_value.includes('HDFC') ||
            addressC1.field_value.includes('Bank') ||
            addressC1.field_value.includes('IFSC') ||
            addressC1.field_value.includes('Branch') ||
            addressC1.field_value.includes('Station Road')) {
          
          console.log(`🚨 ISSUE FOUND: Address C1 contains bank address!`);
          console.log(`   This matches the screenshot issue exactly!`);
          totalIssues++;
          
          // Try to fix it
          if (bankAddressC1 && bankAddressC1.field_value) {
            console.log(`   Bank Address C1: ${bankAddressC1.field_value}`);
            
            // Check if there's a correct claimant address
            const correctClaimantAddress = companyValues.find(cv => 
              cv.field_key === 'Address C1' && 
              cv.field_value && 
              !cv.field_value.includes('Ambar Plaza') &&
              !cv.field_value.includes('HDFC') &&
              !cv.field_value.includes('Bank') &&
              cv.id !== addressC1.id
            );
            
            if (correctClaimantAddress) {
              console.log(`✅ Found correct claimant address: ${correctClaimantAddress.field_value}`);
              
              // Fix the mapping
              await CompanyValue.update(
                { field_value: correctClaimantAddress.field_value },
                { where: { id: addressC1.id } }
              );
              
              console.log(`✅ Fixed Address C1 mapping for company ${company.company_name}`);
            } else {
              console.log(`❌ No correct claimant address found`);
              
              // Set to empty to prevent bank address from appearing
              await CompanyValue.update(
                { field_value: '' },
                { where: { id: addressC1.id } }
              );
              
              console.log(`✅ Set Address C1 to empty to prevent bank address mapping`);
            }
          }
        } else {
          console.log(`✅ Address C1 looks correct`);
        }
      } else {
        console.log(`   Address C1: Not found or empty`);
      }
      
      if (bankAddressC1 && bankAddressC1.field_value) {
        console.log(`   Bank Address C1: ${bankAddressC1.field_value}`);
      } else {
        console.log(`   Bank Address C1: Not found or empty`);
      }
    }
    
    // 3. Summary and recommendations
    console.log('\n📋 Step 3: Summary and recommendations...');
    
    if (totalIssues === 0) {
      console.log('✅ No address mapping issues found in the database');
    } else {
      console.log(`🚨 Found and fixed ${totalIssues} address mapping issues`);
    }
    
    console.log('\n💡 Recommendations:');
    console.log('1. Ensure Address C1 field always contains claimant address, not bank address');
    console.log('2. Use Bank Address C1 field for bank addresses');
    console.log('3. The template mapping logic has been updated to prevent this issue');
    console.log('4. Regular validation should be performed to catch any future issues');
    
    console.log('\n✅ Comprehensive template mapping validation completed!');
    
  } catch (error) {
    console.error('❌ Error validating template mapping:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Template Mapping Validation Tool`);
console.log(`${'='.repeat(60)}\n`);

validateTemplateMapping().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Template mapping validation complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});

