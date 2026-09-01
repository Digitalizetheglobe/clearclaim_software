/**
 * Restore corrupted Annexure-D (Individual Affidavit) LH6–LH10 templates
 * from the intact LH5 file.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { replaceAnnexureDDeponentLh } = require('../src/utils/templateDocumentUtils');

const templatesDir = path.join(__dirname, '../templates');
const sourcePath = path.join(
  templatesDir,
  'Annexure-D (Individual Affidavit)_LH5_Template.docx'
);
const sourceBuf = fs.readFileSync(sourcePath);

[6, 7, 8, 9, 10].forEach((n) => {
  const destName = `Annexure-D (Individual Affidavit)_LH${n}_Template.docx`;
  const destPath = path.join(templatesDir, destName);
  const zip = new PizZip(sourceBuf);

  Object.keys(zip.files).forEach((filePath) => {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(filePath)) return;
    zip.file(filePath, replaceAnnexureDDeponentLh(zip.files[filePath].asText(), 5, n));
  });

  const xml = zip.files['word/document.xml'].asText();
  const plain = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const tblOpen = (xml.match(/<w:tbl(?:\s[^>]*)?>/g) || []).length;
  const tblClose = (xml.match(/<\/w:tbl>/g) || []).length;
  if (tblOpen !== tblClose || tblOpen === 0) {
    throw new Error(`${destName} table tags still unbalanced (${tblOpen}/${tblClose})`);
  }
  if (!plain.includes(`[Name as per Aadhar LH${n}]`)) {
    throw new Error(`${destName} missing deponent LH${n} name`);
  }
  if (!plain.includes('[Name as per Aadhar LH5]')) {
    throw new Error(`${destName} lost LH5 table row`);
  }

  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  try {
    fs.writeFileSync(destPath, buffer);
    console.log('Restored', destName);
  } catch (err) {
    console.error('Could not overwrite', destName, '-', err.message);
    console.error('Runtime repair will still rebuild this file on preview/download.');
  }
});
