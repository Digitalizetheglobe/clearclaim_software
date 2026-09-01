const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  sanitizeTemplateZip,
  postProcessDocxZip,
  replaceAnnexureDDeponentLh,
} = require('../src/utils/templateDocumentUtils');

function extractText(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');
}

function count(xml, tag) {
  return {
    open: (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) || []).length,
    close: (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length,
  };
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

function renderTemplate(fileName, data) {
  const full = path.join(__dirname, '../templates', fileName);
  const zip = new PizZip(fs.readFileSync(full));
  sanitizeTemplateZip(zip, { templateName: fileName });
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' },
    nullGetter: () => '',
  });
  doc.render(data);
  postProcessDocxZip(doc.getZip());
  return doc.getZip().files['word/document.xml'].asText();
}

const data = {
  'Name as per Aadhar LH8': 'Sunita Patil',
  'Father Name LH8': 'Ramesh Patil',
  'Address Contact LH8': 'Pune, 9876500008',
  'Name as per Aadhar LH4': 'Kiran Patil',
  'Father Name LH4': 'Ramesh Patil',
  'Address Contact LH4': 'Pune, 9876500004',
  'Company Name': 'CEAT LIMITED',
  'Folio No': 'ZVR0003214',
  'Total Shares': '37',
  'Deceased Names DC': 'Late Ramesh Patil',
};

// Runtime rebuild from LH5 xml
{
  const src = new PizZip(
    fs.readFileSync(
      path.join(__dirname, '../templates/Annexure-D (Individual Affidavit)_LH5_Template.docx')
    )
  ).files['word/document.xml'].asText();
  const rebuilt = replaceAnnexureDDeponentLh(src, 5, 8);
  const tbl = count(rebuilt, 'w:tbl');
  const tr = count(rebuilt, 'w:tr');
  const rebuiltPlain = extractText(rebuilt);
  assert(tbl.open === tbl.close && tbl.open === 3, `rebuilt LH8 tables ${tbl.open}/${tbl.close}`);
  assert(tr.open === tr.close, `rebuilt LH8 rows ${tr.open}/${tr.close}`);
  assert(rebuiltPlain.includes('[Name as per Aadhar LH8]'), 'deponent LH8 present');
  assert(rebuiltPlain.includes('[Name as per Aadhar LH5]'), 'table still has LH5');
  assert(!/\[Mobile No LH\d+\]/.test(rebuilt), 'leftover Mobile No LH tags removed from heir table');
}

[6, 7, 8, 9, 10].forEach((n) => {
  const name = `Annexure-D (Individual Affidavit)_LH${n}_Template.docx`;
  const xml = renderTemplate(name, {
    ...data,
    [`Name as per Aadhar LH${n}`]: `Heir ${n}`,
    [`Father Name LH${n}`]: 'Ramesh Patil',
    [`Address Contact LH${n}`]: `Pune, 987650000${n}`,
  });
  const tbl = count(xml, 'w:tbl');
  const tr = count(xml, 'w:tr');
  assert(tbl.open === tbl.close && tbl.open > 0, `${name} tables ${tbl.open}/${tbl.close}`);
  assert(tr.open === tr.close && tr.open > 0, `${name} rows ${tr.open}/${tr.close}`);
  const plain = extractText(xml);
  assert(plain.includes(`Heir ${n}`), `${name} populated deponent name`);
  assert(!/tag mismatch/i.test(plain), `${name} no mismatch text`);
});

{
  const xml = renderTemplate('Annexure-D_LH8_Template.docx', data);
  const tbl = count(xml, 'w:tbl');
  const tr = count(xml, 'w:tr');
  assert(tbl.open === tbl.close && tbl.open > 0, `short LH8 tables ${tbl.open}/${tbl.close}`);
  assert(tr.open === tr.close, `short LH8 rows ${tr.open}/${tr.close}`);
  assert(extractText(xml).includes('Sunita Patil'), 'short LH8 populated');
}

if (process.exitCode) {
  console.error('\nAnnexure-D LH tests failed');
} else {
  console.log('\nAnnexure-D LH tests passed');
}
