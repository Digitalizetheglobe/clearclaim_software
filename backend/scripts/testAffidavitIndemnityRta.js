const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');
const {
  sanitizeTemplateZip,
  fixAffidavitCumIndemnityPlaceholders,
} = require('../src/utils/templateDocumentUtils');
const { applyCanonicalRtaName } = require('../src/utils/rtaFieldMapping');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const converted = fixAffidavitCumIndemnityPlaceholders(
  '<w:t>[RTA Name] / [Company Name] [Name of the Company/RTA]</w:t>'
);
assert(converted.includes('(Name of the Company/RTA)'), 'convert instructional tag to parens');
assert(!converted.includes('[Name of the Company/RTA]'), 'no leftover instructional tag');

const face = fixAffidavitCumIndemnityPlaceholders('<w:t>[Face Value ]</w:t>');
assert(face.includes('[Face Value]'), 'trim Face Value');
assert(!face.includes('[Face Value ]'), 'no padded Face Value tag');

const composed = applyCanonicalRtaName({
  RTA: 'KFIN Technologies Pvt. Ltd',
  'Company Name': 'IDBI Bank Ltd',
});
assert(
  composed['Name of the Company/RTA'] === 'KFIN Technologies Pvt. Ltd / IDBI Bank Ltd',
  'composed company/RTA label'
);

const fileName = 'Affidavit Cum Indemnity Bond_Trans_Single Claimant.docx';
const zip = new PizZip(fs.readFileSync(path.join(__dirname, '../templates', fileName)));
sanitizeTemplateZip(zip, { templateName: fileName });
const iModule = new InspectModule();
const doc = new Docxtemplater(zip, {
  delimiters: { start: '[', end: ']' },
  modules: [iModule],
  nullGetter: () => '',
});
const tags = Object.keys(iModule.getAllTags());
assert(tags.includes('RTA Name'), 'RTA Name tag');
assert(tags.includes('Company Name'), 'Company Name tag');
assert(tags.includes('Face Value'), 'Face Value without trailing space');
assert(!tags.includes('Face Value '), 'padded Face Value gone');
assert(
  !tags.some((t) => /name of the company/i.test(t)),
  'instructional company/RTA is not a tag'
);
assert(
  !tags.some((t) => /for issuance of duplicate/i.test(t)),
  'title note is not a tag'
);

doc.setData({
  'RTA Name': 'KFIN Technologies Pvt. Ltd',
  'Company Name': 'IDBI Bank Ltd',
  'Face Value': '10',
  'Name as per Aadhar C1': 'Test Person',
});
doc.render();
const xml = doc.getZip().files['word/document.xml'].asText();
const plain = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1].replace(/&amp;/g, '&'))
  .join('');
const point7 = plain.match(/jointly and severely[\s\S]{0,280}/i);
assert(point7, 'point 7 present');
assert(
  /KFIN Technologies Pvt\. Ltd\s*\/\s*IDBI Bank Ltd/i.test(point7[0]),
  `point 7 company/RTA, got: ${point7[0].replace(/\s+/g, ' ')}`
);
assert(!plain.includes('[Name of the Company/RTA]'), 'populated leftover tag');
assert(plain.includes('(Name of the Company/RTA)'), 'instructional parens kept');
assert(plain.includes('10'), 'face value populated');
assert(plain.includes('For issuance of duplicate securities'), 'title note kept');

console.log('Affidavit Cum Indemnity Trans Single tests passed');
