const fs = require('fs');
const PizZip = require('pizzip');

const content = fs.readFileSync('templates/Annexure-F (Noc from other legal heirs)_Template.docx', 'binary');
const zip = new PizZip(content);
const xml = zip.file('word/document.xml').asText();

const getParagraphText = (p) => {
  const texts = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = tRegex.exec(p))) { texts.push(match[1]); }
  return texts.join('').trim();
};

const pRegex = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g;
let match;
const allTexts = [];
while ((match = pRegex.exec(xml))) {
    allTexts.push(getParagraphText(match[1]));
}
fs.writeFileSync('paras.json', JSON.stringify(allTexts, null, 2));
