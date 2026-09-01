const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/ISR-1_Template.docx');
const xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();

const needles = ['Bank AC', 'Bank Name', 'Bank Branch', 'IFSC', 'Account Number', 'Provide the following', 'cancelled cheque'];
for (const n of needles) {
  const idx = xml.indexOf(n);
  console.log('\n====', n, idx, '====');
  if (idx >= 0) console.log(xml.slice(Math.max(0, idx - 120), idx + 500));
}

// Find runs with unusual fonts near bank
const fontHits = [...xml.matchAll(/<w:rFonts[^>]*\/>(?:(?!<\/w:r>)[\s\S]){0,200}<w:t[^>]*>([^<]{0,40})<\/w:t>/g)]
  .filter((m) => /Wing|Symbol|Webding|MT Extra|Zapf/i.test(m[0]) || /[□✓✔]/.test(m[1]));
console.log('\nUnusual fonts / checkbox chars:', fontHits.length);
fontHits.slice(0, 15).forEach((m) => console.log(m[0].replace(/\s+/g, ' ').slice(0, 200)));
