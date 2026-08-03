const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '../templates');
const files = fs.readdirSync(templatesDir).filter((f) => f.startsWith('Form-B') && f.endsWith('.docx'));
console.log('Form-B files:', files);

const target = files.find((f) => f.includes('NDEL')) || files[0];
console.log('Analyzing:', target);

const xml = new PizZip(fs.readFileSync(path.join(templatesDir, target))).files['word/document.xml'].asText();
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

const i = texts.search(/That\s/i);
console.log('\n--- opening ---');
console.log(texts.slice(i, i + 500));

const placeholders = [...texts.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
console.log('\n--- unique placeholders (sample) ---');
[...new Set(placeholders)].slice(0, 80).forEach((p) => console.log(p));

const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
console.log('\nTables:', tables.length);
tables.forEach((t, ti) => {
  const rows = [...t[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
  console.log(`Table ${ti + 1}: ${rows.length} rows`);
  rows.slice(0, 4).forEach((r, ri) => {
    const cells = [...r[1].matchAll(/<w:tc[^>]*>[\s\S]*?<\/w:tc>/g)].map((c) =>
      [...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').slice(0, 40)
    );
    console.log(`  ${ri + 1}`, cells);
  });
});
