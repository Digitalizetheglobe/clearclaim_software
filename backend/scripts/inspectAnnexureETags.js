const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);

const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: '[', end: ']' },
});

const tags = doc.getFullText();
console.log('Full text length:', tags.length);

// Get tags via inspect module if available
try {
  const InspectModule = require('docxtemplater/js/inspect-module.js');
  const im = new InspectModule();
  new Docxtemplater(zip, {
    delimiters: { start: '[', end: ']' },
    modules: [im],
  });
  const allTags = im.getAllTags();
  console.log('\nDocxtemplater recognized tags (' + Object.keys(allTags).length + '):');
  Object.keys(allTags).sort().forEach((t) => console.log(' -', t));
} catch (e) {
  console.log('Inspect error:', e.message);
}
