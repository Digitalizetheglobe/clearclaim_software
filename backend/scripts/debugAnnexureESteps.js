const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const buf = fs.readFileSync(path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx'));

function tryCompile(xmlStr) {
  const zip = new PizZip(buf);
  zip.file('word/document.xml', xmlStr);
  try {
    new Docxtemplater(zip, { delimiters: { start: '[', end: ']' } });
    return true;
  } catch (e) {
    return e.properties?.errors?.[0]?.properties?.explanation || e.message;
  }
}

let xml = new PizZip(buf).files['word/document.xml'].asText();
xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');
xml = xml.replace(/<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[<\/w:t><\/w:r>(<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[Name as per)/g, '$1');
xml = xml.replace(/<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[<\/w:t><\/w:r>(<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>)(Relation with Deceased[^<]*)<\/w:t>/g, '$1[$2</w:t>');

const steps = [
  ['LH split', (x) => x.replace(/\[Name as per <\/w:t><\/w:r>(?:<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>Aadhar<\/w:t><\/w:r>)+<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?: xml:space="preserve")?> LH(\d+)/g, '[Name as per Aadhar LH$1')],
  ['Cert H split', (x) => x.replace(/\[Name as per <\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?: xml:space="preserve")?>Certificate <\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>H(\d+)/g, '[Name as per Certificate H$1')],
  ['DC H split', (x) => x.replace(/\[Name as per DC H<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>(\d+)/g, '[Name as per DC H$1')],
  ['Aadhar C split', (x) => x.replace(/\[Name as per Aadhar C<\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>(\d+)/g, '[Name as per Aadhar C$1')],
  ['witness', (x) => x.replace(/<w:t>#, have<\/w:t>/g, '<w:t>[Claimant Names], have</w:t>')],
  ['cert combine comma', (x) => x.replace(/, \[Name as per Certificate H2\], \[Name as per Certificate H3\], \[Name as per Certificate H4\]/g, '')],
  ['cert H1', (x) => x.replace(/\[Name as per Certificate H1\]/g, '[Deceased Names Certificate]')],
  ['address mobile cell', (x) => x.replace(/\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>((?:(?!<\/w:tc>)[\s\S])*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g, '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>')],
  ['address global', (x) => x.replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]')],
  ['address split', (x) => x.replace(/\[Address (C\d+|LH\d+)<\/w:t><\/w:r>((?:(?!<\/w:tc>)[\s\S])*?)<w:t[^>]*>\]<\/w:t>/g, '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>')],
];

for (const [name, fn] of steps) {
  xml = fn(xml);
  const r = tryCompile(xml);
  console.log(name, r === true ? 'OK' : 'FAIL: ' + r);
}
