const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const templatePath = path.join(__dirname, '../templates/Legal_Heir_Certificate_.docx');
const xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();

const tbl = xml.match(/<w:tbl>([\s\S]*?)<\/w:tbl>/)[1];
const grid = tbl.match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/);
if (grid) {
  const cols = [...grid[1].matchAll(/<w:gridCol/g)];
  console.log('gridCol count:', cols.length);
}

const rows = [...tbl.matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
rows.slice(0, 3).forEach((r, ri) => {
  const cells = [...r[1].matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)];
  cells.forEach((c, ci) => {
    const span = c[1].match(/w:gridSpan w:val="(\d+)"/);
    const text = [...c[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    console.log('Row', ri + 1, 'cell', ci + 1, 'gridSpan:', span ? span[1] : '1', 'text:', text.substring(0, 50));
  });
});

const idx = xml.indexOf('<w:tbl>');
const before = xml.substring(idx - 12000, idx);
const paras = [...before.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).filter((t) => t.trim());
console.log('\nText before table (last 30 parts):');
paras.slice(-30).forEach((p) => console.log(' -', p));

// Find numbered list patterns
const fullText = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
const residing = fullText.match(/That I am residing[\s\S]{0,200}/g);
console.log('\nResiding patterns:', residing);
