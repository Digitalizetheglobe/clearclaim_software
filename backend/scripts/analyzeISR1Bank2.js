const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/ISR-1_Template.docx');
const xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();

// Show bank name / branch paragraph structure
const i = xml.indexOf('[Bank Name C1]');
console.log('=== Bank Name paragraph ===');
console.log(xml.slice(i - 400, i + 800));

const j = xml.indexOf('[Bank Branch C1]');
console.log('\n=== Bank Branch paragraph ===');
console.log(xml.slice(j - 400, j + 400));

// Provide following paragraph with wingdings
const k = xml.indexOf('Original cancelled');
console.log('\n=== cancelled cheque para ===');
if (k > 0) console.log(xml.slice(k - 350, k + 450));
else {
  // find via wingdings next to provide
  const m = xml.match(/Provide the following[\s\S]{0,50}/);
  console.log('fallback', m && m[0]);
  const w = xml.indexOf('Wingdings');
  // find provide near wingdings after bank
  let idx = 0, n = 0;
  while (n < 30) {
    const p = xml.indexOf('Wingdings', idx);
    if (p < 0) break;
    const chunk = xml.slice(p, p + 250);
    if (chunk.includes('') || chunk.includes('\uf020')) {
      console.log('wingdings special at', p, chunk.replace(/\s+/g, ' ').slice(0, 180));
    }
    idx = p + 1;
    n++;
  }
}
