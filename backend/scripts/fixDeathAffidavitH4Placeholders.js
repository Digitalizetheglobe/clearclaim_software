/**
 * Merge split [placeholders] in Name Mismatch DEATH Affidavit_H4 so each tag is one contiguous w:t run.
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const TEMPLATE = path.join(
  __dirname,
  '../templates/Name Mismatch DEATH Affidavit_H4_Template.docx'
);

const mergeSplitPlaceholdersInXml = (xml) =>
  xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const texts = [...para.matchAll(/<w:t([^>]*)>([^<]*)<\/w:t>/g)];
    if (texts.length === 0) return para;

    const joined = texts.map((t) => t[2]).join('');
    if (!joined.includes('[') || !/\[[^\]]+\]/.test(joined)) return para;

    // Rebuild: keep paragraph structure but replace run texts so each [placeholder] is contiguous
    // Strategy: if any placeholder is split across runs, collapse all text runs into one sequence
    const placeholders = [...joined.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
    const anySplit = placeholders.some((ph) => !para.includes(ph));
    if (!anySplit) return para;

    // Put full joined text into the first w:t; clear the rest
    let replaced = false;
    return para.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (full, attrs) => {
      if (!replaced) {
        replaced = true;
        const spaceAttr =
          joined.startsWith(' ') || joined.endsWith(' ') ? ' xml:space="preserve"' : '';
        let newAttrs = attrs || '';
        if (spaceAttr && !/xml:space=/.test(newAttrs)) newAttrs += spaceAttr;
        // Escape XML special chars in text
        const escaped = joined
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
        return `<w:t${newAttrs}>${escaped}</w:t>`;
      }
      return `<w:t${attrs}></w:t>`;
    });
  });

const zip = new PizZip(fs.readFileSync(TEMPLATE));
let xml = zip.file('word/document.xml').asText();
const before = (xml.match(/\[[^\]]+\]/g) || []).length;
xml = mergeSplitPlaceholdersInXml(xml);
zip.file('word/document.xml', xml);

const outFixed = path.join(
  __dirname,
  '../templates/Name Mismatch DEATH Affidavit_H4_Template_fixed.docx'
);
const buf = zip.generate({ type: 'nodebuffer' });
fs.writeFileSync(outFixed, buf);
try {
  fs.writeFileSync(TEMPLATE, buf);
  console.log('Updated', TEMPLATE);
} catch (e) {
  console.warn('Original locked; wrote', outFixed, e.message);
}

const v = new PizZip(buf).file('word/document.xml').asText();
const plain = v.replace(/<[^>]+>/g, '');
const phs = [...plain.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
console.log('placeholders:', [...new Set(phs)]);
console.log(
  'contiguous DC H4:',
  v.includes('[Name as per DC H4]')
);
console.log(
  'contiguous Cert H4:',
  v.includes('[Name as per Certificate H4]')
);
console.log(
  'contiguous Relation H4:',
  v.includes('[Claimant Relation H4]')
);
