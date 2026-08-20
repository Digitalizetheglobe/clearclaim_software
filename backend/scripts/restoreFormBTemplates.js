const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const root = path.join(__dirname, '..');
const templatesDir = path.join(root, 'templates');

const locked = [
  'Form-B (Indemnity)- NDEL_Multiple Claimant.docx',
  'Form-B (Indemnity)- SELF_Multiple Claimant_Template.docx',
];

const allFormB = fs
  .readdirSync(templatesDir)
  .filter((f) => f.startsWith('Form-B') && f.endsWith('.docx') && !f.includes('_aligned') && !f.startsWith('_restored') && !f.startsWith('~$'));

function gitShow(relPath) {
  const r = spawnSync('git', ['show', `HEAD:backend/templates/${relPath}`], {
    cwd: path.join(root, '..'),
    encoding: 'buffer',
    maxBuffer: 30 * 1024 * 1024,
  });
  if (r.status !== 0) {
    throw new Error(r.stderr.toString() || `git show failed for ${relPath}`);
  }
  return r.stdout;
}

function validateDocx(buf, label) {
  try {
    const zip = new PizZip(buf);
    const xml = zip.file('word/document.xml');
    if (!xml) return `${label}: missing document.xml`;
    const text = xml.asText();
    const open = (text.match(/</g) || []).length;
    const close = (text.match(/>/g) || []).length;
    const ph = [...text.matchAll(/\[[^\]]+\]/g)].map((m) => m[0]);
    const unique = [...new Set(ph)].slice(0, 8);
    return `${label}: ok bytes=${buf.length} tags~${open}/${close} placeholders=${ph.length} sample=${unique.join(', ')}`;
  } catch (e) {
    return `${label}: INVALID ${e.message}`;
  }
}

for (const f of locked) {
  const buf = gitShow(f);
  const out = path.join(templatesDir, `_restored_${f}`);
  fs.writeFileSync(out, buf);
  console.log(validateDocx(buf, `_restored_${f}`));
  try {
    fs.writeFileSync(path.join(templatesDir, f), buf);
    console.log(`Overwrote locked file: ${f}`);
  } catch (e) {
    console.warn(`Still locked (close Word): ${f} — ${e.message}`);
    console.warn(`Use: ${out}`);
  }
}

console.log('\n--- validate current Form-B files ---');
for (const f of allFormB) {
  const p = path.join(templatesDir, f);
  const buf = fs.readFileSync(p);
  console.log(validateDocx(buf, f));
}

// Remove aligned junk
for (const f of fs.readdirSync(templatesDir)) {
  if (f.includes('_aligned') && f.startsWith('Form-B')) {
    try {
      fs.unlinkSync(path.join(templatesDir, f));
      console.log('Deleted', f);
    } catch (e) {
      console.warn('Could not delete', f, e.message);
    }
  }
}
