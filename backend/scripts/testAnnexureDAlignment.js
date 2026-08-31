const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { postProcessDocumentXml } = require('../src/utils/templateDocumentUtils');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const templatesDir = path.join(__dirname, '../templates');
const loadXml = (name) =>
  new PizZip(fs.readFileSync(path.join(templatesDir, name))).files['word/document.xml'].asText();

const deponentPara = (xml) => {
  const re = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*do hereby solemnly affirm[\s\S]*?<\/w:p>/i;
  return xml.match(re)?.[0] || '';
};

const affirmedAtPara = (xml) => {
  const re = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*Solemnly affirmed at[\s\S]*?<\/w:p>/i;
  return xml.match(re)?.[0] || '';
};

const files = [
  'Annexure-D_LH2_Template.docx',
  'Annexure-D_LH4_Template.docx',
  'Annexure-D_LH5_Template.docx',
  'Annexure-D_LH7_Template.docx',
  'Annexure-D_LH8_Template.docx',
];

for (const name of files) {
  const raw = loadXml(name);
  const rawDep = deponentPara(raw);
  assert(rawDep, `${name}: deponent paragraph present`);
  assert(/<w:tab w:val="center" w:pos="142"/.test(rawDep), `${name}: fixture has 142twip center tab`);
  assert(/<w:tab\s*\/>/.test(rawDep), `${name}: fixture has leading tab`);

  const out = postProcessDocumentXml(raw);
  const dep = deponentPara(out);
  const depText = [...dep.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  assert(dep, `${name}: deponent paragraph kept`);
  assert(!/w:pos="142"/.test(dep), `${name}: center tab at 142 removed`);
  assert(!/<w:tab\s*\/>/.test(dep), `${name}: leading tab removed`);
  assert(/do hereby solemnly affirm/i.test(dep), `${name}: opener wording kept`);
  assert(/Name as per/i.test(depText), `${name}: name placeholder kept`);
  assert(!/Heading1/i.test(dep), `${name}: not Heading1`);

  const sig = affirmedAtPara(out);
  assert(sig, `${name}: signature line kept`);
  assert(/<w:tab /.test(sig) || /<w:tab\/>/.test(sig), `${name}: signature tabs preserved`);
}

console.log('Annexure-D deponent alignment tests passed');
