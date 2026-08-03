const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { balance, fixDocumentXml } = require('./fixAnnexureETemplate');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
let xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();

function step(label, fn) {
  const before = balance(xml);
  const next = fn(xml);
  const after = balance(next);
  const changed = next !== xml;
  xml = next;
  console.log(
    label,
    changed ? 'matched' : 'no-match',
    before,
    '->',
    after,
    after !== before ? `(d ${after - before})` : ''
  );
}

const OPENING_LH_RUN =
  '<w:r w:rsidR="000A7954" w:rsidRPr="00BA6A1A"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/><w:shd w:val="clear" w:color="auto" w:fill="FFFFFF"/></w:rPr>';

step('proof', (x) => x.replace(/<w:proofErr[^>]*\/>/g, ''));
step('certH1', (x) =>
  x.replace(
    /<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]*?<w:t>\[Name as per Certificate H1\]<\/w:t>/g,
    '<w:r w:rsidR="00B1333A"><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:cs="Helvetica"/><w:b/></w:rPr><w:t>[Name as per Certificate H1]</w:t></w:r>'
  )
);
step('relC1', (x) =>
  x.replace(
    /<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased C1]<\/w:t>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C1]</w:t></w:r>'
  )
);
step('relC2', (x) =>
  x.replace(
    /<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]*?<w:t(?: xml:space="preserve")?> C2]<\/w:t>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C2]</w:t></w:r>'
  )
);
step('relC3', (x) =>
  x.replace(
    /<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]*?<w:t(?: xml:space="preserve")?> C3]<\/w:t>/g,
    '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C3]</w:t></w:r>'
  )
);
step('company', (x) =>
  x.replace(
    /<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]*?<w:t>Company Name]<\/w:t>/g,
    '<w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t>[Company Name]</w:t></w:r>'
  )
);
step('LH5', (x) =>
  x.replace(
    /\[Name as per <\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t xml:space="preserve"> LH5\]<\/w:t><\/w:r>/g,
    '[Name as per Aadhar LH5]</w:t></w:r>'
  )
);
for (let n = 6; n <= 9; n++) {
  step('LH' + n + ' open', (x) =>
    x.replace(
      new RegExp(
        `<w:t xml:space="preserve">, \\[Name as per </w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t>Aadhar</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `${OPENING_LH_RUN}<w:t xml:space="preserve">, [Name as per Aadhar LH${n}]</w:t></w:r>`
    )
  );
}
step('LH10 open', (x) =>
  x.replace(
    /<w:t xml:space="preserve"> &amp; \[Name as per <\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t xml:space="preserve"> LH10<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,250}?<w:t>\]<\/w:t><\/w:r>/g,
    `${OPENING_LH_RUN}<w:t xml:space="preserve"> &amp; [Name as per Aadhar LH10]</w:t></w:r>`
  )
);
for (let n = 5; n <= 10; n++) {
  step('LH' + n + ' table', (x) =>
    x.replace(
      new RegExp(
        `<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t></w:r>`
    )
  );
}
for (let n = 6; n <= 10; n++) {
  step('LH' + n + ' sig', (x) =>
    x.replace(
      new RegExp(
        `<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00BA6A1A"[\\s\\S]{0,250}?<w:t>\\]</w:t></w:r>`,
        'g'
      ),
      `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t></w:r>`
    )
  );
}
step('cert block', (x) =>
  x.replace(
    /<w:r w:rsidR="00EF71E3" w:rsidRPr="00BA6A1A">[\s\S]{0,120}?<w:t xml:space="preserve">, \[Name as per <\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,2000}?<w:t>H4\]<\/w:t><\/w:r>/g,
    ''
  )
);
step('dcH3', (x) =>
  x.replace(
    /<w:r[^>]*>[\s\S]{0,400}?<w:t>\[Name as per DC H<\/w:t><\/w:r><w:r w:rsidR="000709AA"[\s\S]{0,400}?<w:t>3<\/w:t><\/w:r><w:r w:rsidR="00DC19B7"[\s\S]{0,400}?<w:t xml:space="preserve">\] on <\/w:t><\/w:r>/g,
    '<w:r w:rsidR="00DC19B7" w:rsidRPr="00BA6A1A"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t xml:space="preserve">[Name as per DC H3] on </w:t></w:r>'
  )
);
step('c3', (x) =>
  x.replace(
    /\[Name as per Aadhar C<\/w:t><\/w:r><w:r w:rsidR="0078711B"[\s\S]{0,400}?<w:t>3\]<\/w:t><\/w:r>/g,
    '[Name as per Aadhar C3]</w:t></w:r>'
  )
);
step('addr contact', (x) =>
  x
    .replace(
      /\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>([\s\S]*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g,
      '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>'
    )
    .replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]')
);
for (let n = 6; n <= 10; n++) {
  step('addr LH' + n, (x) =>
    x.replace(
      new RegExp(
        `\\[Address LH${n}<\\/w:t><\\/w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,250}?<w:t>\\]<\\/w:t><\\/w:r>`,
        'g'
      ),
      `[Address LH${n}]</w:t></w:r>`
    )
  );
  step('rel LH' + n, (x) =>
    x.replace(
      new RegExp(
        `\\[Relation LH<\\/w:t><\\/w:r><w:r>[\\s\\S]{0,200}?<w:t>${n}<\\/w:t><\\/w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,200}?<w:t>\\]<\\/w:t><\\/w:r>`,
        'g'
      ),
      `[Relation LH${n}]</w:t></w:r>`
    )
  );
}
step('double close cleanup', (x) => x.replace(/<\/w:t><\/w:r><\/w:r>/g, '</w:t></w:r>'));
console.log('FINAL', balance(xml));
console.log('full fixDocumentXml', balance(fixDocumentXml(new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText())));
