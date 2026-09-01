/**
 * One-shot: replace multi DC H / DOD placeholders with [Deceased Death Details]
 * in Annexure-E template.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
let xml = zip.files['word/document.xml'].asText();

const before = xml;
xml = xml.replace(
  /\[Name as per DC H1\] on <\/w:t><\/w:r>[\s\S]*?<w:t>\[DOD H4\]<\/w:t>/g,
  '[Deceased Death Details]</w:t>'
);

if (xml === before) {
  console.error('No death-clause pattern matched');
  process.exit(1);
}

if (!xml.includes('[Deceased Death Details]')) {
  console.error('Deceased Death Details missing after replace');
  process.exit(1);
}
if (xml.includes('[DOD H1]') || xml.includes('[Name as per DC H2]')) {
  console.error('Old death placeholders still present');
  process.exit(1);
}

const openR = (xml.match(/<w:r[\s>]/g) || []).length;
const closeR = (xml.match(/<\/w:r>/g) || []).length;
if (openR !== closeR) {
  console.error('Unbalanced w:r', openR, closeR);
  process.exit(1);
}

zip.file('word/document.xml', xml);
const out = zip.generate({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
});

const inspector = new InspectModule();
new Docxtemplater(new PizZip(out), {
  delimiters: { start: '[', end: ']' },
  modules: [inspector],
});

console.log('OK. Tags:', Object.keys(inspector.getAllTags()).length);
fs.writeFileSync(templatePath, out);
console.log('Saved:', templatePath);
