const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const buf = fs.readFileSync(templatePath);
const zip = new PizZip(buf);
let xml = zip.files['word/document.xml'].asText();

function tryCompile(label) {
  zip.file('word/document.xml', xml);
  try {
    new Docxtemplater(new PizZip(zip.generate({ type: 'nodebuffer' })), { delimiters: { start: '[', end: ']' } });
    console.log(label, 'OK', xml.length);
    return true;
  } catch (e) {
    console.log(label, 'FAIL', e.properties?.errors?.[0]?.properties?.explanation || e.message);
    const openR = (xml.match(/<w:r[\s>]/g) || []).length;
    const closeR = (xml.match(/<\/w:r>/g) || []).length;
    console.log('w:r balance', openR, closeR);
    return false;
  }
}

const steps = [];

steps.push(['proof', (x) => x.replace(/<w:proofErr[^>]*\/>/g, '')]);
steps.push(['certH1', (x) => x.replace(/<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]*?<w:t>\[Name as per Certificate H1\]<\/w:t>/g, '<w:r w:rsidR="00B1333A"><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:cs="Helvetica"/><w:b/></w:rPr><w:t>[Name as per Certificate H1]</w:t>')]);
steps.push(['rel', (x) => {
  let r = x;
  r = r.replace(/<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased C1]<\/w:t>/g, '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C1]</w:t>');
  r = r.replace(/<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]*?<w:t(?: xml:space="preserve")?> C2]<\/w:t>/g, '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C2]</w:t>');
  r = r.replace(/<w:t>\[<\/w:t><\/w:r><w:r w:rsidRPr="00D873C4">[\s\S]*?<w:t>Relation with Deceased<\/w:t><\/w:r><w:r w:rsidRPr="00B52A9C">[\s\S]*?<w:t(?: xml:space="preserve")?> C3]<\/w:t>/g, '<w:r w:rsidRPr="00D873C4"><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial" w:cs="Arial"/><w:b/></w:rPr><w:t>[Relation with Deceased C3]</w:t>');
  return r;
}]);
steps.push(['company', (x) => x.replace(/<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954">[\s\S]*?<w:t>Company Name]<\/w:t>/g, '<w:r w:rsidR="00EF71E3" w:rsidRPr="000A7954"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t>[Company Name]</w:t>')]);
steps.push(['LH5 open', (x) => x.replace(/<w:t xml:space="preserve">, \[Name as per <\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="00A424D0"[\s\S]{0,350}?<w:t xml:space="preserve"> LH5\]<\/w:t>/g, '<w:t xml:space="preserve">, [Name as per Aadhar LH5]</w:t>')]);

for (let n = 6; n <= 9; n++) {
  steps.push([`LH${n} open`, (x) => x.replace(new RegExp(`<w:t xml:space="preserve">, \\[Name as per </w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t>Aadhar</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,350}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidR="000A7954"[\\s\\S]{0,250}?<w:t>\\]</w:t>`, 'g'), `<w:t xml:space="preserve">, [Name as per Aadhar LH${n}]</w:t>`)]);
}
steps.push(['LH10 open', (x) => x.replace(/<w:t xml:space="preserve"> &amp; \[Name as per <\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t>Aadhar<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,350}?<w:t xml:space="preserve"> LH10<\/w:t><\/w:r><w:r w:rsidR="000A7954"[\s\S]{0,250}?<w:t>\]<\/w:t>/g, '<w:t xml:space="preserve"> &amp; [Name as per Aadhar LH10]</w:t>')]);

for (let n = 5; n <= 10; n++) {
  steps.push([`LH${n} table`, (x) => x.replace(new RegExp(`<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Arial[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00B52A9C"[\\s\\S]{0,250}?<w:t>\\]</w:t>`, 'g'), `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t>`)]);
}

for (let n = 6; n <= 10; n++) {
  steps.push([`LH${n} sig`, (x) => x.replace(new RegExp(`<w:t xml:space="preserve">\\[Name as per </w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t>Aadhar</w:t></w:r><w:r><w:rPr>[\\s\\S]{0,250}?Bahnschrift[\\s\\S]{0,250}?<w:t xml:space="preserve"> LH${n}</w:t></w:r><w:r w:rsidRPr="00BA6A1A"[\\s\\S]{0,250}?<w:t>\\]</w:t>`, 'g'), `<w:t xml:space="preserve">[Name as per Aadhar LH${n}]</w:t>`)]);
}

steps.push(['cert block', (x) => x.replace(/<w:r w:rsidR="00EF71E3" w:rsidRPr="00BA6A1A">[\s\S]{0,120}?<w:t xml:space="preserve">, \[Name as per <\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]{0,2000}?<w:t>H4\]<\/w:t><\/w:r>/g, '')]);
steps.push(['dcH3', (x) => x.replace(/<w:t>\[Name as per DC H<\/w:t><\/w:r><w:r w:rsidR="000709AA"[\s\S]{0,400}?<w:t>3<\/w:t><\/w:r><w:r w:rsidR="00DC19B7"[\s\S]{0,400}?<w:t xml:space="preserve">\] on <\/w:t><\/w:r>/g, '<w:r w:rsidR="00DC19B7" w:rsidRPr="00BA6A1A"><w:rPr><w:rFonts w:ascii="Bahnschrift" w:hAnsi="Bahnschrift" w:cstheme="minorHAnsi"/><w:b/></w:rPr><w:t xml:space="preserve">[Name as per DC H3] on </w:t></w:r>')]);
steps.push(['c3', (x) => x.replace(/\[Name as per Aadhar C<\/w:t><\/w:r><w:r w:rsidR="0078711B"[\s\S]{0,400}?<w:t>3\]<\/w:t><\/w:r>/g, '[Name as per Aadhar C3]</w:t></w:r>')]);
steps.push(['witness', (x) => x.replace(/<w:t>#, have<\/w:t>/g, '<w:t>[Claimant Names], have</w:t>')]);
steps.push(['cert combine', (x) => x.replace(/, \[Name as per Certificate H2\], \[Name as per Certificate H3\], \[Name as per Certificate H4\]/g, '').replace(/\[Name as per Certificate H1\]/g, '[Deceased Names Certificate]')]);
steps.push(['addr', (x) => x.replace(/\[Address (C\d+|LH\d+)\]<\/w:t><\/w:r>([\s\S]*?)<w:t[^>]*>\[Mobile No \1\]<\/w:t>/g, '[Address Contact $1]</w:t></w:r>$2<w:t></w:t>').replace(/\[Address (?!Contact )(C\d+|LH\d+)\]/g, '[Address Contact $1]')]);

let requireOk = false;
for (const [name, fn] of steps) {
  xml = fn(xml);
  const ok = tryCompile(name);
  if (name === 'certH1') requireOk = true;
  if (requireOk && !ok) process.exit(1);
}

console.log('ALL OK');
