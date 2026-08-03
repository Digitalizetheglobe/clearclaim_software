/**
 * Fix Legal Heir Certificate template:
 * - Row 1 (C1): wrong [Claimant Relation H1] in Relationship column → [Deceased Relation C1]
 * - Remove extra C2/C3 claimant rows (legal heir table should list C1 + LH1–LH10 only)
 * - Renumber Sr. No after row removal
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/Legal_Heir_Certificate_.docx');

function getCellText(cellXml) {
  return [...cellXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('').trim();
}

function fixTemplate() {
  const buffer = fs.readFileSync(templatePath);
  const zip = new PizZip(buffer);
  let xml = zip.files['word/document.xml'].asText();

  // Fix wrong relationship placeholder on C1 row
  xml = xml.replace('[Claimant Relation H1]', '[Deceased Relation C1]');

  // Remove C2 and C3 data rows from the legal heir table
  xml = xml.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullRow, rowContent) => {
    if (rowContent.includes('[Name as per Aadhar C2]') || rowContent.includes('[Name as per Aadhar C3]')) {
      console.log('Removing extra row:', getCellText(rowContent).substring(0, 60));
      return '';
    }
    return fullRow;
  });

  // Renumber Sr. No in the main legal heir table (first table)
  const tableMatch = xml.match(/<w:tbl>([\s\S]*?)<\/w:tbl>/);
  if (tableMatch) {
    let tableContent = tableMatch[1];
    let serial = 0;
    tableContent = tableContent.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullRow, rowContent) => {
      const cells = [...rowContent.matchAll(/<w:tc(?:\s[^>]*)?>([\s\S]*?)<\/w:tc>/g)];
      if (cells.length === 0) return fullRow;

      const firstCellText = getCellText(cells[0][1]);
      if (firstCellText === 'Sr. No') return fullRow;

      serial += 1;
      const newNum = String(serial);
      if (firstCellText === newNum) return fullRow;

      const newFirstCell = cells[0][1].replace(
        /(<w:t[^>]*>)[^<]*(<\/w:t>)/,
        `$1${newNum}$2`
      );
      const newRowContent = rowContent.replace(cells[0][1], newFirstCell);
      return fullRow.replace(rowContent, newRowContent);
    });
    xml = xml.replace(tableMatch[0], '<w:tbl>' + tableContent + '</w:tbl>');
  }

  zip.file('word/document.xml', xml);
  fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer' }));
  console.log('✅ Legal Heir Certificate template fixed:', templatePath);
}

fixTemplate();
