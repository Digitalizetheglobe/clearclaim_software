const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const xml = new PizZip(
  fs.readFileSync(path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx'))
)
  .files['word/document.xml'].asText()
  .replace(/<w:proofErr[^>]*\/>/g, '');

const narrow =
  /<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]{0,400}?<w:t>Company Name]<\/w:t><\/w:r>/g;
const broad =
  /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]{0,400}?<w:t>Company Name]<\/w:t><\/w:r>/g;

const m1 = [...xml.matchAll(narrow)];
const m2 = [...xml.matchAll(broad)];
console.log('narrow', m1.length, 'broad', m2.length);
if (m2[0]) {
  console.log('broad len', m2[0][0].length);
  console.log('START', m2[0][0].slice(0, 300));
  console.log('END', m2[0][0].slice(-300));
  const opens = (m2[0][0].match(/<w:r[\s>]/g) || []).length;
  const closes = (m2[0][0].match(/<\/w:r>/g) || []).length;
  console.log('in match w:r', opens, closes);
}
