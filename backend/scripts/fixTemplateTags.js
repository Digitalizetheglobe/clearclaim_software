const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Script to validate and fix template placeholder tags
const validateTemplate = (templatePath) => {
  try {
    console.log(`🔍 Validating template: ${templatePath}`);
    
    // Read the template file
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuffer);
    
    // Try to create docxtemplater instance to validate
    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[',
          end: ']'
        }
      });
      
      // Get all text to check for malformed tags
      const fullText = doc.getFullText();
      console.log(`📄 Template text length: ${fullText.length} characters`);
      
      // Find all placeholder tags
      const placeholderRegex = /\[([^\]]+)\]/g;
      const placeholders = [];
      let match;
      
      while ((match = placeholderRegex.exec(fullText)) !== null) {
        placeholders.push(match[1]);
      }
      
      console.log(`✅ Found ${placeholders.length} valid placeholders:`, placeholders);
      
      // Check for potential issues
      const openBrackets = (fullText.match(/\[/g) || []).length;
      const closeBrackets = (fullText.match(/\]/g) || []).length;
      
      if (openBrackets !== closeBrackets) {
        console.log(`⚠️  WARNING: Mismatched brackets! Open: ${openBrackets}, Close: ${closeBrackets}`);
        
        // Find positions of brackets for debugging
        const openPositions = [];
        const closePositions = [];
        
        for (let i = 0; i < fullText.length; i++) {
          if (fullText[i] === '[') openPositions.push(i);
          if (fullText[i] === ']') closePositions.push(i);
        }
        
        console.log(`📍 Open bracket positions:`, openPositions.slice(0, 10));
        console.log(`📍 Close bracket positions:`, closePositions.slice(0, 10));
        
        return {
          valid: false,
          error: `Mismatched brackets: ${openBrackets} open, ${closeBrackets} close`,
          placeholders,
          openBrackets,
          closeBrackets
        };
      }
      
      // Try to compile (this will catch other issues)
      try {
        doc.compile();
        console.log(`✅ Template compiles successfully`);
        return {
          valid: true,
          placeholders,
          openBrackets,
          closeBrackets
        };
      } catch (compileError) {
        console.log(`❌ Template compilation failed:`, compileError.message);
        return {
          valid: false,
          error: compileError.message,
          placeholders,
          openBrackets,
          closeBrackets
        };
      }
      
    } catch (docxError) {
      console.log(`❌ Failed to create docxtemplater instance:`, docxError.message);
      return {
        valid: false,
        error: docxError.message
      };
    }
    
  } catch (fileError) {
    console.log(`❌ Failed to read template file:`, fileError.message);
    return {
      valid: false,
      error: fileError.message
    };
  }
};

// Main function to check all templates
const checkAllTemplates = () => {
  const templatesDir = path.join(__dirname, '../templates');
  const templateFiles = fs.readdirSync(templatesDir).filter(file => file.endsWith('.docx'));
  
  console.log(`🔍 Checking ${templateFiles.length} template files...\n`);
  
  const results = [];
  
  templateFiles.forEach(file => {
    const filePath = path.join(templatesDir, file);
    const result = validateTemplate(filePath);
    
    results.push({
      file,
      ...result
    });
    
    console.log(`\n--- ${file} ---`);
    if (result.valid) {
      console.log(`✅ VALID - ${result.placeholders.length} placeholders`);
    } else {
      console.log(`❌ INVALID - ${result.error}`);
    }
  });
  
  // Summary
  console.log(`\n📊 SUMMARY:`);
  console.log(`Total files: ${templateFiles.length}`);
  console.log(`Valid files: ${results.filter(r => r.valid).length}`);
  console.log(`Invalid files: ${results.filter(r => !r.valid).length}`);
  
  if (results.filter(r => !r.valid).length > 0) {
    console.log(`\n❌ INVALID FILES:`);
    results.filter(r => !r.valid).forEach(r => {
      console.log(`- ${r.file}: ${r.error}`);
    });
  }
  
  return results;
};

// Run the check
if (require.main === module) {
  checkAllTemplates();
}

module.exports = { validateTemplate, checkAllTemplates };
