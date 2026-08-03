const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { postProcessDocumentXml, cleanFormattedListText } = require('../src/utils/templateDocumentUtils');

const downloadedPath = 'c:/Users/DIMPAL/Downloads/Annexure-D (Individual Affidavit) C1 (3).docx';

function extractText(xml) {
  const texts = [];
  const re = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let m;
  while ((m = re.exec(xml)) !== null) texts.push(m[1]);
  return texts.join('');
}

console.log('cleanFormattedListText test:', cleanFormattedListText('That Late Mr. /Mrs , , ("the deceased holder")'));

if (fs.existsSync(downloadedPath)) {
  const buf = fs.readFileSync(downloadedPath);
  let xml = new PizZip(buf).files['word/document.xml'].asText();
  xml = postProcessDocumentXml(xml);

  const i = xml.indexOf('Late');
  console.log('After postProcess Late:', extractText(xml.slice(i, i + 150)));

  const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
  const table3 = tables[2];
  const rows = [...table3[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
  console.log('Table 3 rows after postProcess:', rows.length);
  rows.forEach((row, ri) => {
    const cells = [...row[1].matchAll(/<w:tc(?:\s[^>]*)?>[\s\S]*?<\/w:tc>/g)];
    const cellTexts = cells.map((c) => extractText(c[0]).trim().slice(0, 40));
    console.log(`  Row ${ri + 1}:`, cellTexts);
  });
}
