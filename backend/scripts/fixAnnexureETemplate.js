/**
 * Repair Annexure-E (Indemnity Bond) template — targeted fixes only.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');

function balance(xml) {
  const o = (xml.match(/<w:r[\s>]/g) || []).length;
  const c = (xml.match(/<\/w:r>/g) || []).length;
  return o - c;
}

function fixDocumentXml(xml) {
  let result = xml;

  result = result.replace(/<w:proofErr[^>]*\/>/g, '');

  // Stray "[" before Certificate H1 (replace both runs, including opens/closes)
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,400}?<w:t>\[Name as per Certificate H1\]<\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00B1333A"><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:cs="Helvetica"/><w:b/></w:rPr><w:t>[Name as per Certificate H1]</w:t></w:r>'
  );

  // Relation with Deceased C1–C3
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased C1]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C1]</w:t></w:r>'
  );
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]{0,400}?<w:t(?: xml:space="preserve")?> C2]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C2]</w:t></w:r>'
  );
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]{0,400}?<w:t(?: xml:space="preserve")?> C3]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C3]</w:t></w:r>'
  );

  // Stray "[" before Company Name] (body text)
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]{0,400}?<w:t>Company Name]<\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t>[Company Name]</w:t></w:r>'
  );

  // Opening paragraph — split Aadhar LH5 (after LH4], uses rsid 00A424D0)
  result = result.replace(
    /\[Name as per <\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t xml:space="preserve"> LH5\]<\/w:t><\/w:r>/g,
    '[Name as per Aadhar LH5]</w:t></w:r>'
  );

  // Opening paragraph — split Aadhar LH5 (legacy pattern with leading comma)
  result = result.replace(
    /<w:t xml:space="preserve">, \[Name as per <\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t xml:space="preserve"> LH5\]<\/w:t><\/w:r>/g,
    '<w:t xml:space="preserve">, [Name as per Aadhar LH5]</w:t></w:r>'
  );

  // Opening paragraph — split Aadhar LH6–LH9 (keep existing <w:t> open; do not insert a new <w:r>)
  for (let n = 6; n <= 9; n++) {
    result = result.replace(
      new RegExp(
        `, \\[Name as per </w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t>Aadhar</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `, [Name as per Aadhar LH${n}]</w:t></w:r>`
    );
  }

  // Opening paragraph — split Aadhar LH10 (ampersand before)
  result = result.replace(
    / &amp; \[Name as per <\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t xml:space="preserve"> LH10<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,250}?<w:t>\]<\/w:t><\/w:r>/g,
    ' &amp; [Name as per Aadhar LH10]</w:t></w:r>'
  );

  // Heir details table — split "1)[Name as per Aadhar C1]" (Bahnschrift)
  result = result.replace(
    /1\)\[Name as per <\/w:t><\/w:r><w:r w:rsidRPr="00BA6A1A">[\s\S]{0,300}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidRPr="00BA6A1A">[\s\S]{0,300}?<w:t xml:space="preserve"> C1\]<\/w:t><\/w:r>/g,
    '1)[Name as per Aadhar C1]</w:t></w:r>'
  );

  // Heir details table — split Aadhar LH5–LH10 (Arial rows)
  for (let n = 5; n <= 10; n++) {
    result = result.replace(
      new RegExp(
        `<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t></w:r>`
    );
  }

  // Signature table — split Aadhar LH6–LH10 (Bahnschrift rows at document end)
  for (let n = 6; n <= 10; n++) {
    result = result.replace(
      new RegExp(
        `<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00BA6A1A"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t></w:r>`
    );
  }

  // Remove split Certificate H2–H4 block (keep H1 for combined deceased name)
  result = result.replace(
    /<w:r w:rsidR="00EF71E3" w:rsidRPr="00BA6A1A">[\s\S]{0,120}?<w:t xml:space="preserve">, \[Name as per <\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,2000}?<w:t>H4\]<\/w:t><\/w:r>/g,
    ''
  );

  // Split DC H3 (include opening run so we don't leave an orphan <w:r>)
  result = result.replace(
    /<w:r(?:\s[^>]*)?>[\s\S]{0,400}?<w:t>\[Name as per DC H<\/w:t><\/w:r><w:r w:rsidR="000709AA"[\s\S]{0,400}?<w:t>3<\/w:t><\/w:r><w:r w:rsidR="00DC19B7"[\s\S]{0,400}?<w:t xml:space="preserve">\] on <\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00DC19B7" w:rsidRPr="00BA6A1A"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t xml:space="preserve">[Name as per DC H3] on </w:t></w:r>'
  );

  // Split Aadhar C3 (witness paragraph — C3 digit in separate run)
  result = result.replace(
    /\[Name as per Aadhar C<\/w:t><\/w:r><w:r w:rsidR="0078711B"[\s\S]{0,400}?<w:t>3\]<\/w:t><\/w:r>/g,
    '[Name as per Aadhar C3]</w:t></w:r>'
  );

  result = result.replace(/<w:t>#, have<\/w:t>/g, '<w:t>[Claimant Names], have</w:t>');

  result = result.replace(
    /, \[Name as per Certificate H2\], \[Name as per Certificate H3\], \[Name as per Certificate H4\]/g,
    ''
  );
  result = result.replace(/\[Name as per Certificate H1\]/g, '[Deceased Names Certificate]');

  result = result.replace(
    /\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>([\s\S]*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g,
    '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>'
  );
  result = result.replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]');

  // Heir table — split Address LH6–LH10
  for (let n = 6; n <= 10; n++) {
    result = result.replace(
      new RegExp(
        `\\[Address LH${n}<\\/w:t><\\/w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,250}?<w:t>\\]<\\/w:t><\\/w:r>`,
        'g'
      ),
      `[Address LH${n}]</w:t></w:r>`
    );
    result = result.replace(
      new RegExp(
        `\\[Relation LH<\\/w:t><\\/w:r><w:r>[\\s\\S]{0,200}?<w:t>${n}<\\/w:t><\\/w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,200}?<w:t>\\]<\\/w:t><\\/w:r>`,
        'g'
      ),
      `[Relation LH${n}]</w:t></w:r>`
    );
  }

  // Do not strip </w:r></w:r> globally — that can unbalance valid empty-run closings
  return result;
}

module.exports = { fixDocumentXml, balance };

if (require.main === module) {
  const buf = fs.readFileSync(templatePath);
  const zip = new PizZip(buf);
  const fixed = fixDocumentXml(zip.files['word/document.xml'].asText());

  if (balance(fixed) !== 0) {
    console.error('Abort: unbalanced w:r tags, delta', balance(fixed));
    process.exit(1);
  }

  if (!fixed.includes('[NOS1]') || !fixed.includes('[Folio No]')) {
    console.error('Abort: securities placeholders missing');
    process.exit(1);
  }

  zip.file('word/document.xml', fixed);
  const out = zip.generate({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  });

  const inspector = new InspectModule();
  try {
    new Docxtemplater(new PizZip(out), {
      delimiters: { start: '[', end: ']' },
      modules: [inspector],
    });
  } catch (err) {
    console.error(
      'Invalid:',
      err.properties?.errors?.map((e) => e.properties?.explanation).join('; ') || err.message
    );
    process.exit(1);
  }

  const tags = Object.keys(inspector.getAllTags()).sort();
  console.log('Valid. Tags:', tags.length);
  fs.writeFileSync(templatePath, out);
  console.log('Saved:', templatePath);
}
