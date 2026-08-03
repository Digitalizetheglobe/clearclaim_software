const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { balance } = require('./fixAnnexureETemplate');

let xml = new PizZip(
  fs.readFileSync(path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx'))
).files['word/document.xml'].asText();

xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');

function step(name, fn) {
  const before = xml;
  const b = balance(xml);
  xml = fn(xml);
  console.log(name, b, '->', balance(xml), 'changed', before !== xml);
}

step('certH1', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,400}?<w:t>\[Name as per Certificate H1\]<\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00B1333A"><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:cs="Helvetica"/><w:b/></w:rPr><w:t>[Name as per Certificate H1]</w:t></w:r>'
  )
);
step('relC1', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased C1]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C1]</w:t></w:r>'
  )
);
step('relC2', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]{0,400}?<w:t(?: xml:space="preserve")?> C2]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C2]</w:t></w:r>'
  )
);
step('relC3', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]{0,400}?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]{0,400}?<w:t(?: xml:space="preserve")?> C3]<\/w:t><\/w:r>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C3]</w:t></w:r>'
  )
);
step('company', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]{0,400}?<w:t>Company Name]<\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t>[Company Name]</w:t></w:r>'
  )
);

// count how many times each pattern matches on original
const orig = new PizZip(
  fs.readFileSync(path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx'))
)
  .files['word/document.xml'].asText()
  .replace(/<w:proofErr[^>]*\/>/g, '');
const patterns = {
  certH1:
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,400}?<w:t>\[Name as per Certificate H1\]<\/w:t><\/w:r>/g,
  company:
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]{0,400}?<w:t>Company Name]<\/w:t><\/w:r>/g,
};
for (const [k, re] of Object.entries(patterns)) {
  console.log(k, 'match count', [...orig.matchAll(re)].length);
}
