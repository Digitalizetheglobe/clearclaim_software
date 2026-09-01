const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');

function mergeAadharLH(xml, n) {
  const re = new RegExp(
    `\\[Name as per </w:t></w:r>([\\s\\S]{0,1200}?)<w:t>Aadhar</w:t></w:r>([\\s\\S]{0,600}?)<w:t(?: xml:space="preserve")?> LH${n}(?:\\]</w:t>|</w:t></w:r>([\\s\\S]{0,500}?)<w:t>)\\](</w:t>)`,
    'g'
  );
  return xml.replace(re, `<w:r><w:t>[Name as per Aadhar LH${n}]</w:t></w:r>`);
}

let xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();
xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');
xml = xml.replace(
  /<w:t>\[<\/w:t><\/w:r><w:r w:rsidR="00B1333A">[\s\S]*?<w:t>\[Name as per Certificate H1\]<\/w:t>/g,
  '<w:r w:rsidR="00B1333A"><w:rPr><w:rFonts w:ascii="Helvetica" w:hAnsi="Helvetica" w:cs="Helvetica"/><w:b/></w:rPr><w:t>[Name as per Certificate H1]</w:t>'
);
xml = mergeAadharLH(xml, 5);

const re6 = new RegExp(
  `\\[Name as per </w:t></w:r>([\\s\\S]{0,1200}?)<w:t>Aadhar</w:t></w:r>([\\s\\S]{0,600}?)<w:t(?: xml:space="preserve")?> LH6(?:\\]</w:t>|</w:t></w:r>([\\s\\S]{0,500}?)<w:t>)\\](</w:t>)`,
  'g'
);
const matches = [...xml.matchAll(re6)];
console.log('LH6 matches:', matches.length);
matches.forEach((m, i) => {
  console.log('match', i, 'len', m[0].length);
  console.log(m[0].slice(0, 200));
  console.log('...');
  console.log(m[0].slice(-200));
});

const after = mergeAadharLH(xml, 6);
const idx = after.indexOf('[Name as per Aadhar LH6]');
console.log('\ncontext after LH6 fix:');
console.log(after.slice(idx - 150, idx + 200));

// count w:r vs w:t imbalance
const openR = (after.match(/<w:r[\s>]/g) || []).length;
const closeR = (after.match(/<\/w:r>/g) || []).length;
console.log('w:r open', openR, 'close', closeR);
