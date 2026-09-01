/**
 * Annexure-F Claimants Details table:
 * - C3 contact cell used [Mobile No C2], so the C3 row stayed visible whenever C2 existed
 * - Merge split [Relation with Deceased C3] so the tag always resolves
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(
  __dirname,
  '../templates/Annexure-F (Noc from other legal heirs)_Template.docx'
);

function getCellText(cellXml) {
  return [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
}

function fixTemplate() {
  const zip = new PizZip(fs.readFileSync(templatePath));
  let xml = zip.files['word/document.xml'].asText();

  let mobileFixed = 0;
  let relationMerged = 0;

  xml = xml.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullRow, rowContent) => {
    const rowText = getCellText(rowContent);
    if (!/Name as per Aadhar C3/.test(rowText)) return fullRow;

    let updated = fullRow;
    if (updated.includes('[Mobile No C2]')) {
      updated = updated.replace('[Mobile No C2]', '[Mobile No C3]');
      mobileFixed += 1;
    }

    const mergedRelation = updated.replace(
      /<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]{0,400}?<w:t(?: xml:space="preserve")?> C3\]<\/w:t><\/w:r>/,
      '<w:t>[Relation with Deceased C3]</w:t></w:r>'
    );
    if (mergedRelation !== updated) {
      relationMerged += 1;
      updated = mergedRelation;
    }

    return updated;
  });

  zip.file('word/document.xml', xml);
  const buffer = zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' });
  try {
    fs.writeFileSync(templatePath, buffer);
    console.log('Annexure-F template updated:', templatePath);
  } catch (err) {
    console.warn('Could not overwrite template (file may be open in Word):', err.message);
    console.warn('Runtime sanitizeTemplateZip still rewrites C3 Mobile No C2 → C3 on download.');
  }
  console.log('  C3 Mobile No C2 → C3:', mobileFixed);
  console.log('  Merged Relation with Deceased C3:', relationMerged);
}

fixTemplate();
