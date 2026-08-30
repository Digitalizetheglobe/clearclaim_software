const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { sanitizeTemplateZip } = require('../src/utils/templateDocumentUtils');
const {
  normalizeBankAccountNumber,
  resolveBankAccountNumber,
  composeBankPostalAddress,
  mergeClaimantBankFields,
  applyCanonicalBankFields,
} = require('../src/utils/bankFieldMapping');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

assert(normalizeBankAccountNumber('1.0378921868e+10') === '10378921868', 'scientific notation');
assert(normalizeBankAccountNumber('123456789012.0') === '123456789012', 'trailing .0');
assert(
  resolveBankAccountNumber({ 'Bank Account Number C1': ' 0011223344 ' }, '1') === '0011223344',
  'alias Bank Account Number C1'
);
assert(
  resolveBankAccountNumber({ 'Bank AC': '9988776655' }, '1') === '9988776655',
  'unsuffixed Bank AC -> C1'
);

const composed = composeBankPostalAddress(
  {
    'Bank Name C2': 'HDFC Bank',
    'Bank Branch C2': 'Hinjewadi',
    'Bank City C2': 'Pune',
    'Bank PIN C2': '411057',
  },
  '2'
);
assert(
  composed === 'HDFC Bank, Hinjewadi, Pune, 411057',
  `compose address, got: ${composed}`
);
assert(
  composeBankPostalAddress({ 'Bank Address C1': '12 MG Road, Pune' }, '1') === '12 MG Road, Pune',
  'explicit bank address wins'
);

const fromClaimant = mergeClaimantBankFields({}, [
  {
    claimant_number: 1,
    bank_account_number: '555666777888',
    bank_address: 'Station Road, Nashik',
  },
]);
applyCanonicalBankFields(fromClaimant);
assert(fromClaimant['Bank AC C1'] === '555666777888', 'claimant account -> Bank AC C1');
assert(fromClaimant['Bank Address C1'] === 'Station Road, Nashik', 'claimant address -> Bank Address C1');

const xmlText = (buf) => {
  const zip = new PizZip(buf);
  return zip.files['word/document.xml'].asText();
};

const renderIsr2 = (fileName, data) => {
  const full = path.join(__dirname, '../templates', fileName);
  const zip = new PizZip(fs.readFileSync(full));
  sanitizeTemplateZip(zip, { templateName: fileName });
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '[', end: ']' },
    nullGetter: () => '',
  });
  doc.setData(data);
  doc.render();
  return xmlText(doc.getZip().generate({ type: 'nodebuffer' }));
};

const jointXml = renderIsr2('ISR-2_Bank_Joint_Template.docx', {
  'Bank AC C1': '123456789012',
  'Bank Address C1': 'Ambar Plaza, Station Road, Ahmednagar',
  'Bank Name C1': 'HDFC Bank',
  'Bank Branch C1': 'Ahmednagar',
});
assert(jointXml.includes('123456789012'), 'joint template account number');
assert(jointXml.includes('Ambar Plaza, Station Road, Ahmednagar'), 'joint template bank address');
assert(!jointXml.includes('[Bank AC C1]'), 'joint leftover Bank AC tag');
assert(!jointXml.includes('[Bank Address C1]'), 'joint leftover Bank Address tag');

const c2Xml = renderIsr2('ISR-2_Bank_Single_C2_Template.docx', {
  'Bank AC C2': '222233334444',
  'Bank Address C2': 'FC Road, Pune 411004',
});
assert(c2Xml.includes('222233334444'), 'C2 template account number');
assert(c2Xml.includes('FC Road, Pune 411004'), 'C2 template bank address');

console.log('ISR-2 bank mapping tests passed');
