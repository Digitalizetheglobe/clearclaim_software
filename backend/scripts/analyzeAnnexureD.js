const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(
  __dirname,
  '../templates/Annexure-D (Individual Affidavit)_C1_Template.docx'
);
const downloadedPath = 'c:/Users/DIMPAL/Downloads/Annexure-D (Individual Affidavit) C1 (3).docx';

function extractText(xml) {
  const texts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) texts.push(m[1]);
  return texts.join('');
}

function analyzeDocx(filePath, label) {
  console.log('\n=== ' + label + ' ===');
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  const xml = zip.files['word/document.xml'].asText();

  // Find placeholders
  const placeholders = [...xml.matchAll(/\[([^\]]+)\]/g)].map((m) => m[1]);
  console.log('Placeholders count:', placeholders.length);
  console.log('Sample placeholders:', [...new Set(placeholders)].slice(0, 30));

  // Analyze tables
  const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
  console.log('Tables:', tables.length);

  tables.forEach((tbl, ti) => {
    const rows = [...tbl[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
    console.log(`\nTable ${ti + 1}: ${rows.length} rows`);
    rows.forEach((row, ri) => {
      const cells = [...row[1].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
      const cellTexts = cells.map((c) => extractText(c[0]).trim().replace(/\s+/g, ' ').slice(0, 80));
      console.log(`  Row ${ri + 1} (${cells.length} cols):`, cellTexts);
    });

    const gridMatch = tbl[1].match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/);
    if (gridMatch) {
      const cols = [...gridMatch[1].matchAll(/<w:gridCol/g)].length;
      console.log(`  tblGrid cols: ${cols}`);
    }
  });

  // Find Late Mr comma issue context
  const dcIdx = xml.indexOf('Name as per DC H1');
  if (dcIdx >= 0) {
    console.log('\nDC H paragraph:', extractText(xml.slice(dcIdx - 400, dcIdx + 300)));
  }
}

if (fs.existsSync(templatePath)) analyzeDocx(templatePath, 'TEMPLATE');
if (fs.existsSync(downloadedPath)) analyzeDocx(downloadedPath, 'DOWNLOADED');
