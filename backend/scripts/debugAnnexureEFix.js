const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const buf = fs.readFileSync(templatePath);

function tryCompile(xmlStr) {
  const zip = new PizZip(buf);
  zip.file('word/document.xml', xmlStr);
  try {
    new Docxtemplater(zip, { delimiters: { start: '[', end: ']' } });
    return { ok: true };
  } catch (e) {
    const err = e.properties?.errors?.[0];
    return {
      ok: false,
      msg: err?.properties?.explanation || err?.message || e.message,
    };
  }
}

let xml = new PizZip(buf).files['word/document.xml'].asText();
console.log('original:', tryCompile(xml));

xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');
console.log('proofErr:', tryCompile(xml));

const before = xml;
xml = xml.replace(
  /<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[<\/w:t><\/w:r>(?=<w:r[^>]*>[\s\S]*?<w:t>\[Name as per)/g,
  ''
);
console.log('stray [:', tryCompile(xml), 'changed:', before !== xml);

// Manual fix at Certificate H1
const idx = xml.indexOf('[Name as per Certificate H1]');
console.log('before H1:', xml.slice(idx - 120, idx + 40));
