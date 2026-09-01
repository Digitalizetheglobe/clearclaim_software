/**
 * Form-B templates: replace semicolon-separated DC H1–H4 placeholders
 * with [Deceased Names DC] (keeps preceding "Late " in template).
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templatesDir = path.join(__dirname, '../templates');
const targets = fs
  .readdirSync(templatesDir)
  .filter((f) => f.startsWith('Form-B') && f.endsWith('.docx'));

const PATTERN =
  /\[Name as per DC H1\]; \[Name as per DC H2\]; \[Name as per DC H3\]; \[Name as per DC H4\]/g;

let updated = 0;
for (const file of targets) {
  const filePath = path.join(templatesDir, file);
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  const docFile = zip.files['word/document.xml'];
  if (!docFile) continue;

  const original = docFile.asText();
  if (!original.includes('[Name as per DC H1]; [Name as per DC H2]; [Name as per DC H3]; [Name as per DC H4]')) {
    continue;
  }

  const fixed = original.replace(PATTERN, '[Deceased Names DC]');
  const openR = (fixed.match(/<w:r[\s>]/g) || []).length;
  const closeR = (fixed.match(/<\/w:r>/g) || []).length;
  if (openR !== closeR) {
    console.error('Skip (unbalanced):', file, openR, closeR);
    continue;
  }

  zip.file('word/document.xml', fixed);
  const out = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  try {
    const inspector = new InspectModule();
    new Docxtemplater(new PizZip(out), {
      delimiters: { start: '[', end: ']' },
      modules: [inspector],
    });
  } catch (err) {
    console.error(
      'Skip (invalid):',
      file,
      err.properties?.errors?.map((e) => e.properties?.explanation).join('; ') || err.message
    );
    continue;
  }

  fs.writeFileSync(filePath, out);
  console.log('Updated:', file);
  updated++;
}

console.log(`Done. Updated ${updated} template(s).`);
