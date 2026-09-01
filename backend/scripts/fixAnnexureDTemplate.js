/**
 * Fix Annexure-D (Individual Affidavit) templates:
 * - Replace 4 DC H placeholders with single [Deceased Names DC]
 * - Replace [Address X][Mobile No X] with [Address Contact X]
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatesDir = path.join(__dirname, '../templates');

function fixDocumentXml(xml) {
  let result = xml;

  // Combined deceased name placeholder
  result = result.replace(
    /, \[Name as per DC H2\], \[Name as per DC H3\], \[Name as per DC H4\]/g,
    ''
  );
  result = result.replace(/\[Name as per DC H1\]/g, '[Deceased Names DC]');

  // Combined address + mobile — match across Word runs (any rsid)
  result = result.replace(
    /\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>([\s\S]*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g,
    '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>'
  );

  // Use combined address+mobile field everywhere
  result = result.replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]');

  // Split placeholders: [Address LH6</w:t>...<w:t>]
  result = result.replace(
    /\[Address (C\d+|LH\d+)<\/w:t><\/w:r>([\s\S]*?)<w:t[^>]*>\]<\/w:t>/g,
    '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>'
  );

  // Drop leftover [Mobile No LHn] only when Address Contact already exists.
  // Do NOT delete <w:p>…</w:p> spans — a greedy paragraph match previously gutted LH6–LH10.
  result = result.replace(/\[Mobile No (LH\d+)\]/g, (full, suffix) => {
    return result.includes(`[Address Contact ${suffix}]`) ? '' : full;
  });

  return result;
}

function fixTemplate(filePath) {
  const buf = fs.readFileSync(filePath);
  const zip = new PizZip(buf);
  const docFile = zip.files['word/document.xml'];
  if (!docFile) return false;

  const original = docFile.asText();
  const fixed = fixDocumentXml(original);
  if (fixed === original) {
    console.log('No changes:', path.basename(filePath));
    return false;
  }

  zip.file('word/document.xml', fixed);
  fs.writeFileSync(filePath, zip.generate({ type: 'nodebuffer' }));
  console.log('Fixed:', path.basename(filePath));
  return true;
}

const files = fs.readdirSync(templatesDir).filter(
  (f) => f.startsWith('Annexure-D (Individual Affidavit)_') && f.endsWith('.docx')
);

let count = 0;
files.forEach((f) => {
  if (fixTemplate(path.join(templatesDir, f))) count++;
});
console.log(`Done. Updated ${count} of ${files.length} templates.`);
