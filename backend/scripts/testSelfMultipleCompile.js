const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const {
  sanitizeTemplateZip,
  collapseDuplicateOpenBracketRuns,
} = require('../src/utils/templateDocumentUtils');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const broken = '<w:p><w:r><w:t>We</w:t></w:r><w:r><w:t>[</w:t></w:r><w:r><w:t>[Name as per Aadhar C1]</w:t></w:r></w:p>';
const fixed = collapseDuplicateOpenBracketRuns(broken);
assert(!/\[\[Name/.test(fixed.replace(/<[^>]+>/g, '')), 'lone [ before tag is dropped');
assert(fixed.includes('[Name as per Aadhar C1]'), 'real tag kept');

const file = 'Affidavit Cum Indemnity Bond_Self_Multiple Claimant.docx';
const zip = new PizZip(fs.readFileSync(path.join(__dirname, '../templates', file)));
sanitizeTemplateZip(zip, { templateName: file });
const doc = new Docxtemplater(zip, {
  paragraphLoop: true,
  linebreaks: true,
  delimiters: { start: '[', end: ']' },
  nullGetter: () => '',
});
doc.render();
console.log('Self Multiple affidavit compiles for preview');
