const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/ISR-1_Template.docx');
const xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();
const texts = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

console.log('--- Bank section ---');
const bankIdx = texts.search(/Bank details|Account Number|Bank Name|Branch Name|IFSC/i);
console.log(texts.slice(Math.max(0, bankIdx - 50), bankIdx + 600));

console.log('\n--- Provide the following ---');
const pIdx = texts.search(/Provide the following/i);
console.log(texts.slice(pIdx, pIdx + 400));

console.log('\n--- # occurrences near bank ---');
const hashMatches = [...xml.matchAll(/<w:t[^>]*>[^<]*#[^<]*<\/w:t>/g)].slice(0, 20);
hashMatches.forEach((m) => console.log(m[0]));

console.log('\n--- Authorization / Issuer table ---');
const tables = [...xml.matchAll(/<w:tbl>([\s\S]*?)<\/w:tbl>/g)];
console.log('Tables:', tables.length);
tables.forEach((t, ti) => {
  const rows = [...t[1].matchAll(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g)];
  const firstRowText = [...rows[0]?.[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g) || []]
    .map((m) => m[1])
    .join('')
    .slice(0, 80);
  if (/Issuer|Folio|Quantity|Face value|Distinctive|Authorization|Company/i.test(firstRowText + (rows[1] ? [...rows[1][1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('') : ''))) {
    console.log(`\nTable ${ti + 1}: ${rows.length} rows | header-ish: ${firstRowText}`);
    rows.slice(0, 5).forEach((r, ri) => {
      const cells = [...r[1].matchAll(/<w:tc[^>]*>[\s\S]*?<\/w:tc>/g)].map((c) =>
        [...c[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').slice(0, 35)
      );
      console.log(`  ${ri + 1}`, cells);
    });
  }
});

const placeholders = [...new Set([...texts.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]))];
console.log('\n--- Placeholders with Bank/Branch/Account/NOS/Face/DN ---');
placeholders.filter((p) => /Bank|Branch|Account|IFSC|NOS|Face|DN|SC|Folio|Company|Wing|Provide|#/i.test(p)).forEach((p) => console.log(p));
