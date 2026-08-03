const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '../templates');
const files = fs.readdirSync(templatesDir).filter((f) => f.startsWith('Form-B') && f.endsWith('.docx'));

for (const f of files) {
  const xml = new PizZip(fs.readFileSync(path.join(templatesDir, f))).files['word/document.xml'].asText();
  const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const m = texts.match(/That[\s\S]{0,40}we[\s\S]{0,400}?are the sole/i) || texts.match(/That[\s\S]{0,400}?are the sole/i);
  const hasLate = /Late \[Name as per DC/.test(texts);
  const hasSemiDc = /DC H1\]; \[Name as per DC H2\]/.test(texts);
  console.log(f);
  console.log('  late+semi', hasLate, hasSemiDc);
  if (m) console.log('  snippet:', m[0].slice(0, 220).replace(/\s+/g, ' '));
  console.log('');
}
