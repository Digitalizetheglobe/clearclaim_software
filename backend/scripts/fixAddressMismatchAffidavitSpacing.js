/**
 * Fix Address mismatch affidavit spacing:
 * - Date / DEPONENT line: use a borderless 2-cell table so gaps survive Word + docx-preview
 * - Address table: tighten cell margins / vertical padding
 * - Preserve the date comma that post-process previously stripped from tab runs
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(__dirname, '../templates/Address mismatch affidavit-.docx');

const blank = (n) => '&#160;'.repeat(n); // non-breaking spaces in XML text

const dateDeponentTable = `
<w:tbl>
  <w:tblPr>
    <w:tblW w:w="5000" w:type="pct"/>
    <w:tblBorders>
      <w:top w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:left w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:bottom w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:right w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideH w:val="none" w:sz="0" w:space="0" w:color="auto"/>
      <w:insideV w:val="none" w:sz="0" w:space="0" w:color="auto"/>
    </w:tblBorders>
    <w:tblLook w:val="04A0" w:firstRow="0" w:lastRow="0" w:firstColumn="0" w:lastColumn="0" w:noHBand="0" w:noVBand="0"/>
  </w:tblPr>
  <w:tblGrid>
    <w:gridCol w:w="7200"/>
    <w:gridCol w:w="1800"/>
  </w:tblGrid>
  <w:tr>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="7200" w:type="dxa"/>
        <w:tcMar>
          <w:top w:w="0" w:type="dxa"/>
          <w:left w:w="0" w:type="dxa"/>
          <w:bottom w:w="0" w:type="dxa"/>
          <w:right w:w="0" w:type="dxa"/>
        </w:tcMar>
      </w:tcPr>
      <w:p>
        <w:pPr>
          <w:spacing w:before="120" w:after="0"/>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
            <w:sz w:val="24"/><w:szCs w:val="24"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
            <w:sz w:val="24"/><w:szCs w:val="24"/>
          </w:rPr>
          <w:t xml:space="preserve">on this${blank(10)}day of${blank(12)}, 2026</w:t>
        </w:r>
      </w:p>
    </w:tc>
    <w:tc>
      <w:tcPr>
        <w:tcW w:w="1800" w:type="dxa"/>
        <w:tcMar>
          <w:top w:w="0" w:type="dxa"/>
          <w:left w:w="0" w:type="dxa"/>
          <w:bottom w:w="0" w:type="dxa"/>
          <w:right w:w="0" w:type="dxa"/>
        </w:tcMar>
      </w:tcPr>
      <w:p>
        <w:pPr>
          <w:spacing w:before="120" w:after="0"/>
          <w:jc w:val="right"/>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
            <w:sz w:val="24"/><w:szCs w:val="24"/>
          </w:rPr>
        </w:pPr>
        <w:r>
          <w:rPr>
            <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>
            <w:b/><w:bCs/>
            <w:sz w:val="24"/><w:szCs w:val="24"/>
          </w:rPr>
          <w:t>(DEPONENT)</w:t>
        </w:r>
      </w:p>
    </w:tc>
  </w:tr>
</w:tbl>`.replace(/\n\s*/g, '');

const zip = new PizZip(fs.readFileSync(TEMPLATE));
let xml = zip.file('word/document.xml').asText();

// Replace the deponent/date paragraph with a borderless spacing table
const deponentParaRe =
  /<w:p\b[^>]*>[\s\S]*?<w:t[^>]*>on<\/w:t>[\s\S]*?\(DEPONENT\)<\/w:t>[\s\S]*?<\/w:p>/;

if (!deponentParaRe.test(xml)) {
  console.error('Could not find deponent/date paragraph to replace');
  process.exit(1);
}

xml = xml.replace(deponentParaRe, dateDeponentTable);
console.log('Replaced deponent/date paragraph with spaced table row');

// Tighten address table cell margins (OLD/NEW ADDRESS table)
xml = xml.replace(/<w:tbl>([\s\S]*?OLD ADDRESS[\s\S]*?NEW ADDRESS[\s\S]*?<\/w:tbl>)/, (full) => {
  let t = full;
  // Ensure tblPr has compact cell margins
  if (!/<w:tblCellMar>/.test(t)) {
    t = t.replace(
      /(<w:tblPr>)([\s\S]*?)(<\/w:tblPr>)/,
      `$1$2<w:tblCellMar>
        <w:top w:w="60" w:type="dxa"/>
        <w:left w:w="80" w:type="dxa"/>
        <w:bottom w:w="60" w:type="dxa"/>
        <w:right w:w="80" w:type="dxa"/>
      </w:tblCellMar>$3`.replace(/\n\s*/g, '')
    );
  }

  // Remove fixed/min row heights if any; keep auto
  t = t.replace(/<w:trHeight[^/]*\/>/g, '');

  // Reduce paragraph spacing inside address cells
  t = t.replace(/<w:pPr>/g, '<w:pPr><w:spacing w:before="40" w:after="40"/>');
  // Avoid double spacing tags if already present after our inject — clean duplicates lightly
  t = t.replace(
    /(<w:pPr>)<w:spacing[^/]*\/>\s*<w:spacing[^/]*\/>/g,
    '$1<w:spacing w:before="40" w:after="40"/>'
  );

  return t;
});
console.log('Tightened OLD/NEW ADDRESS table cell spacing');

zip.file('word/document.xml', xml);

const outFixed = path.join(__dirname, '../templates/Address mismatch affidavit-_fixed.docx');
const buffer = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outFixed, buffer);
console.log('Saved fixed copy:', outFixed);

try {
  fs.writeFileSync(TEMPLATE, buffer);
  console.log('Updated original:', TEMPLATE);
} catch (err) {
  console.warn('Could not overwrite original (file locked?). Close Word and copy the _fixed file over it.');
  console.warn(err.message);
}

// Verify fixed copy
const verify = new PizZip(fs.readFileSync(outFixed));
const vxml = verify.file('word/document.xml').asText();
console.log('Has date table text:', vxml.includes('day of') && vxml.includes('(DEPONENT)'));
console.log('Has nbsp blanks:', /&#160;|\u00A0/.test(vxml));
console.log('Comma after day of:', /day of[\s\S]{0,80}, 2026/.test(vxml));
console.log('Old tab deponent para gone:', !/<w:t>on<\/w:t>[\s\S]{0,200}<w:tab\/>/.test(vxml));
