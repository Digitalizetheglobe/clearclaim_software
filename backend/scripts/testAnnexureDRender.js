const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { postProcessDocxZip } = require('../src/utils/templateDocumentUtils');

const templatePath = path.join(
  __dirname,
  '../templates/Annexure-D (Individual Affidavit)_C1_Template.docx'
);

const data = {
  'Name as per Aadhar C1': 'Ramesh Balkrishna Kirloskar',
  'Father Name C1': 'Balkrishna Vishnu Kirloskar',
  'Address C1': 'Suhas Co-Op Society,Flat No. 8,Anantkrupa Soc, Paud Road,Near Vanaz Corner, Kothrud,Pune, Maharashtra PIN Code: 411038',
  'Mobile No C1': '9822676560',
  'Age C1': '85',
  'Name as per Aadhar C2': 'Anuradha Ramesh Kirloskar',
  'Mobile No C2': '9028593390',
  'Age C2': '82',
  'Name as per Aadhar C3': 'Gajanan Ramesh Kirloskar',
  'Mobile No C3': '447727264440',
  'Age C3': '50',
  'Company Name': 'CEAT LIMITED',
  'Folio No': 'ZVR0003214',
  'Total Shares': '37',
  'Deceased Names DC': 'Late Balkrishna Vishnu Kirloskar',
  'Address Contact C1': 'Suhas Co-Op Society, Flat No. 8, Anantkrupa Soc, Paud Road, Near Vanaz Corner, Kothrud, Pune, Maharashtra PIN Code: 411038, 9822676560',
  'Address Contact C2': '9028593390',
  'Address Contact C3': '447727264440',
};

const buf = fs.readFileSync(templatePath);
const doc = new Docxtemplater(new PizZip(buf), {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: '[', end: ']' },
  nullGetter: () => '',
});
doc.render(data);
const zip = doc.getZip();
postProcessDocxZip(zip);
const xml = zip.files['word/document.xml'].asText();

function extractText(s) {
  const a = [];
  let m;
  const r = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  while ((m = r.exec(s)) !== null) a.push(m[1]);
  return a.join('');
}

const i = xml.indexOf('deceased');
console.log('Deceased paragraph:', extractText(xml.slice(i - 100, i + 180)));

const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
const rows = [...tables[2][1].matchAll(/<w:tr/g)];
console.log('Heir table rows:', rows.length);

const out = path.join(__dirname, '../templates/_test_annexure_d_out.docx');
fs.writeFileSync(out, zip.generate({ type: 'nodebuffer' }));
console.log('Written:', out);
