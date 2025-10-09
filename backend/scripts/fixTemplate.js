const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

/**
 * Script to fix the SH-13 template by finding and removing stray brackets
 */
async function fixTemplate(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates', templateName);
    const backupPath = path.join(__dirname, '../templates', templateName.replace('.docx', '_BACKUP.docx'));
    
    console.log(`🔍 Fixing template: ${templatePath}`);
    
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
    
    // Find the problematic text
    const problematicPattern = /Rules 2014\]/g;
    if (content.match(problematicPattern)) {
      console.log(`⚠️ Found "Rules 2014]" - this is the issue!`);
      
      // Fix by removing the stray bracket
      content = content.replace(/Rules 2014\]/g, 'Rules 2014');
      console.log(`✅ Removed stray bracket from "Rules 2014]"`);
    }
    
    // Look for any other unmatched brackets
    // Find all opening and closing brackets
    const openingBrackets = [];
    const closingBrackets = [];
    
    for (let i = 0; i < content.length; i++) {
      if (content[i] === '[') {
        openingBrackets.push(i);
      } else if (content[i] === ']') {
        closingBrackets.push(i);
      }
    }
    
    console.log(`\n📊 Bracket analysis:`);
    console.log(`  Opening brackets: ${openingBrackets.length}`);
    console.log(`  Closing brackets: ${closingBrackets.length}`);
    
    if (openingBrackets.length !== closingBrackets.length) {
      console.log(`⚠️ Mismatched brackets detected!`);
      
      // Find orphaned closing brackets
      const orphanedClosing = [];
      let openCount = 0;
      
      for (let i = 0; i < content.length; i++) {
        if (content[i] === '[') {
          openCount++;
        } else if (content[i] === ']') {
          if (openCount === 0) {
            orphanedClosing.push(i);
          } else {
            openCount--;
          }
        }
      }
      
      if (orphanedClosing.length > 0) {
        console.log(`\n🔧 Found ${orphanedClosing.length} orphaned closing brackets`);
        
        // Show context around each orphaned bracket
        orphanedClosing.forEach((pos, idx) => {
          const start = Math.max(0, pos - 50);
          const end = Math.min(content.length, pos + 50);
          const context = content.substring(start, end);
          console.log(`\nOrphaned bracket ${idx + 1} at position ${pos}:`);
          console.log(`  "${context}"`);
          console.log(`  ${' '.repeat(pos - start)}^`);
        });
        
        // Remove orphaned closing brackets by replacing them with a special character
        // that won't interfere with template processing
        let fixedContent = content;
        let offset = 0;
        
        orphanedClosing.forEach(pos => {
          const actualPos = pos + offset;
          // Check context - if it's not part of a valid placeholder, remove it
          const before = fixedContent.substring(Math.max(0, actualPos - 30), actualPos);
          const after = fixedContent.substring(actualPos + 1, Math.min(fixedContent.length, actualPos + 30));
          
          // If the bracket is not part of a placeholder pattern, remove it
          if (!before.includes('[')) {
            console.log(`🔧 Removing orphaned ] at position ${pos}`);
            fixedContent = fixedContent.substring(0, actualPos) + fixedContent.substring(actualPos + 1);
            offset--;
          }
        });
        
        content = fixedContent;
      }
      
      // Find orphaned opening brackets
      const orphanedOpening = [];
      let closeCount = 0;
      
      for (let i = content.length - 1; i >= 0; i--) {
        if (content[i] === ']') {
          closeCount++;
        } else if (content[i] === '[') {
          if (closeCount === 0) {
            orphanedOpening.push(i);
          } else {
            closeCount--;
          }
        }
      }
      
      if (orphanedOpening.length > 0) {
        console.log(`\n🔧 Found ${orphanedOpening.length} orphaned opening brackets`);
        
        // Show context
        orphanedOpening.forEach((pos, idx) => {
          const start = Math.max(0, pos - 50);
          const end = Math.min(content.length, pos + 50);
          const context = content.substring(start, end);
          console.log(`\nOrphaned bracket ${idx + 1} at position ${pos}:`);
          console.log(`  "${context}"`);
          console.log(`  ${' '.repeat(pos - start)}^`);
        });
      }
    } else {
      console.log(`✅ Brackets are balanced`);
    }
    
    // Update the document.xml in the zip
    zip.file("word/document.xml", content);
    
    // Write the fixed template
    const fixedBuffer = zip.generate({ type: 'nodebuffer' });
    fs.writeFileSync(templatePath, fixedBuffer);
    
    console.log(`\n✅ Template fixed and saved: ${templatePath}`);
    console.log(`📋 Original backup saved as: ${backupPath}`);
    
    return true;
    
  } catch (error) {
    console.error(`❌ Error fixing template:`, error.message);
    console.error(error);
    return false;
  }
}

// Get template name from command line
const templateName = process.argv[2] || 'SH-13_Template.docx';

console.log(`\n${'='.repeat(60)}`);
console.log(`Template Fix Tool`);
console.log(`${'='.repeat(60)}\n`);

fixTemplate(templateName).then((success) => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(success ? `Fix complete ✅` : `Fix failed ❌`);
  console.log(`${'='.repeat(60)}\n`);
  process.exit(success ? 0 : 1);
});

