const models = require('../src/models');
const { sequelize } = require('../src/config/database');

const CompanyValue = models.CompanyValue;
const Company = models.Company;

/**
 * Script to check the PAN field mapping issue
 * This script will check what data is available for the [Name as per PAN C1] field
 */
async function checkPanFieldMapping() {
  try {
    console.log('🔍 Checking PAN field mapping issue...');
    
    // Get all companies
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    for (const company of companies) {
      console.log(`\n📋 Checking company: ${company.company_name} (ID: ${company.id})`);
      
      const companyValues = await CompanyValue.findAll({
        where: { company_id: company.id }
      });
      
      console.log(`📊 Found ${companyValues.length} company values`);
      
      // Check for PAN-related fields
      const panFields = companyValues.filter(cv => 
        cv.field_key && 
        (cv.field_key.toLowerCase().includes('pan') || 
         cv.field_key.toLowerCase().includes('name as per pan'))
      );
      
      console.log(`🔍 Found ${panFields.length} PAN-related fields:`);
      panFields.forEach(cv => {
        console.log(`  - ${cv.field_key}: ${cv.field_value}`);
      });
      
      // Check specifically for "Name as per PAN C1" field
      const nameAsPerPanC1 = companyValues.find(cv => cv.field_key === 'Name as per PAN C1');
      if (nameAsPerPanC1) {
        console.log(`✅ Found "Name as per PAN C1" field: ${nameAsPerPanC1.field_value}`);
      } else {
        console.log(`❌ "Name as per PAN C1" field not found`);
        
        // Check for alternative field names
        const alternativeFields = companyValues.filter(cv => 
          cv.field_key && 
          (cv.field_key.toLowerCase().includes('name') && 
           cv.field_key.toLowerCase().includes('pan') &&
           cv.field_key.toLowerCase().includes('c1'))
        );
        
        if (alternativeFields.length > 0) {
          console.log(`🔍 Found alternative PAN name fields:`);
          alternativeFields.forEach(cv => {
            console.log(`  - ${cv.field_key}: ${cv.field_value}`);
          });
        }
      }
      
      // Check for regular PAN field
      const panC1 = companyValues.find(cv => cv.field_key === 'PAN C1');
      if (panC1) {
        console.log(`✅ Found "PAN C1" field: ${panC1.field_value}`);
      } else {
        console.log(`❌ "PAN C1" field not found`);
      }
      
      // Check for any field that might contain the PAN name
      const nameFields = companyValues.filter(cv => 
        cv.field_key && 
        cv.field_key.toLowerCase().includes('name') &&
        cv.field_key.toLowerCase().includes('c1')
      );
      
      console.log(`🔍 All name fields for C1:`);
      nameFields.forEach(cv => {
        console.log(`  - ${cv.field_key}: ${cv.field_value}`);
      });
    }
    
    console.log('\n✅ PAN field mapping check completed');
    
  } catch (error) {
    console.error('❌ Error checking PAN field mapping:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`PAN Field Mapping Check Tool`);
console.log(`${'='.repeat(60)}\n`);

checkPanFieldMapping().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`PAN field mapping check complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});
