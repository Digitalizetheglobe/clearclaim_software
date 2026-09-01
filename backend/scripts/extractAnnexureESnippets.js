const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();

const i = xml.indexOf(' LH6</w:t></w:r><w:r w:rsidR="000A7954"');
console.log('after LH6 opening:', xml.slice(i, i + 500));
