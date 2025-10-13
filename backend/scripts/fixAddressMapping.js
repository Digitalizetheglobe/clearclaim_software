  const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/**
 * Script to fix the Address C1 field mapping issue in Name Mismatch SELF Affidavit_C1_Template.docx
 * The issue: Bank address is appearing instead of claimant address in the template
 */
async function fixAddressMapping(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates', templateName);
    const backupPath = path.join(__dirname, '../templates', templateName.replace('.docx', '_ADDRESS_FIX_BACKUP.docx'));
    
    console.log(`🔍 Fixing address mapping in template: ${templatePath}`);
    
    // Create backup
    fs.copyFileSync(templatePath, backupPath);
    console.log(`✅ Backup created: ${backupPath}`);
    
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
    
    // Find and fix the problematic address mapping
    // The issue is that [Address C1] is being mapped to bank address instead of claimant address
    
    // Look for the specific pattern where bank address might be incorrectly mapped
    const problematicPatterns = [
      // Pattern 1: Direct bank address in Address C1 field
      /Ambar Plaza Building A, ST Stand Road, Ahmednagar 414001, Maharashtra/g,
      // Pattern 2: Any bank address pattern that might be in the wrong field
      /(?:Bank|Branch|IFSC).*?Address.*?C1/gi,
      // Pattern 3: Look for any hardcoded bank addresses
      /Ambar Plaza.*?Ahmednagar/g
    ];
    
    let fixesApplied = 0;
    
    // Fix Pattern 1: Replace hardcoded bank address with proper placeholder
    if (content.includes('Ambar Plaza Building A, ST Stand Road, Ahmednagar 414001, Maharashtra')) {
      console.log(`⚠️ Found hardcoded bank address in template!`);
      content = content.replace(
        /Ambar Plaza Building A, ST Stand Road, Ahmednagar 414001, Maharashtra/g,
        '[Address C1]'
      );
      fixesApplied++;
      console.log(`✅ Replaced hardcoded bank address with [Address C1] placeholder`);
    }
    
    // Fix Pattern 2: Look for any bank-related content in address fields
    const bankAddressPattern = /(?:HDFC|Bank|Branch|IFSC).*?(?:Address|C1)/gi;
    if (bankAddressPattern.test(content)) {
      console.log(`⚠️ Found bank-related content in address fields!`);
      // This is more complex - we need to be careful not to break valid bank references
      // Let's look for specific problematic patterns
    }
    
    // Fix Pattern 3: Look for any other hardcoded addresses that should be placeholders
    const hardcodedAddressPattern = /(?:Building|Road|Ahmednagar|Maharashtra).*?C1/gi;
    if (hardcodedAddressPattern.test(content)) {
      console.log(`⚠️ Found hardcoded address content in C1 field!`);
    }
    
    // Additional fix: Ensure proper field mapping structure
    // Look for the specific affidavit text pattern and fix it
    const affidavitPattern = /I, Mr\.\/Mrs\. \[Name as per Aadhar C1\] son\/wife of \[Father Name C1\] Resident of \*\*\[Address C1\]\*\*\. Age about \[Age C1\]/g;
    if (affidavitPattern.test(content)) {
      console.log(`✅ Found correct affidavit pattern - this looks properly mapped`);
    } else {
      // Look for the problematic pattern where bank address appears
      const problematicAffidavitPattern = /I, Mr\.\/Mrs\. \[Name as per Aadhar C1\] son\/wife of \[Father Name C1\] Resident of \*\*.*?Bank.*?\*\*\. Age about \[Age C1\]/g;
      if (problematicAffidavitPattern.test(content)) {
        console.log(`⚠️ Found problematic affidavit pattern with bank address!`);
        // Fix this specific pattern
        content = content.replace(
          /I, Mr\.\/Mrs\. \[Name as per Aadhar C1\] son\/wife of \[Father Name C1\] Resident of \*\*.*?Bank.*?\*\*\. Age about \[Age C1\]/g,
          'I, Mr./Mrs. [Name as per Aadhar C1] son/wife of [Father Name C1] Resident of **[Address C1]**. Age about [Age C1]'
        );
        fixesApplied++;
        console.log(`✅ Fixed affidavit pattern to use proper [Address C1] placeholder`);
      }
    }
    
    // Look for any other instances where bank address might be incorrectly placed
    const bankAddressInWrongPlace = /(?:HDFC|Bank|Station Road|IFSC|MICR).*?\[Address C1\]/gi;
    if (bankAddressInWrongPlace.test(content)) {
      console.log(`⚠️ Found bank information mixed with Address C1 field!`);
      // This suggests the field mapping is completely wrong
      // We need to separate bank fields from address fields
    }
    
    // Final check: Look for the specific issue mentioned in the screenshot
    // The issue shows "Ambar Plaza Building A, ST Stand Road, Ahmednagar" appearing where claimant address should be
    const specificIssuePattern = /Ambar Plaza.*?Ahmednagar.*?C1/gi;
    if (specificIssuePattern.test(content)) {
      console.log(`⚠️ Found the specific issue: Bank address in Address C1 field!`);
      // Replace the bank address with proper claimant address placeholder
      content = content.replace(
        /Ambar Plaza.*?Ahmednagar.*?C1/gi,
        '[Address C1]'
      );
      fixesApplied++;
      console.log(`✅ Fixed specific bank address issue in Address C1 field`);
    }
    
    // Update the document.xml in the zip
    zip.file("word/document.xml", content);
    
    // Write the fixed template
    const fixedBuffer = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync(templatePath, fixedBuffer);
    
    console.log(`\n✅ Template fixed and saved: ${templatePath}`);
    console.log(`📋 Original backup saved as: ${backupPath}`);
    console.log(`🔧 Total fixes applied: ${fixesApplied}`);
    
    if (fixesApplied === 0) {
      console.log(`\n⚠️ No specific fixes were needed. The template might already be correct or the issue is elsewhere.`);
      console.log(`💡 The issue might be in the data mapping logic rather than the template itself.`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error fixing template:`, error.message);
    console.error(error);
    return false;
  }
}

// Get template name from command line
const templateName = process.argv[2] || 'Name Mismatch SELF Affidavit_C1_Template.docx';

console.log(`\n${'='.repeat(60)}`);
console.log(`Address Mapping Fix Tool`);
console.log(`${'='.repeat(60)}\n`);

fixAddressMapping(templateName).then((success) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(success ? `Address mapping fix complete ✅` : `Address mapping fix failed ❌`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(success ? 0 : 1);
});
