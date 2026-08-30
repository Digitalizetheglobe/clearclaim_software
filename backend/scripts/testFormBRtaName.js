const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');
const { sanitizeTemplateZip, ensureFormBRtaNamePlaceholder } = require('../src/utils/templateDocumentUtils');
const { resolveRtaName, applyCanonicalRtaName, isRtaNameFieldKey } = require('../src/utils/rtaFieldMapping');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

assert(isRtaNameFieldKey('RTA'), 'RTA key');
assert(isRtaNameFieldKey('RTA Name C1'), 'RTA Name C1 key');
assert(!isRtaNameFieldKey('RTA Address'), 'RTA Address must not map as name');
assert(resolveRtaName({ RTA: 'KFin Technologies' }) === 'KFin Technologies', 'alias RTA');
assert(resolveRtaName({ 'Registrar Name': 'Link Intime' }) === 'Link Intime', 'alias registrar');

const mapped = applyCanonicalRtaName({ rta: 'NSDL' });
assert(mapped['RTA Name'] === 'NSDL', 'canonical RTA Name');

const missingXml =
  '<w:r><w:t>[Company Name]</w:t></w:r>' +
  '<w:r><w:t xml:space="preserve"> </w:t></w:r>' +
  '<w:r><w:t>(</w:t></w:r>' +
  '<w:r><w:t>Company / RTA name)</w:t></w:r>';
const injected = ensureFormBRtaNamePlaceholder(missingXml);
assert(injected.includes('[RTA Name]'), 'inject placeholder into Point 3');
assert(/\[Company Name\].*\/.*\[RTA Name\]/.test(injected.replace(/<[^>]+>/g, '')), 'order Company / RTA');

const already =
  '<w:r><w:t>[Company Name]</w:t></w:r>' +
  '<w:r><w:t xml:space="preserve"> / </w:t></w:r>' +
  '<w:r><w:t>[RTA Name]</w:t></w:r>' +
  '<w:r><w:t xml:space="preserve"> </w:t></w:r>' +
  '<w:r><w:t>(Company / RTA name)</w:t></w:r>';
const skipped = ensureFormBRtaNamePlaceholder(already);
assert((skipped.match(/\[RTA Name\]/g) || []).length === 1, 'do not duplicate existing tag');

const files = [
  'Form-B (Indemnity)- SELF_Multiple Claimant_Template.docx',
  'Form-B (Indemnity)- SELF_Multiple_Template.docx',
  'Form-B (Indemnity)- TRANS_All_Template.docx',
  'Form-B (Indemnity)- NDEL_All_Template.docx',
  'Form-B (Indemnity)- NDEL_Single_Template.docx',
];

const xmlText = (buf) => new PizZip(buf).files['word/document.xml'].asText();
const plain = (xml) =>
  [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1].replace(/&amp;/g, '&')).join('');

files.forEach((fileName) => {
  const full = path.join(__dirname, '../templates', fileName);
  const zip = new PizZip(fs.readFileSync(full));
  sanitizeTemplateZip(zip, { templateName: fileName });
  const iModule = new InspectModule();
  const doc = new Docxtemplater(zip, {
    delimiters: { start: '[', end: ']' },
    modules: [iModule],
    nullGetter: () => '',
  });
  const tags = Object.keys(iModule.getAllTags());
  assert(tags.includes('RTA Name'), `${fileName} must expose RTA Name tag`);
  doc.setData({
    'Company Name': 'CEAT LIMITED',
    'RTA Name': 'KFin Technologies Limited',
  });
  doc.render();
  const out = plain(xmlText(doc.getZip().generate({ type: 'nodebuffer' })));
  assert(out.includes('KFin Technologies Limited'), `${fileName} populated RTA`);
  assert(!out.includes('[RTA Name]'), `${fileName} leftover RTA tag`);
  const point3 = out.match(/aforesaid[\s\S]{0,180}Company \/ RTA name/i);
  assert(point3, `${fileName} still has Point 3`);
  assert(/CEAT LIMITED\s*\/\s*KFin Technologies Limited/i.test(point3[0]), `${fileName} Point 3 company / RTA`);
});

console.log('Form-B RTA Name tests passed');
