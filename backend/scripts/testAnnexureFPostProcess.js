const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  postProcessDocumentXml,
  postProcessDocxZip,
  sanitizeTemplateZip,
} = require('../src/utils/templateDocumentUtils');

function extractText(s) {
  return [...s.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');
}

function fakeRow(vals) {
  return (
    '<w:tr>' +
    vals.map((t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`).join('') +
    '</w:tr>'
  );
}

function claimantTableXml(dataRows) {
  return (
    '<w:tbl>' +
    fakeRow([
      'Name of the Claimant(s)',
      'Address and contact details',
      'Age',
      'Relationship with the deceased',
    ]) +
    dataRows.map((r) => fakeRow(r)).join('') +
    '</w:tbl>'
  );
}

function claimantRowTexts(xml) {
  const tables = [...xml.matchAll(/<w:tbl\b[^>]*>([\s\S]*?)<\/w:tbl>/g)];
  const claimant = tables.find((t) =>
    /Name of the Claimant/i.test(extractText(t[1]))
  );
  if (!claimant) throw new Error('Claimants table not found');
  const rows = [...claimant[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
  return rows.map((r) => {
    const cells = [...r[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)];
    return cells.map((c) => extractText(c[1]).replace(/\s+/g, ' ').trim());
  });
}

function assert(cond, msg) {
  if (!cond) {
    console.error('FAIL:', msg);
    process.exitCode = 1;
  } else {
    console.log('OK:', msg);
  }
}

// 1) Synthetic: empty C3 name + leftover C2 mobile must drop the row
{
  const xml = claimantTableXml([
    ['Ramesh Kirloskar', 'Pune, 9822676560', '85', 'Son'],
    ['Anuradha Kirloskar', '9028593390', '82', 'Spouse'],
    ['', '9028593390', '', ''],
  ]);
  const out = postProcessDocumentXml(xml);
  const rows = claimantRowTexts(out);
  assert(rows.length === 3, `empty C3 + leftover mobile removed (rows=${rows.length})`);
  assert(!rows.some((r) => r[0] === '' && r[1] === '9028593390'), 'leftover C2 mobile row gone');
  assert(rows[1][0] === 'Ramesh Kirloskar', 'C1 row kept');
  assert(rows[2][0] === 'Anuradha Kirloskar', 'C2 row kept');
}

// 2) Synthetic: populated C3 must stay
{
  const xml = claimantTableXml([
    ['Ramesh Kirloskar', 'Pune', '85', 'Son'],
    ['Anuradha Kirloskar', 'Mumbai', '82', 'Spouse'],
    ['Gajanan Kirloskar', 'Delhi, 9876543210', '50', 'Son'],
  ]);
  const out = postProcessDocumentXml(xml);
  const rows = claimantRowTexts(out);
  assert(rows.length === 4, `populated C3 kept (rows=${rows.length})`);
  assert(rows[3][0] === 'Gajanan Kirloskar', 'C3 name kept');
}

// 3) Render Annexure-F with C1+C2 only
{
  const templatePath = path.join(
    __dirname,
    '../templates/Annexure-F (Noc from other legal heirs)_Template.docx'
  );
  const data = {
    'Name as per Aadhar C1': 'Ramesh Balkrishna Kirloskar',
    'Address C1': 'Kothrud, Pune',
    'Mobile No C1': '9822676560',
    'Age C1': '85',
    'Relation with Deceased C1': 'Son',
    'Name as per Aadhar C2': 'Anuradha Ramesh Kirloskar',
    'Address C2': 'Kothrud, Pune',
    'Mobile No C2': '9028593390',
    'Age C2': '82',
    'Relation with Deceased C2': 'Spouse',
    'Company Name': 'CEAT LIMITED',
    'Folio No': 'ZVR0003214',
    'Total Shares': '37',
  };
  const zipIn = new PizZip(fs.readFileSync(templatePath));
  sanitizeTemplateZip(zipIn);
  const doc = new Docxtemplater(zipIn, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' },
    nullGetter: () => '',
  });
  doc.render(data);
  const zip = doc.getZip();
  postProcessDocxZip(zip);
  const xml = zip.files['word/document.xml'].asText();
  const rows = claimantRowTexts(xml);
  console.log('Rendered claimants rows:', rows);
  assert(rows.length === 3, `template C3 hidden when C3 missing (rows=${rows.length})`);
  assert(
    !rows.some((r) => /gajanan|c3/i.test(r.join(' '))),
    'no C3 placeholder leftover in claimants table'
  );
  assert(
    !rows.some((r) => r.includes('9028593390') && !/anuradha/i.test(r.join(' '))),
    'C2 mobile not shown on a nameless C3 row'
  );
}

// 4) Render Annexure-F with C3 present
{
  const templatePath = path.join(
    __dirname,
    '../templates/Annexure-F (Noc from other legal heirs)_Template.docx'
  );
  const data = {
    'Name as per Aadhar C1': 'Ramesh Balkrishna Kirloskar',
    'Address C1': 'Kothrud, Pune',
    'Mobile No C1': '9822676560',
    'Age C1': '85',
    'Relation with Deceased C1': 'Son',
    'Name as per Aadhar C2': 'Anuradha Ramesh Kirloskar',
    'Address C2': 'Kothrud, Pune',
    'Mobile No C2': '9028593390',
    'Age C2': '82',
    'Relation with Deceased C2': 'Spouse',
    'Name as per Aadhar C3': 'Gajanan Ramesh Kirloskar',
    'Address C3': 'Delhi',
    'Mobile No C3': '9876543210',
    'Age C3': '50',
    'Relation with Deceased C3': 'Son',
    'Company Name': 'CEAT LIMITED',
    'Folio No': 'ZVR0003214',
    'Total Shares': '37',
  };
  const zipIn = new PizZip(fs.readFileSync(templatePath));
  sanitizeTemplateZip(zipIn);
  const doc = new Docxtemplater(zipIn, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' },
    nullGetter: () => '',
  });
  doc.render(data);
  const zip = doc.getZip();
  postProcessDocxZip(zip);
  const xml = zip.files['word/document.xml'].asText();
  const rows = claimantRowTexts(xml);
  console.log('Rendered claimants rows with C3:', rows);
  assert(rows.length === 4, `template C3 kept when present (rows=${rows.length})`);
  assert(rows[3][0] === 'Gajanan Ramesh Kirloskar', 'C3 name filled');
  assert(rows[3].some((c) => c.includes('9876543210')), 'C3 mobile used, not C2');
}

if (process.exitCode) {
  console.error('\nAnnexure-F C3 tests failed');
} else {
  console.log('\nAnnexure-F C3 tests passed');
}
