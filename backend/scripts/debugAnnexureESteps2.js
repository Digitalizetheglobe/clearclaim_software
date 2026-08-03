const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const buf = fs.readFileSync(templatePath);

function getTags(xmlStr) {
  const zip = new PizZip(buf);
  zip.file('word/document.xml', xmlStr);
  const inspector = new InspectModule();
  try {
    new Docxtemplater(zip, { delimiters: { start: '[', end: ']' }, modules: [inspector] });
    return { ok: true, count: Object.keys(inspector.getAllTags()).length, tags: Object.keys(inspector.getAllTags()) };
  } catch (e) {
    return { ok: false, err: e.properties?.errors?.[0]?.properties?.explanation || e.message };
  }
}

function hasPlaceholders(xml) {
  return xml.includes('[NOS1]') && xml.includes('[Folio No]') && xml.includes('[SC1]');
}

let xml = new PizZip(buf).files['word/document.xml'].asText();

const steps = [
  ['proofErr', (x) => x.replace(/<w:proofErr[^>]*\/>/g, '')],
  ['lone bracket bracket', (x) => x.replace(
    /<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[<\/w:t><\/w:r><w:r([^>]*)>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[([^\]]+)\]<\/w:t>/g,
    '<w:r$1><w:rPr></w:rPr><w:t>[$2]</w:t>'
  )],
  ['lone bracket relation', (x) => x.replace(
    /<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>\[<\/w:t><\/w:r><w:r([^>]*)>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>(Relation with Deceased C(\d+)\])<\/w:t>/g,
    '<w:r$1><w:rPr></w:rPr><w:t>[Relation with Deceased C$2</w:t>'
  )],
  ['LH split', (x) => x.replace(
    /\[Name as per <\/w:t><\/w:r>(?:<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>Aadhar<\/w:t><\/w:r>)+<w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?: xml:space="preserve")?> LH(\d+)/g,
    '[Name as per Aadhar LH$1'
  )],
  ['cert H split', (x) => x.replace(
    /\[Name as per <\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t(?: xml:space="preserve")?>Certificate <\/w:t><\/w:r><w:r[^>]*>(?:<w:rPr>[\s\S]*?<\/w:rPr>)?<w:t>H(\d+)/g,
    '[Name as per Certificate H$1'
  )],
  ['witness', (x) => x.replace(/<w:t>#, have<\/w:t>/g, '<w:t>[Claimant Names], have</w:t>')],
  ['cert combine', (x) => {
    let r = x.replace(/, \[Name as per Certificate H2\], \[Name as per Certificate H3\], \[Name as per Certificate H4\]/g, '');
    return r.replace(/\[Name as per Certificate H1\]/g, '[Deceased Names Certificate]');
  }],
  ['address cell', (x) => x.replace(
    /\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>((?:(?!<\/w:tc>)[\s\S])*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g,
    '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>'
  )],
  ['address rename', (x) => x.replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]')],
];

for (const [name, fn] of steps) {
  xml = fn(xml);
  const t = getTags(xml);
  const ph = hasPlaceholders(xml);
  console.log(name, t.ok ? `OK tags=${t.count} ph=${ph}` : `FAIL ${t.err}`, ph ? '' : 'MISSING PH');
}
