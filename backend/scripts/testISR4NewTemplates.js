const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const InspectModule = require('docxtemplater/js/inspect-module.js');
const {
  sanitizeTemplateZip,
  postProcessDocxZip,
  isSelectableTemplateFile,
  toDisplayTemplateName,
  toPopulatedDownloadName,
} = require('../src/utils/templateDocumentUtils');
const {
  applyShareCertificateMappings,
  applyNameAsPerCertFallbacks,
  resolveNameAsPerCert,
} = require('../src/utils/shareCertificateMapping');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

assert(isSelectableTemplateFile('Form ISR-4 - SEBI Format_Template.DOCX'), 'select .DOCX');
assert(isSelectableTemplateFile('Form ISR-4_Transposition.docx'), 'select transposition');
assert(!isSelectableTemplateFile('~$ISR-4_Template.docx'), 'skip lock file');
assert(
  toDisplayTemplateName('Form ISR-4 - SEBI Format_Template.DOCX') === 'Form ISR-4 - SEBI Format',
  'SEBI display name'
);
assert(
  toDisplayTemplateName('Form ISR-4_Transposition.docx') === 'Form ISR-4 Transposition',
  'transposition display name'
);
assert(
  toPopulatedDownloadName('Form ISR-4 - SEBI Format_Template.DOCX') ===
    'Form ISR-4 - SEBI Format_Populated.docx',
  'SEBI download name'
);
assert(
  toPopulatedDownloadName('Form ISR-4_Transposition.docx') ===
    'Form ISR-4_Transposition_Populated.docx',
  'transposition download name'
);

const mapped = applyShareCertificateMappings({
  SC1: 'CERT-1',
  SC11: 'CERT-11',
  SC13: 'CERT-13',
  DN1: '1-100',
  DN11: '1001-1100',
  DN13: '1301-1400',
});
assert(mapped.SC11 === 'CERT-11', 'SC11 mapped');
assert(mapped.SC13 === 'CERT-13', 'SC13 mapped');
assert(
  mapped['Certificate numbers'] === 'CERT-1, CERT-11, CERT-13',
  `combined certs: ${mapped['Certificate numbers']}`
);
assert(
  mapped['Distinctive numbers'] === '1-100, 1001-1100, 1301-1400',
  `combined DNs: ${mapped['Distinctive numbers']}`
);

assert(
  resolveNameAsPerCert({ 'Name as per Aadhar C1': 'Ram Kumar' }, 1) === 'Ram Kumar',
  'cert fallback to Aadhar'
);
const names = applyNameAsPerCertFallbacks({
  'Name as per Aadhar C1': 'Ram Kumar',
  'Name as per Cert C2': 'Sita Devi',
});
assert(names['Name as per Cert C1'] === 'Ram Kumar', 'C1 cert from Aadhar');
assert(names['Name as per Cert C2'] === 'Sita Devi', 'C2 cert kept');

const xmlText = (buf) => new PizZip(buf).files['word/document.xml'].asText();
const plain = (xml) =>
  [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');

const renderTemplate = (fileName, data) => {
  const full = path.join(__dirname, '../templates', fileName);
  assert(fs.existsSync(full), `missing template ${fileName}`);
  const zip = new PizZip(fs.readFileSync(full));
  sanitizeTemplateZip(zip, { templateName: fileName });
  const iModule = new InspectModule();
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' },
    modules: [iModule],
    nullGetter: () => '',
  });
  const tags = Object.keys(iModule.getAllTags());
  const mappedData = applyNameAsPerCertFallbacks(applyShareCertificateMappings({ ...data }));
  doc.setData(mappedData);
  doc.render();
  const outZip = doc.getZip();
  postProcessDocxZip(outZip);
  const outXml = xmlText(outZip.generate({ type: 'nodebuffer' }));
  return { tags, text: plain(outXml), xml: outXml };
};

const sebiData = {
  'Company Name': 'ACME LIMITED',
  'Folio No': 'F12345',
  'Face Value': '10',
  'Total Shares': '150',
  SC1: 'CERT-1',
  SC11: 'CERT-11',
  SC13: 'CERT-13',
  DN1: '1-100',
  DN11: '1001-1100',
  DN13: '1301-1400',
  'Name as per Aadhar C1': 'Ram Kumar',
  'PAN C1': 'ABCDE1234F',
  'Address C1': '12 MG Road, Pune',
  'PIN C1': '411001',
  'Aadhar C1': '123412341234',
  'DEMAT AC C1': '1234567890123456',
};

const sebi = renderTemplate('Form ISR-4 - SEBI Format_Template.DOCX', sebiData);
assert(sebi.tags.includes('SC11'), 'SEBI has SC11 tag');
assert(sebi.tags.includes('SC13'), 'SEBI has SC13 tag');
assert(sebi.tags.includes('DN13'), 'SEBI has DN13 tag');
assert(sebi.text.includes('CERT-11'), 'SEBI populated SC11');
assert(sebi.text.includes('CERT-13'), 'SEBI populated SC13');
assert(sebi.text.includes('1301-1400'), 'SEBI populated DN13');
assert(!sebi.text.includes('[SC11]'), 'SEBI leftover SC11');
assert(!sebi.text.includes('[SC13]'), 'SEBI leftover SC13');
assert(sebi.text.includes('ACME LIMITED'), 'SEBI company name');

const transData = {
  ...sebiData,
  SC1: '12345',
  SC2: '67890',
  DN1: '1-100',
  DN2: '101-200',
  'Total Shares': '300',
  'Face Value': '10',
  'Name as per Cert C2': 'Sita Devi',
  'Name as per Aadhar C3': 'Lakshman Rao',
};
const trans = renderTemplate('Form ISR-4_Transposition.docx', transData);
assert(trans.tags.includes('Name as per Cert C1'), 'transposition Cert C1 tag');
assert(trans.text.includes('Ram Kumar'), 'transposition C1 from Aadhar');
assert(trans.text.includes('Sita Devi'), 'transposition C2 from Cert');
assert(trans.text.includes('Lakshman Rao'), 'transposition C3 from Aadhar');
assert(!trans.text.includes('[Name as per Cert C1]'), 'transposition leftover Cert C1');
assert(trans.text.includes('12345'), 'transposition SC1 kept after post-process');
assert(trans.text.includes('67890'), 'transposition SC2 kept after post-process');
assert(trans.text.includes('1-100'), 'transposition DN1 kept after post-process');
assert(trans.text.includes('300'), 'transposition total shares kept');
assert(/Rs\.?\s*10/.test(trans.text), 'transposition face value kept');
assert(!/Holder1/.test(trans.text), 'Joint Holder1 typo fixed');
const sectionCTables = [...trans.xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].filter((t) => {
  const p = [...t[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  return /Certificate\s*Numbers/i.test(p) && /Name of the Company/i.test(p);
});
assert(sectionCTables.length === 1, `Section C is one table, got ${sectionCTables.length}`);

const holderTableCols = (xml) => {
  const table = [...xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].find((t) =>
    /Security\s+Holder\s+1/i.test(
      [...t[0].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join(' ')
    )
  );
  if (!table) return [];
  const header = [...table[0].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)][0];
  const cells = [...header[1].matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
  return cells.map((c) =>
    [...c[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim()
  );
};

assert(
  holderTableCols(trans.xml).some((c) => /Security\s+Holder\s+3/i.test(c)),
  'C3 present keeps Security Holder 3 column'
);

const transNoC3 = renderTemplate('Form ISR-4_Transposition.docx', {
  ...sebiData,
  SC1: '12345',
  DN1: '1-100',
  'Total Shares': '300',
  'Face Value': '10',
  'Name as per Aadhar C2': 'Sita Devi',
  'Name as per Cert C2': 'Sita Devi',
});
const noC3Cols = holderTableCols(transNoC3.xml);
assert(
  noC3Cols.some((c) => /Security\s+Holder\s+1/i.test(c)),
  'C1 column kept when C3 empty'
);
assert(
  noC3Cols.some((c) => /Security\s+Holder\s+2/i.test(c)),
  'C2 column kept when C3 empty'
);
assert(
  !noC3Cols.some((c) => /Security\s+Holder\s+3/i.test(c)),
  `Security Holder 3 column hidden when C3 empty, cols=${JSON.stringify(noC3Cols)}`
);
assert(!/Lakshman Rao/.test(transNoC3.text), 'no C3 name in empty-C3 render');
assert(
  !/Joint\s*Holder\s*\(\s*3\s*\)/i.test(transNoC3.text.replace(/\s+/g, ' ')),
  'empty Joint Holder (3) row removed'
);

const templatesDir = path.join(__dirname, '../templates');
const listed = fs.readdirSync(templatesDir).filter(isSelectableTemplateFile);
assert(
  listed.some((f) => f.toLowerCase() === 'form isr-4 - sebi format_template.docx'),
  'listing includes SEBI Format'
);
assert(
  listed.some((f) => f.toLowerCase() === 'form isr-4_transposition.docx'),
  'listing includes Transposition'
);

console.log('ISR-4 SEBI Format + Transposition mapping tests passed');
