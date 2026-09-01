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

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

assert(isSelectableTemplateFile('IndemnityBond_IEPF_Single Claimant.docx'), 'select single');
assert(isSelectableTemplateFile('IndemnityBond_IEPF_Multiple Claimant.docx'), 'select multiple');
assert(
  toDisplayTemplateName('IndemnityBond_IEPF_Single Claimant.docx') ===
    'Indemnity Bond IEPF - Single Claimant',
  'single display name'
);
assert(
  toDisplayTemplateName('IndemnityBond_IEPF_Multiple Claimant.docx') ===
    'Indemnity Bond IEPF - Multiple Claimant',
  'multiple display name'
);
assert(
  toPopulatedDownloadName('IndemnityBond_IEPF_Single Claimant.docx') ===
    'IndemnityBond_IEPF_Single Claimant_Populated.docx',
  'single download name'
);

const xmlText = (buf) => new PizZip(buf).files['word/document.xml'].asText();
const plain = (xml) =>
  [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

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
  doc.setData(data);
  doc.render();
  const outZip = doc.getZip();
  postProcessDocxZip(outZip);
  const outXml = xmlText(outZip.generate({ type: 'nodebuffer' }));
  return { tags, text: plain(outXml), xml: outXml };
};

const baseData = {
  'Company Name': 'ACME LIMITED',
  'Total Shares': '150',
  'Total Dividend Amount': '12500',
  'Financial Dividend Year': '2015-2016',
  'Name as per PAN C1': 'Ram Kumar',
  'Father Name C1': 'Suresh Kumar',
};

const requiredTags = [
  'Company Name',
  'Total Shares',
  'Total Dividend Amount',
  'Financial Dividend Year',
  'Name as per PAN C1',
  'Father Name C1',
];

const single = renderTemplate('IndemnityBond_IEPF_Single Claimant.docx', baseData);
requiredTags.forEach((tag) => {
  assert(single.tags.includes(tag), `single missing tag ${tag}: ${single.tags.join(', ')}`);
  assert(!single.text.includes(`[${tag}]`), `single leftover [${tag}]`);
});
assert(single.text.includes('12500'), 'single dividend amount');
assert(single.text.includes('150'), 'single share count');
assert(single.text.includes('2015-2016'), 'single financial year');
assert(/CIN\/\s*BCIN\s*\)\s*ACME LIMITED/i.test(single.text), `company after BCIN: ${single.text}`);
assert(!/2015-2016\s+ACME LIMITED\s+from/i.test(single.text), 'company should not sit on the FY line');
assert(/Authority,\s*I\s*Ram Kumar/i.test(single.text), `claimant after I: ${single.text}`);
assert(!/Ram Kumar\s+out of/i.test(single.text), 'claimant should not sit before out of');
assert(/son of\s*Suresh Kumar/i.test(single.text), 'single father name');
assert(!/Rsand|sharesbeing|amountand|Ison/i.test(single.text), 'single glued wording');
assert(!/<w:br[^>]*w:type="column"/i.test(single.xml), 'single has no column breaks');
assert(
  /Rs\s*12500[\s\S]{0,120}shares\s*150[\s\S]{0,80}being the amount/i.test(single.text),
  `Rs/shares/being stay together: ${single.text}`
);
const paraPlain = (paraXml) =>
  [...paraXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((x) => x[1])
    .join(' ')
    .replace(/\s+/g, ' ');
const bodyParas = [...single.xml.matchAll(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g)].filter((m) =>
  /In\s+consideration\s+of\s+the\s+payment/i.test(paraPlain(m[0]))
);
assert(bodyParas.length === 1, `bond body should be one paragraph, got ${bodyParas.length}`);
assert(
  /lawfully discharge/i.test(paraPlain(bodyParas[0][0])),
  'merged body includes the closing indemnity sentence'
);

const multiData = {
  ...baseData,
  'Name as per PAN C2': 'Sita Devi',
  'Father Name C2': 'Mohan Lal',
  'Name as per PAN C3': 'Lakshman Rao',
  'Father Name C3': 'Hari Rao',
};
const multi = renderTemplate('IndemnityBond_IEPF_Multiple Claimant.docx', multiData);
['Name as per PAN C2', 'Name as per PAN C3', 'Father Name C2', 'Father Name C3'].forEach((tag) => {
  assert(multi.tags.includes(tag), `multiple missing tag ${tag}`);
  assert(!multi.text.includes(`[${tag}]`), `multiple leftover [${tag}]`);
});
assert(/CIN\/\s*BCIN\s*\)\s*ACME LIMITED/i.test(multi.text), 'multiple company after BCIN');
assert(
  /I\s*Ram Kumar\s*&\s*Sita Devi\s*&\s*Lakshman Rao/i.test(multi.text),
  `multiple claimants after I: ${multi.text}`
);
assert(
  /son\s*\/\s*daughter of\s*Suresh Kumar\s*&\s*son\s*\/\s*daughter of\s*Mohan Lal\s*&\s*son\s*\/\s*daughter of\s*Hari Rao\s+respectively/i.test(
    multi.text
  ),
  `multiple fathers joined: ${multi.text}`
);

const multiC1 = renderTemplate('IndemnityBond_IEPF_Multiple Claimant.docx', baseData);
assert(/I\s*Ram Kumar/i.test(multiC1.text), 'C1-only claimant after I');
assert(!/Sita Devi|Lakshman Rao/i.test(multiC1.text), 'empty C2/C3 names omitted');
assert(/son\s*\/\s*daughter of\s*Suresh Kumar/i.test(multiC1.text), 'C1-only father kept');
assert(!/son\s*\/\s*daughter of\s*son/i.test(multiC1.text), 'empty father slots removed');
assert(!/\brespectively\b/i.test(multiC1.text), 'respectively dropped for a single father');
assert(!/\[[^\]]+\]/.test(multiC1.text), `C1-only leftover tags in ${multiC1.text}`);
assert(!/<w:br[^>]*w:type="column"/i.test(multi.xml), 'multiple has no column breaks');
assert(!/<w:br[^>]*w:type="column"/i.test(multiC1.xml), 'C1-only has no column breaks');

console.log('IEPF indemnity bond mapping tests passed');
