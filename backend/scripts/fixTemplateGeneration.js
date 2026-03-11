const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

// Script to create a proper SH-13 template with valid structure
const createProperSH13Template = () => {
  const templatePath = path.join(__dirname, '../templates/SH-13_Template.docx');
  const originalPath = path.join(__dirname, '../templates/SH-13_Template_original.docx');
  
  try {
    console.log('🔧 Creating proper SH-13 Template...');
    
    // Check if we have an original backup
    if (fs.existsSync(originalPath)) {
      console.log('📁 Using original template as base');
      fs.copyFileSync(originalPath, templatePath);
    } else {
      console.log('⚠️ No original template found, creating a minimal valid template');
      
      // Create a minimal valid DOCX template
      const zip = new PizZip();
      
      // Basic DOCX structure files
      const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
      
      const rels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;
      
      const wordRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
      
      // Document content with proper SH-13 structure and some sample placeholders
      const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="200" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="24"/>
        </w:rPr>
        <w:t>Form No. SH-13</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:jc w:val="center"/>
        <w:spacing w:before="100" w:after="300"/>
      </w:pPr>
      <w:r>
        <w:rPr>
          <w:b/>
          <w:sz w:val="20"/>
        </w:rPr>
        <w:t>Nomination Form</w:t>
      </w:r>
    </w:p>
    <w:p>
      <w:pPr>
        <w:spacing w:before="100" w:after="300"/>
      </w:pPr>
      <w:r>
        <w:t>Pursuant to section 72 of the Companies Act, [2013] and rule 19(1) of the Companies (Share Capital and Debentures) Rules [2014]</w:t>
      </w:r>
    </w:p>
    
    <w:tbl>
      <w:tblPr>
        <w:tblW w:w="0" w:type="auto"/>
        <w:tblBorders>
          <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
          <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
        </w:tblBorders>
      </w:tblPr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="3000" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:t>Company Name:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:t>[Company Name]</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
      <w:tr>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="3000" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:t>Folio No:</w:t>
            </w:r>
          </w:p>
        </w:tc>
        <w:tc>
          <w:tcPr>
            <w:tcW w:w="5000" w:type="dxa"/>
            <w:tcBorders>
              <w:top w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:left w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:bottom w:val="single" w:sz="4" w:space="0" w:color="000000"/>
              <w:right w:val="single" w:sz="4" w:space="0" w:color="000000"/>
            </w:tcBorders>
          </w:tcPr>
          <w:p>
            <w:r>
              <w:t>[Folio No]</w:t>
            </w:r>
          </w:p>
        </w:tc>
      </w:tr>
    </w:tbl>
    
    <w:p>
      <w:pPr>
        <w:spacing w:before="400" w:after="200"/>
      </w:pPr>
      <w:r>
        <w:t>This is a properly formatted SH-13 nomination form template.</w:t>
      </w:r>
    </w:p>
  </w:body>
</w:document>`;
      
      // Add files to zip
      zip.file('[Content_Types].xml', contentTypes);
      zip.file('_rels/.rels', rels);
      zip.file('word/_rels/document.xml.rels', wordRels);
      zip.file('word/document.xml', document);
      
      // Generate buffer
      const buffer = zip.generate({ type: 'nodebuffer' });
      fs.writeFileSync(templatePath, buffer);
      console.log('✅ Created minimal valid SH-13 template');
    }
    
    // Test the template
    const templateBuffer = fs.readFileSync(templatePath);
    const zip = new PizZip(templateBuffer);
    
    try {
      const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
          start: '[',
          end: ']'
        }
      });
      
      // Test compilation
      doc.compile();
      
      // Test with sample data
      doc.setData({
        'Company Name': 'Test Company',
        'Folio No': '12345',
        '2013': '2013',
        '2014': '2014'
      });
      
      doc.render();
      
      console.log('✅ SH-13 template is now valid and testable');
      
      // Get placeholders
      const fullText = doc.getFullText();
      const placeholderRegex = /\[([^\]]+)\]/g;
      const placeholders = [];
      let match;
      
      while ((match = placeholderRegex.exec(fullText)) !== null) {
        placeholders.push(match[1]);
      }
      
      console.log(`📋 Found ${placeholders.length} placeholders:`, placeholders);
      
      return {
        success: true,
        placeholders,
        message: 'SH-13 template created successfully'
      };
      
    } catch (error) {
      console.log('❌ Template validation failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
    
  } catch (error) {
    console.log('❌ Error creating SH-13 template:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
};

// Run the fix
if (require.main === module) {
  const result = createProperSH13Template();
  console.log('\n📊 RESULT:', result);
}

module.exports = { createProperSH13Template };
