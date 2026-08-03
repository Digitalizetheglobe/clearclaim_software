const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const xml = new PizZip(
  fs.readFileSync(path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx'))
).files['word/document.xml'].asText();

let idx = 0;
let n = 0;
while ((idx = xml.indexOf('Name as per </w:t>', idx)) !== -1 && n < 10) {
  console.log('---', n, '---');
  console.log(xml.slice(idx - 80, idx + 280));
  idx += 1;
  n += 1;
}
