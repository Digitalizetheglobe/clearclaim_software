const models = require('../src/models');
const { sequelize } = require('../src/config/database');

const CompanyValue = models.CompanyValue;
const CaseField = models.CaseField;
const Company = models.Company;

/**
 * Script to test and validate the address mapping fix
 * This script will check if the Address C1 field is correctly mapped to claimant address
 * and not to bank address
 */
async function testAddressMapping() {
  try {
    console.log('🔍 Testing address mapping fix...');
    
    // Get all companies
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    for (const company of companies) {
      console.log(`\n📋 Testing company: ${company.company_name} (ID: ${company.id})`);
      
      // Get company values
      const companyValues = await CompanyValue.findAll({
        where: { company_id: company.id }
      });
      
      console.log(`📊 Found ${companyValues.length} company values`);
      
      // Check for address fields
      const addressFields = companyValues.filter(cv => 
        cv.field_key && 
        cv.field_key.toLowerCase().includes('address')
      );
      
      console.log(`🏠 Found ${addressFields.length} address fields:`);
      
      addressFields.forEach(cv => {
        const fieldKey = cv.field_key;
        const fieldValue = cv.field_value;
        
        console.log(`  - ${fieldKey}: ${fieldValue}`);
        
        // Check if this is the problematic mapping
        if (fieldKey.includes('Address C1') && !fieldKey.includes('Bank Address')) {
          // This should be claimant address, not bank address
          if (fieldValue && (
            fieldValue.includes('HDFC') || 
            fieldValue.includes('Bank') || 
            fieldValue.includes('IFSC') || 
            fieldValue.includes('Branch') ||
            fieldValue.includes('Ambar Plaza') ||
            fieldValue.includes('Station Road')
          )) {
            console.log(`🚨 ISSUE FOUND: Bank address in claimant address field!`);
            console.log(`   Field: ${fieldKey}`);
            console.log(`   Value: ${fieldValue}`);
            console.log(`   This is the exact issue described in the screenshot!`);
          } else {
            console.log(`✅ Address C1 field looks correct: ${fieldValue}`);
          }
        }
        
        // Check for bank address fields
        if (fieldKey.includes('Bank Address')) {
          console.log(`🏦 Bank Address field: ${fieldKey} = ${fieldValue}`);
        }
      });
      
      // Check for the specific issue mentioned in the screenshot
      const problematicAddress = companyValues.find(cv => 
        cv.field_key === 'Address C1' && 
        cv.field_value && 
        cv.field_value.includes('Ambar Plaza')
      );
      
      if (problematicAddress) {
        console.log(`🚨 CRITICAL ISSUE CONFIRMED: Address C1 contains bank address!`);
        console.log(`   This matches the screenshot issue exactly!`);
        console.log(`   Field: ${problematicAddress.field_key}`);
        console.log(`   Value: ${problematicAddress.field_value}`);
        
        // Try to find the correct claimant address
        const correctClaimantAddress = companyValues.find(cv => 
          cv.field_key === 'Address C1' && 
          cv.field_value && 
          !cv.field_value.includes('Ambar Plaza') &&
          !cv.field_value.includes('HDFC') &&
          !cv.field_value.includes('Bank')
        );
        
        if (correctClaimantAddress) {
          console.log(`✅ Found correct claimant address: ${correctClaimantAddress.field_value}`);
        } else {
          console.log(`❌ No correct claimant address found`);
        }
      }
    }
    
    console.log('\n✅ Address mapping test completed');
    
  } catch (error) {
    console.error('❌ Error testing address mapping:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Address Mapping Test Tool`);
console.log(`${'='.repeat(60)}\n`);

testAddressMapping().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Address mapping test complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});
