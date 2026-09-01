const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');

function extractText(xml) {
  const texts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) texts.push(m[1]);
  return texts.join('');
}

const buf = fs.readFileSync(templatePath);
const xml = new PizZip(buf).files['word/document.xml'].asText();

const placeholders = [...xml.matchAll(/\[+([^\[\]]+)\]+/g)].map((m) => m[1].trim());
const unique = [...new Set(placeholders)];
console.log('Unique placeholders (' + unique.length + '):');
unique.forEach((p) => console.log(' -', p));

const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
console.log('\nTables:', tables.length);
tables.forEach((tbl, ti) => {
  const rows = [...tbl[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
  console.log(`Table ${ti + 1}: ${rows.length} rows`);
  rows.slice(0, 8).forEach((row, ri) => {
    const cells = [...row[1].matchAll(/<w:tc[^>]*>[\s\S]*?<\/w:tc>/g)];
    const cellTexts = cells.map((c) => extractText(c[0]).trim().slice(0, 50));
    console.log(`  Row ${ri + 1} (${cells.length} cols):`, cellTexts);
  });
  if (rows.length > 8) console.log(`  ... ${rows.length - 8} more rows`);
});

// Opening I/We paragraph
const iWe = xml.indexOf('Name as per Aadhar C1');
if (iWe >= 0) console.log('\nI/We para:', extractText(xml.slice(iWe - 30, iWe + 400)).slice(0, 350));

// Certificate H paragraph
const cert = xml.indexOf('Certificate H1');
if (cert >= 0) console.log('\nCert H para:', extractText(xml.slice(cert - 80, cert + 200)));
