const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Script to fix the SH-13 template placeholder issues
const fixSH13Template = () => {
  const templatePath = path.join(__dirname, '../templates/SH-13_Template.docx');
  const backupPath = path.join(__dirname, '../templates/SH-13_Template_backup.docx');
  
  try {
    console.log('🔧 Fixing SH-13 Template...');
    
    // Create backup
    if (!fs.existsSync(backupPath)) {
      fs.copyFileSync(templatePath, backupPath);
      console.log('✅ Created backup: SH-13_Template_backup.docx');
    }
    
    // Read the template
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuffer);
    
    // Get the document.xml content
    const doc = zip.file("word/document.xml");
    if (!doc) {
      throw new Error('Could not find word/document.xml in template');
    }
    
    let xmlContent = doc.asText();
    console.log('📄 Original XML length:', xmlContent.length);
    
    // Fix common placeholder issues
    
    // 1. Fix unopened tags - look for stray closing brackets
    // The error shows "2014" as an unopened tag, which suggests there's a stray ]2014] or similar
    console.log('🔧 Fixing unopened tag issues...');
    
    // Find and fix patterns like "]2014]" or similar malformed tags
    xmlContent = xmlContent.replace(/\]2014\]/g, ']'); // Remove stray ]2014]
    xmlContent = xmlContent.replace(/\]2014/g, ''); // Remove stray ]2014
    
    // Fix other common issues
    xmlContent = xmlContent.replace(/\]\s*\]/g, ']'); // Remove double closing brackets
    xmlContent = xmlContent.replace(/\[\s*\[/g, '['); // Remove double opening brackets
    
    // Fix specific SH-13 context issues
    // The error context shows: "Form No. SH-13Nomination FormPursuant to section 72..."
    // This suggests there might be missing brackets around "2014"
    xmlContent = xmlContent.replace(/2014 and rule/g, '[2014] and rule');
    xmlContent = xmlContent.replace(/Companies Act, 2013 and rule/g, 'Companies Act, [2013] and rule');
    
    // Fix any other year references that might be missing brackets
    xmlContent = xmlContent.replace(/(\d{4}) and rule/g, '[$1] and rule');
    xmlContent = xmlContent.replace(/Act, (\d{4})/g, 'Act, [$1]');
    
    // Write the fixed XML back
    zip.file("word/document.xml", xmlContent);
    
    // Test the fixed template
    try {
      const testDoc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[',
          end: ']'
        }
      });
      
      // Try to compile
      testDoc.compile();
      console.log('✅ Fixed template compiles successfully!');
      
      // Get placeholders to verify
      const fullText = testDoc.getFullText();
      const placeholderRegex = /\[([^\]]+)\]/g;
      const placeholders = [];
      let match;
      
      while ((match = placeholderRegex.exec(fullText)) !== null) {
        placeholders.push(match[1]);
      }
      
      console.log(`📋 Found ${placeholders.length} placeholders:`, placeholders);
      
      // Save the fixed template
      const fixedBuffer = zip.generate({ type: 'nodebuffer' });
      fs.writeFileSync(templatePath, fixedBuffer);
      console.log('✅ Fixed template saved successfully!');
      
      return {
        success: true,
        placeholders,
        message: 'SH-13 Template fixed successfully'
      };
      
    } catch (testError) {
      console.log('❌ Fixed template still has issues:', testError.message);
      
      // Try more aggressive fixes
      console.log('🔧 Applying more aggressive fixes...');
      
      // More aggressive bracket fixing
      xmlContent = xmlContent.replace(/([^\[])\]([^\]])/g, '$1$2'); // Remove isolated brackets
      xmlContent = xmlContent.replace(/\[([^\]]*)$/gm, ''); // Remove unclosed opening brackets at line ends
      xmlContent = xmlContent.replace(/^([^\[]*)\]/gm, '$1'); // Remove unopened closing brackets at line starts
      
      // Try again
      zip.file("word/document.xml", xmlContent);
      
      try {
        const testDoc2 = new Docxtemplater(zip, {
          paragraphLoop: true,
          linebreaks: true,
          delimiters: {
            start: '[',
            end: ']'
          }
        });
        
        testDoc2.compile();
        console.log('✅ Aggressively fixed template compiles successfully!');
        
        // Save the aggressively fixed template
        const fixedBuffer2 = zip.generate({ type: 'nodebuffer' });
        fs.writeFileSync(templatePath, fixedBuffer2);
        console.log('✅ Aggressively fixed template saved successfully!');
        
        return {
          success: true,
          message: 'SH-13 Template fixed with aggressive corrections'
        };
        
      } catch (aggressiveError) {
        console.log('❌ Even aggressive fixes failed:', aggressiveError.message);
        
        // Restore from backup
        if (fs.existsSync(backupPath)) {
          fs.copyFileSync(backupPath, templatePath);
          console.log('🔄 Restored original template from backup');
        }
        
        return {
          success: false,
          error: aggressiveError.message,
          message: 'Could not fix SH-13 Template automatically'
        };
      }
    }
    
  } catch (error) {
    console.log('❌ Error fixing SH-13 template:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run the fix
if (require.main === module) {
  const result = fixSH13Template();
  console.log('\n📊 RESULT:', result);
}

module.exports = { fixSH13Template };
