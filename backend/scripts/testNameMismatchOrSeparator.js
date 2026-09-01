const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const {
  cleanFormattedListText,
  postProcessDocumentXml,
} = require('../src/utils/templateDocumentUtils');

const assert = (cond, msg) => {
  if (!cond) throw new Error(msg);
};

const point2 = (cml, bank, passport, succession, cert) =>
  `That in some of the documents my name appears as ${cml} or ${bank} or ${passport} or ${succession} or ${cert}.`;

const out = cleanFormattedListText(
  point2(
    'Sanjeev Sharadchandra Pradhan',
    'Sanjeev Sharadchandra Pradhan',
    '',
    '',
    'Sanjeev Pradhan'
  )
);

assert(
  /Pradhan or Sanjeev Pradhan/i.test(out),
  `last or before cert name must stay, got: ${out}`
);
assert(
  !/Pradhan Sanjeev Pradhan/i.test(out),
  `names must not run together, got: ${out}`
);
assert(
  (out.match(/\bor\b/gi) || []).length === 2,
  `two remaining name variants need two "or" separators, got: ${out}`
);

assert(
  cleanFormattedListText('A or or or B').includes('A or B'),
  'collapse extra or, keep one'
);
assert(
  !/\bor\b/i.test(cleanFormattedListText('Name or or or.')),
  'trailing empty or slots drop before the period'
);
assert(
  cleanFormattedListText('minor or original').includes('or original'),
  'must not eat "or" inside "original"'
);

const paraXml = (text) =>
  `<w:p><w:r><w:t xml:space="preserve">${text}</w:t></w:r></w:p>`;

const processed = postProcessDocumentXml(
  paraXml(
    point2(
      'Sanjeev Sharadchandra Pradhan',
      'Sanjeev Sharadchandra Pradhan',
      '',
      '',
      'Sanjeev Pradhan'
    )
  )
);
const visible = [...processed.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1])
  .join(' ');
assert(
  /Pradhan or Sanjeev Pradhan/i.test(visible),
  `postProcess keeps last or: ${visible}`
);

const affidavitXml = (paras) =>
  paras.map((t) => `<w:p><w:r><w:t xml:space="preserve">${t}</w:t></w:r></w:p>`).join('');

const same = 'Sanjeev Sharadchandra Pradhan';
const unique = 'Sanjeev Pradhan';
const point3 = `Therefore, I confirmed and declare that the names as in the aforesaid documents as ${same} & ${same} & ${same} & ${same} & ${unique} belongs to one and same person.`;
const point1 = `My name as appeared in KYC documents and Government records such as Aadhaar and PAN as ${same} & ${same} s/o / w/o Sharadchandra Yeshwant Pradhan`;
const point2Filled = `my name appears as ${same} or ${same} or ${unique}.`;

const deduped = postProcessDocumentXml(affidavitXml([point1, point2Filled, point3]));
const dedupedText = [...deduped.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1].replace(/&amp;/g, '&'))
  .join(' ')
  .replace(/\s+/g, ' ');

assert(
  /Aadhaar and PAN as Sanjeev Sharadchandra Pradhan s\/o/i.test(dedupedText),
  `point 1 shows the shared name once, got: ${dedupedText}`
);
assert(
  /name appears as Sanjeev Sharadchandra Pradhan or Sanjeev Pradhan\./i.test(dedupedText),
  `point 2 unique name after or, got: ${dedupedText}`
);
assert(
  /aforesaid documents as Sanjeev Sharadchandra Pradhan & Sanjeev Pradhan belongs/i.test(
    dedupedText
  ),
  `point 3 unique name after &, got: ${dedupedText}`
);
assert(
  (dedupedText.match(/Sanjeev Sharadchandra Pradhan/g) || []).length === 3,
  `shared name once per clause, got: ${dedupedText}`
);

const allSame = postProcessDocumentXml(
  affidavitXml([
    `Therefore, I confirmed and declare that the names as in the aforesaid documents as ${same} & ${same} & ${same} belongs to one and same person.`,
  ])
);
const allSameText = [...allSame.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
  .map((m) => m[1].replace(/&amp;/g, '&'))
  .join(' ')
  .replace(/\s+/g, ' ');
assert(
  /aforesaid documents as Sanjeev Sharadchandra Pradhan belongs/i.test(allSameText),
  `all identical names print once, got: ${allSameText}`
);
assert(
  !/Pradhan & Sanjeev/i.test(allSameText),
  `no leftover & when every name matches, got: ${allSameText}`
);

const templatesDir = path.join(__dirname, '../templates');
['C1', 'C2', 'C3', 'C4'].forEach((suffix) => {
  const file = `Name Mismatch SELF Affidavit_${suffix}_Template.docx`;
  const zip = new PizZip(fs.readFileSync(path.join(templatesDir, file)));
  const xml = zip.files['word/document.xml'].asText();
  const compact = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/\s+/g, ' ');
  assert(
    compact.includes(`[Name as per Cert ${suffix}]`),
    `${file}: has cert name tag`
  );
  assert(
    /or\s*\[Name as per Cert/i.test(compact),
    `${file}: last point-2 name is joined with or`
  );
});

console.log('Name mismatch SELF "or" separator tests passed');
