const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const InspectModule = require('docxtemplater/js/inspect-module.js');
const Docxtemplater = require('docxtemplater');
const { sanitizeTemplateZip } = require('../src/utils/templateDocumentUtils');

const files = [
  'ISR-2_Bank_Joint_Template.docx',
  'ISR-2_Bank_Single_C1_Template.docx',
  'ISR-2_Bank_Single_C2_Template.docx',
  'ISR-2_Bank_Single_C3_Template.docx',
];

function extractText(xml) {
  return [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');
}

files.forEach((f) => {
  const full = path.join(__dirname, '../templates', f);
  const buf = fs.readFileSync(full);
  const zip = new PizZip(buf);
  sanitizeTemplateZip(zip, { templateName: f });
  const xml = zip.files['word/document.xml'].asText();
  const plain = extractText(xml);
  console.log('\n==========', f, '==========');
  const tags = [...plain.matchAll(/\[[^\]]{1,80}\]/g)].map((m) => m[0]);
  console.log('unique placeholders:', [...new Set(tags)].join('\n  '));

  const bankHits = [...plain.matchAll(/.{0,40}(?:Bank|Account|A\/C|Address|AC ).{0,40}/gi)];
  console.log('\nbank-ish snippets:');
  bankHits.slice(0, 25).forEach((m) => console.log(' ', JSON.stringify(m[0].replace(/\s+/g, ' '))));

  const iModule = new InspectModule();
  try {
    const doc = new Docxtemplater(new PizZip(buf), {
      delimiters: { start: '[', end: ']' },
      modules: [iModule],
      nullGetter: () => '',
    });
    console.log('\ndocxtemplater tags:', Object.keys(iModule.getAllTags()).join(', '));
  } catch (e) {
    console.log('inspect fail', e.message);
    if (e.properties && e.properties.errors) {
      e.properties.errors.slice(0, 6).forEach((err) =>
        console.log(' -', err.name, err.message, err.properties && err.properties.xtag)
      );
    }
  }
});
