const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/**
 * Script to analyze template field mappings and identify issues
 * Specifically looks for address mapping problems in Name Mismatch templates
 */
async function analyzeTemplateMapping(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates', templateName);
    
    console.log(`🔍 Analyzing template: ${templatePath}`);
    
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file not found: ${templatePath}`);
    }
    
    // Read the template file
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuffer);
    
    // Get the document.xml content
    const documentXml = zip.files["word/document.xml"];
    if (!documentXml) {
      throw new Error('document.xml not found in template');
    }
    
    let content = documentXml.asText();
    console.log(`✅ Loaded document.xml (${content.length} characters)`);
    
    // Analyze the template structure
    console.log(`\n📊 Template Analysis:`);
    console.log(`${'='.repeat(50)}`);
    
    // 1. Find all field placeholders
    const fieldPattern = /\[([^\]]+)\]/g;
    const fields = [];
    let match;
    while ((match = fieldPattern.exec(content)) !== null) {
      fields.push(match[1]);
    }
    
    console.log(`\n🔍 Found ${fields.length} field placeholders:`);
    fields.forEach((field, index) => {
      console.log(`  ${index + 1}. [${field}]`);
    });
    
    // 2. Look for address-related fields
    const addressFields = fields.filter(field => 
      field.toLowerCase().includes('address') || 
      field.toLowerCase().includes('addr')
    );
    
    console.log(`\n🏠 Address-related fields (${addressFields.length}):`);
    addressFields.forEach(field => {
      console.log(`  - [${field}]`);
    });
    
    // 3. Look for bank-related fields
    const bankFields = fields.filter(field => 
      field.toLowerCase().includes('bank') || 
      field.toLowerCase().includes('branch') ||
      field.toLowerCase().includes('ifsc') ||
      field.toLowerCase().includes('micr')
    );
    
    console.log(`\n🏦 Bank-related fields (${bankFields.length}):`);
    bankFields.forEach(field => {
      console.log(`  - [${field}]`);
    });
    
    // 4. Look for C1 fields specifically
    const c1Fields = fields.filter(field => field.includes('C1'));
    
    console.log(`\n📋 C1 fields (${c1Fields.length}):`);
    c1Fields.forEach(field => {
      console.log(`  - [${field}]`);
    });
    
    // 5. Check for the specific issue mentioned
    console.log(`\n🔍 Checking for specific issues:`);
    
    // Check if bank address appears in the template
    const bankAddressPattern = /Ambar Plaza.*?Ahmednagar/g;
    if (bankAddressPattern.test(content)) {
      console.log(`⚠️ Found hardcoded bank address: "Ambar Plaza Building A, ST Stand Road, Ahmednagar"`);
      console.log(`   This should be replaced with [Address C1] placeholder`);
    } else {
      console.log(`✅ No hardcoded bank address found`);
    }
    
    // Check for proper address field mapping
    const properAddressPattern = /\[Address C1\]/g;
    if (properAddressPattern.test(content)) {
      console.log(`✅ Found proper [Address C1] placeholder`);
    } else {
      console.log(`⚠️ No [Address C1] placeholder found - this might be the issue!`);
    }
    
    // 6. Look for the affidavit text pattern
    console.log(`\n📄 Analyzing affidavit text pattern:`);
    
    const affidavitPattern = /I, Mr\.\/Mrs\. \[Name as per Aadhar C1\].*?Resident of.*?Age about \[Age C1\]/g;
    const affidavitMatch = content.match(affidavitPattern);
    
    if (affidavitMatch) {
      console.log(`✅ Found affidavit text pattern:`);
      console.log(`   "${affidavitMatch[0]}"`);
      
      // Check if the address part is correct
      if (affidavitMatch[0].includes('[Address C1]')) {
        console.log(`✅ Address field is properly mapped to [Address C1]`);
      } else if (affidavitMatch[0].includes('Ambar Plaza')) {
        console.log(`⚠️ ISSUE FOUND: Bank address appears in affidavit text instead of [Address C1]`);
        console.log(`   This is the exact issue described in the screenshot!`);
      } else {
        console.log(`⚠️ Address field mapping is unclear`);
      }
    } else {
      console.log(`⚠️ No affidavit text pattern found`);
    }
    
    // 7. Look for any other problematic patterns
    console.log(`\n🔍 Checking for other potential issues:`);
    
    // Check for mixed field types
    const mixedFields = fields.filter(field => 
      (field.includes('Address') && field.includes('Bank')) ||
      (field.includes('C1') && field.includes('Bank'))
    );
    
    if (mixedFields.length > 0) {
      console.log(`⚠️ Found potentially mixed field types:`);
      mixedFields.forEach(field => {
        console.log(`   - [${field}]`);
      });
    } else {
      console.log(`✅ No mixed field types found`);
    }
    
    // 8. Summary and recommendations
    console.log(`\n📋 Summary and Recommendations:`);
    console.log(`${'='.repeat(50)}`);
    
    if (content.includes('Ambar Plaza')) {
      console.log(`❌ ISSUE CONFIRMED: Hardcoded bank address found in template`);
      console.log(`   Recommendation: Replace hardcoded address with [Address C1] placeholder`);
    }
    
    if (!content.includes('[Address C1]')) {
      console.log(`❌ ISSUE CONFIRMED: No [Address C1] placeholder found`);
      console.log(`   Recommendation: Add [Address C1] placeholder where claimant address should appear`);
    }
    
    if (c1Fields.length === 0) {
      console.log(`❌ ISSUE CONFIRMED: No C1 fields found`);
      console.log(`   Recommendation: Add proper C1 field placeholders`);
    }
    
    console.log(`\n✅ Analysis complete!`);
    
    return {
      totalFields: fields.length,
      addressFields: addressFields.length,
      bankFields: bankFields.length,
      c1Fields: c1Fields.length,
      hasHardcodedBankAddress: bankAddressPattern.test(content),
      hasProperAddressPlaceholder: properAddressPattern.test(content),
      hasAffidavitPattern: !!affidavitMatch,
      issues: []
    };
    
  } catch (error) {
    console.error(`❌ Error analyzing template:`, error.message);
    console.error(error);
    return null;
  }
}

// Get template name from command line
const templateName = process.argv[2] || 'Name Mismatch SELF Affidavit_C1_Template.docx';

console.log(`\n${'='.repeat(60)}`);
console.log(`Template Mapping Analysis Tool`);
console.log(`${'='.repeat(60)}\n`);

analyzeTemplateMapping(templateName).then((result) => {
  console.log(`\n${'='.repeat(60)}`);
  if (result) {
    console.log(`Analysis complete ✅`);
    console.log(`Total fields: ${result.totalFields}`);
    console.log(`Address fields: ${result.addressFields}`);
    console.log(`Bank fields: ${result.bankFields}`);
    console.log(`C1 fields: ${result.c1Fields}`);
    console.log(`Has hardcoded bank address: ${result.hasHardcodedBankAddress}`);
    console.log(`Has proper address placeholder: ${result.hasProperAddressPlaceholder}`);
  } else {
    console.log(`Analysis failed ❌`);
  }
  console.log(`${'='.repeat(60)}\n`);
  process.exit(result ? 0 : 1);
});

