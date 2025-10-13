const models = require('../src/models');
const { sequelize } = require('../src/config/database');

const CompanyValue = models.CompanyValue;
const Company = models.Company;

/**
 * Script to fix the specific address mapping issue where bank address appears in claimant address field
 * This script will:
 * 1. Find any instances where Address C1 contains bank address
 * 2. Fix the mapping to use the correct claimant address
 * 3. Ensure proper separation between claimant and bank addresses
 */
async function fixAddressMappingIssue() {
  try {
    console.log('🔧 Starting address mapping issue fix...');
    
    // Get all companies
    const companies = await Company.findAll();
    console.log(`Found ${companies.length} companies`);
    
    let totalFixed = 0;
    
    for (const company of companies) {
      console.log(`\n📋 Processing company: ${company.company_name} (ID: ${company.id})`);
      
      // Get company values
      const companyValues = await CompanyValue.findAll({
        where: { company_id: company.id }
      });
      
      console.log(`📊 Found ${companyValues.length} company values`);
      
      // Check for the specific issue: Address C1 containing bank address
      const problematicAddressC1 = companyValues.find(cv => 
        cv.field_key === 'Address C1' && 
        cv.field_value && 
        (cv.field_value.includes('Ambar Plaza') ||
         cv.field_value.includes('HDFC') ||
         cv.field_value.includes('Bank') ||
         cv.field_value.includes('IFSC') ||
         cv.field_value.includes('Branch') ||
         cv.field_value.includes('Station Road'))
      );
      
      if (problematicAddressC1) {
        console.log(`🚨 FOUND ISSUE: Address C1 contains bank address!`);
        console.log(`   Company: ${company.company_name}`);
        console.log(`   Field: ${problematicAddressC1.field_key}`);
        console.log(`   Current Value: ${problematicAddressC1.field_value}`);
        
        // Try to find the correct claimant address
        const correctClaimantAddress = companyValues.find(cv => 
          cv.field_key === 'Address C1' && 
          cv.field_value && 
          !cv.field_value.includes('Ambar Plaza') &&
          !cv.field_value.includes('HDFC') &&
          !cv.field_value.includes('Bank') &&
          !cv.field_value.includes('IFSC') &&
          !cv.field_value.includes('Branch') &&
          !cv.field_value.includes('Station Road') &&
          cv.id !== problematicAddressC1.id // Different record
        );
        
        if (correctClaimantAddress) {
          console.log(`✅ Found correct claimant address: ${correctClaimantAddress.field_value}`);
          
          // Update the problematic record with the correct address
          await CompanyValue.update(
            { field_value: correctClaimantAddress.field_value },
            { where: { id: problematicAddressC1.id } }
          );
          
          console.log(`✅ Fixed Address C1 for company ${company.company_name}`);
          totalFixed++;
        } else {
          console.log(`❌ No correct claimant address found, setting to empty`);
          
          // Set to empty if no correct address found
          await CompanyValue.update(
            { field_value: '' },
            { where: { id: problematicAddressC1.id } }
          );
          
          console.log(`✅ Set Address C1 to empty for company ${company.company_name}`);
          totalFixed++;
        }
      } else {
        console.log(`✅ Address C1 looks correct for company ${company.company_name}`);
      }
      
      // Also check for any other address fields that might have similar issues
      const allAddressFields = companyValues.filter(cv => 
        cv.field_key && 
        cv.field_key.toLowerCase().includes('address') &&
        !cv.field_key.toLowerCase().includes('bank address')
      );
      
      for (const addressField of allAddressFields) {
        if (addressField.field_value && (
          addressField.field_value.includes('Ambar Plaza') ||
          addressField.field_value.includes('HDFC') ||
          addressField.field_value.includes('Bank') ||
          addressField.field_value.includes('IFSC') ||
          addressField.field_value.includes('Branch') ||
          addressField.field_value.includes('Station Road')
        )) {
          console.log(`⚠️ Found bank address in non-bank address field: ${addressField.field_key}`);
          console.log(`   Value: ${addressField.field_value}`);
          
          // Try to find a correct address for this field
          const correctAddress = companyValues.find(cv => 
            cv.field_key === addressField.field_key && 
            cv.field_value && 
            !cv.field_value.includes('Ambar Plaza') &&
            !cv.field_value.includes('HDFC') &&
            !cv.field_value.includes('Bank') &&
            !cv.field_value.includes('IFSC') &&
            !cv.field_value.includes('Branch') &&
            !cv.field_value.includes('Station Road') &&
            cv.id !== addressField.id
          );
          
          if (correctAddress) {
            console.log(`✅ Found correct address: ${correctAddress.field_value}`);
            
            await CompanyValue.update(
              { field_value: correctAddress.field_value },
              { where: { id: addressField.id } }
            );
            
            console.log(`✅ Fixed ${addressField.field_key} for company ${company.company_name}`);
            totalFixed++;
          } else {
            console.log(`❌ No correct address found, setting to empty`);
            
            await CompanyValue.update(
              { field_value: '' },
              { where: { id: addressField.id } }
            );
            
            console.log(`✅ Set ${addressField.field_key} to empty for company ${company.company_name}`);
            totalFixed++;
          }
        }
      }
    }
    
    console.log(`\n✅ Address mapping issue fix completed!`);
    console.log(`🔧 Total records fixed: ${totalFixed}`);
    
  } catch (error) {
    console.error('❌ Error fixing address mapping issue:', error);
  } finally {
    await sequelize.close();
  }
}

console.log(`\n${'='.repeat(60)}`);
console.log(`Address Mapping Issue Fix Tool`);
console.log(`${'='.repeat(60)}\n`);

fixAddressMappingIssue().then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Address mapping issue fix complete ✅`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(0);
});

