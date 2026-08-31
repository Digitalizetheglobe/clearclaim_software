const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { postProcessDocumentXml } = require('../src/utils/templateDocumentUtils');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const templatesDir = path.join(__dirname, '../templates');
const loadXml = (fileName) => {
  const zip = new PizZip(fs.readFileSync(path.join(templatesDir, fileName)));
  return zip.files['word/document.xml'].asText();
};

const firstParagraph = (xml) => xml.match(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/)[0];
const firstText = (xml) =>
  [...firstParagraph(xml).matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
const witnessParagraph = (xml) => {
  const re = /<w:p\b[^>]*>(?:(?!<\/w:p>)[\s\S])*IN WITNESS WHEREOF[\s\S]*?<\/w:p>/i;
  return xml.match(re)?.[0] || '';
};

const emptyLargeAnchors = (xml) =>
  [...xml.matchAll(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/g)].filter((m) => {
    const inner = m[1];
    const text = [...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((x) => x[1])
      .join('')
      .replace(/\s+/g, '');
    if (text || /<a:blip\b/i.test(inner)) return false;
    const ext = (inner.match(/<wp:extent\b[^>]*\/?>/i) || [''])[0];
    const cx = parseInt((ext.match(/cx="(\d+)"/) || [])[1] || '0', 10);
    const cy = parseInt((ext.match(/cy="(\d+)"/) || [])[1] || '0', 10);
    return cx >= 1371600 && cy >= 1371600;
  }).length;

const affidavit = 'Affidavit Cum Indemnity Bond_NDEL_Single Claimant.docx';
const raw = loadXml(affidavit);
assert(/IN WITNESS WHEREOF/i.test(raw), 'fixture has witness clause');
assert(emptyLargeAnchors(raw) >= 1, 'fixture has leftover empty rectangle');

const out = postProcessDocumentXml(raw);
assert(!/w:type="page"/i.test(firstParagraph(out)), 'first paragraph must not start a new page');
assert(/Annexure-A/i.test(firstText(out)), 'document still starts with Annexure-A');
assert(/w:type="page"/i.test(witnessParagraph(out)), 'page break stays on the witness paragraph');
assert(emptyLargeAnchors(out) === 0, 'empty large floating rectangle removed');
assert(!/<w:lastRenderedPageBreak\b/i.test(out), 'lastRenderedPageBreak stripped');
assert(/Signature of All holder/i.test(out), 'signature box kept');
assert(/Address of First Holder/i.test(out), 'address box kept');

const formBName = 'Form-B (Indemnity)- NDEL_Single_Template.docx';
if (fs.existsSync(path.join(templatesDir, formBName))) {
  const formB = postProcessDocumentXml(loadXml(formBName));
  assert(!/w:type="page"/i.test(firstParagraph(formB)), 'Form-B first paragraph has no page break');
  assert(
    /w:type="page"/i.test(witnessParagraph(formB)),
    'Form-B witness paragraph still gets a page break'
  );
}

console.log('Ghost preview page tests passed');
