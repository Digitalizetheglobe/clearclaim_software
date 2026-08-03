/**
 * ISR-1 template fixes:
 * - Remove footnote "#" immediately after Bank AC / Email / Mobile placeholders
 * - Relax overly tight exact line spacing in bank-details cell (reduces overlap)
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templatePath = path.join(__dirname, '../templates/ISR-1_Template.docx');
const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
let xml = zip.files['word/document.xml'].asText();

const before = xml;

// Remove standalone "#" runs that sit right after bank/email/mobile field placeholders
xml = xml.replace(
  /(\[(?:Bank AC C1|Email ID C1|Mobile No C1)\]<\/w:t><\/w:r>)([\s\S]{0,400}?)(<w:r(?:\s[^>]*)?>[\s\S]{0,200}?<w:t>#<\/w:t><\/w:r>)/g,
  '$1$2'
);

// Soften exact line spacing that causes Bank Name / Branch overlap when values are long
xml = xml.replace(
  /<w:spacing w:line="292" w:lineRule="exact"\/>/g,
  '<w:spacing w:line="276" w:lineRule="auto"/>'
);

if (xml === before) {
  console.log('No structural changes applied (patterns may already be fixed)');
} else {
  console.log('Template XML updated');
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

try {
  fs.writeFileSync(templatePath, out);
  console.log('Saved:', templatePath);
} catch (err) {
  if (err.code === 'EBUSY' || err.code === 'EPERM') {
    const alt = templatePath.replace(/\.docx$/i, '_fixed.docx');
    fs.writeFileSync(alt, out);
    console.error('Original file is locked (close Word). Wrote:', alt);
    console.error('Close ISR-1_Template.docx and re-run: node scripts/fixISR1Template.js');
  } else {
    throw err;
  }
}
console.log('Tags:', Object.keys(inspector.getAllTags()).length);

// Verify # after Bank AC gone
const check = new PizZip(out).files['word/document.xml'].asText();
const i = check.indexOf('[Bank AC C1]');
console.log('After Bank AC:', check.slice(i, i + 350).replace(/\s+/g, ' ').slice(0, 220));
