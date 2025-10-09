const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/**
 * Script to convert instruction placeholders to static text
 */
async function cleanInstructions(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates', templateName);
    
    console.log(`🔍 Cleaning instructions in: ${templatePath}`);
    
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
    
    // Define instruction patterns that should be converted to static text
    const instructionPatterns = [
      {
        pattern: /\[Use photocopies of this blank nomination form in case of additional Multiple Nominations in the same folio\]/g,
        replacement: 'Use photocopies of this blank nomination form in case of additional Multiple Nominations in the same folio'
      },
      {
        pattern: /\[Please follow the instructions given below very carefully while filling in your Nomination request\.\]/g,
        replacement: 'Please follow the instructions given below very carefully while filling in your Nomination request.'
      }
    ];
    
    let changesMade = 0;
    
    instructionPatterns.forEach(({ pattern, replacement }) => {
      const matches = content.match(pattern);
      if (matches && matches.length > 0) {
        console.log(`✅ Found ${matches.length} instance(s) of instruction placeholder`);
        content = content.replace(pattern, replacement);
        changesMade += matches.length;
      }
    });
    
    if (changesMade > 0) {
      // Update the document.xml in the zip
      zip.file("word/document.xml", content);
      
      // Write the fixed template
      const fixedBuffer = zip.generate({ type: 'nodebuffer' });
      fs.writeFileSync(templatePath, fixedBuffer);
      
      console.log(`\n✅ Template cleaned: ${changesMade} instruction(s) converted to static text`);
      console.log(`📋 Template saved: ${templatePath}`);
    } else {
      console.log(`\nℹ️ No instruction placeholders found - template is already clean`);
    }
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error cleaning template:`, error.message);
    console.error(error);
    return false;
  }
}

// Get template name from command line
const templateName = process.argv[2] || 'SH-13_Template.docx';

console.log(`\n${'='.repeat(60)}`);
console.log(`Template Instruction Cleaner`);
console.log(`${'='.repeat(60)}\n`);

cleanInstructions(templateName).then((success) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(success ? `Cleaning complete ✅` : `Cleaning failed ❌`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(success ? 0 : 1);
});

