const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Script to diagnose template issues
async function diagnoseTemplate(templateName) {
  try {
    const templatePath = path.join(__dirname, '../templates', templateName);
    console.log(`🔍 Diagnosing template: ${templatePath}`);
    
    // Read the template file
    const templateBuffer = fs.readFileSync(templatePath);
    console.log(`✅ Template file loaded (${templateBuffer.length} bytes)`);
    
    // Create a new zip file from the template
    const zip = new PizZip(templateBuffer);
    console.log(`✅ Template unzipped successfully`);
    
    // Try to create docxtemplater instance
    try {
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
      console.log(`✅ Docxtemplater instance created successfully`);
      
      // Extract template text
      const templateText = doc.getFullText();
      console.log(`✅ Template text extracted (${templateText.length} characters)`);
      
      // Find all placeholders
      const placeholderRegex = /\[([^\]]+)\]/g;
      const foundPlaceholders = [];
      let match;
      while ((match = placeholderRegex.exec(templateText)) !== null) {
        foundPlaceholders.push(match[1]);
      }
      
      const uniquePlaceholders = [...new Set(foundPlaceholders)];
      console.log(`\n📋 Found ${foundPlaceholders.length} placeholder instances (${uniquePlaceholders.length} unique)`);
      console.log(`\nUnique placeholders:`);
      uniquePlaceholders.forEach(p => console.log(`  - [${p}]`));
      
      // Check for bracket mismatches
      const openBrackets = (templateText.match(/\[/g) || []).length;
      const closeBrackets = (templateText.match(/\]/g) || []).length;
      console.log(`\n🔍 Bracket analysis:`);
      console.log(`  Open brackets: ${openBrackets}`);
      console.log(`  Close brackets: ${closeBrackets}`);
      
      if (openBrackets !== closeBrackets) {
        console.error(`❌ ERROR: Mismatched brackets! This will cause rendering errors.`);
        
        // Try to find unclosed brackets
        console.log(`\n🔎 Searching for unclosed brackets...`);
        const lines = templateText.split('\n');
        lines.forEach((line, idx) => {
          const lineOpen = (line.match(/\[/g) || []).length;
          const lineClose = (line.match(/\]/g) || []).length;
          if (lineOpen !== lineClose) {
            console.log(`  Line ${idx + 1}: Open=${lineOpen}, Close=${lineClose}`);
            console.log(`    "${line.substring(0, 100)}..."`);
          }
        });
      } else {
        console.log(`✅ Brackets are balanced`);
      }
      
      // Check for nested brackets (not supported by default)
      const nestedPattern = /\[[^\]]*\[[^\]]*\]/g;
      const nestedMatches = templateText.match(nestedPattern);
      if (nestedMatches && nestedMatches.length > 0) {
        console.log(`\n⚠️ WARNING: Found nested brackets (may cause issues):`);
        nestedMatches.forEach(m => console.log(`  ${m}`));
      }
      
      // Try to render with empty data to see what errors occur
      console.log(`\n🧪 Attempting test render with empty data...`);
      const testData = {};
      uniquePlaceholders.forEach(p => {
        testData[p] = 'TEST_VALUE';
      });
      
      doc.setData(testData);
      
      try {
        doc.render();
        console.log(`✅ Test render successful!`);
      } catch (renderError) {
        console.error(`❌ Render error:`, renderError.message);
        
        if (renderError.properties && renderError.properties.errors) {
          console.log(`\n📋 Detailed errors:`);
          renderError.properties.errors.forEach((err, idx) => {
            console.log(`\nError ${idx + 1}:`);
            console.log(`  Name: ${err.name}`);
            console.log(`  Message: ${err.message}`);
            if (err.properties) {
              console.log(`  Details:`, JSON.stringify(err.properties, null, 2));
            }
          });
        }
      }
      
    } catch (docError) {
      console.error(`❌ Error creating Docxtemplater instance:`, docError.message);
      console.error(docError);
    }
    
  } catch (error) {
    console.error(`❌ Fatal error:`, error.message);
    console.error(error);
  }
}

// Get template name from command line arguments
const templateName = process.argv[2] || 'SH-13_Template.docx';

console.log(`\n${'='.repeat(60)}`);
console.log(`Template Diagnosis Tool`);
console.log(`${'='.repeat(60)}\n`);

diagnoseTemplate(templateName).then(() => {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Diagnosis complete`);
  console.log(`${'='.repeat(60)}\n`);
});

