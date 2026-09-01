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

const tablePlain = (tableXml) =>
  [...tableXml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join(' ')
    .replace(/\s+/g, ' ');

const compact = (s) => String(s || '').replace(/\s+/g, '');

const leftoverLayoutFloats = (xml) =>
  [...xml.matchAll(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/g)].filter((m) => {
    const c = compact(
      [...m[1].matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((x) => x[1]).join(' ')
    );
    return (
      /AddressofFirstHolder/i.test(c) ||
      /SignatureofAllholder/i.test(c) ||
      /FOROFFICE/i.test(c)
    );
  }).length;

const layoutTable = (xml) =>
  [...xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].find((m) =>
    /AddressofFirstHolder/i.test(compact(tablePlain(m[0])))
  );

const BOX_TEMPLATES = [
  'Affidavit Cum Indemnity Bond_NDEL_Multiple Claimant.docx',
  'Affidavit Cum Indemnity Bond_NDEL_Single Claimant.docx',
  'Affidavit Cum Indemnity Bond_Self_Multiple Claimant.docx',
  'Affidavit Cum Indemnity Bond_Self_Single Claimant.docx',
  'Affidavit Cum Indemnity Bond_Trans_Multiple Claimant.docx',
  'Affidavit Cum Indemnity Bond_Trans_Single Claimant.docx',
  'Form-B (Indemnity)- NDEL_Multiple Claimant.docx',
  'Form-B (Indemnity)- NDEL_Single Claimant_Template.docx',
  'Form-B (Indemnity)- SELF_Multiple Claimant_Template.docx',
  'Form-B (Indemnity)- SELF_Single_Template.docx',
  'Form-B (Indemnity)- TRANS_Multiple Claimant_Template.docx',
  'Form-B (Indemnity)- TRANS_Single_Template.docx',
];

const NO_BOX_TEMPLATES = ['Form-A (Affidavit)- NDEL_All.docx'];

for (const file of BOX_TEMPLATES) {
  const raw = loadXml(file);
  const out = postProcessDocumentXml(raw);
  const prefix = file;

  assert(
    leftoverLayoutFloats(out) === 0,
    `${prefix}: address/signature/office floats should become a table`
  );
  assert(!/<w:br\b[^>]*w:type="page"/i.test(out), `${prefix}: no forced witness page break`);

  const witnessAt = out.search(/IN WITNESS WHEREOF/i);
  const addrAt = out.search(/Address of First Holder/i);
  assert(witnessAt >= 0 && addrAt > witnessAt, `${prefix}: address table follows witness clause`);
  const between = out.slice(witnessAt, addrAt);
  const betweenText = [...between.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join(' ');
  assert(
    /have hereunto/i.test(betweenText) || /this day of/i.test(betweenText),
    `${prefix}: witness sentence stays above the address box, got: ${betweenText.slice(0, 180)}`
  );

  const tbl = layoutTable(out);
  assert(tbl, `${prefix}: missing address/signature layout table`);

  const rows = [...tbl[0].matchAll(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g)];
  assert(rows.length === 2, `${prefix}: layout table has 2 rows, got ${rows.length}`);

  const rowCells = (rowXml) => [...rowXml.matchAll(/<w:tc\b[^>]*>([\s\S]*?)<\/w:tc>/g)];
  const r1 = rowCells(rows[0][0]);
  const r2 = rowCells(rows[1][0]);
  assert(r1.length === 1, `${prefix}: address row is one full-width cell`);
  assert(/gridSpan w:val="2"/i.test(r1[0][0]), `${prefix}: address cell spans both columns`);
  assert(
    /AddressofFirstHolder/i.test(compact(tablePlain(r1[0][0]))),
    `${prefix}: address text in row 1`
  );

  assert(r2.length === 2, `${prefix}: pair row has 2 cells, got ${r2.length}`);
  const left = compact(tablePlain(r2[0][0]));
  const right = compact(tablePlain(r2[1][0]));
  assert(/SignatureofAllholder/i.test(left), `${prefix}: left cell is signature: ${left}`);
  assert(/FOROFFICE/i.test(right), `${prefix}: right cell is office: ${right}`);
  assert(
    /trHeight w:val="2400" w:hRule="exact"/i.test(rows[1][0]),
    `${prefix}: pair row uses equal exact height`
  );

  const again = postProcessDocumentXml(out);
  const tables2 = [...again.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].filter((m) =>
    /AddressofFirstHolder/i.test(compact(tablePlain(m[0])))
  );
  assert(tables2.length === 1, `${prefix}: second pass does not duplicate the layout table`);
}

for (const file of NO_BOX_TEMPLATES) {
  const raw = loadXml(file);
  const out = postProcessDocumentXml(raw);
  assert(
    leftoverLayoutFloats(raw) === 0 && leftoverLayoutFloats(out) === 0,
    `${file}: Form-A has no address/signature/office floats`
  );
  assert(
    !layoutTable(out),
    `${file}: Form-A should not gain a Form-B signature table`
  );
  assert(!/<w:br\b[^>]*w:type="column"/i.test(out), `${file}: no leftover column breaks`);
}

console.log(
  `Form-B signature box alignment tests passed (${BOX_TEMPLATES.length} box templates, ${NO_BOX_TEMPLATES.length} Form-A)`
);
