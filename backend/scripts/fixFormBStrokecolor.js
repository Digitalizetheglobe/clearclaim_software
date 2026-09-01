/**
 * Fix Form-B VML strokecolor="black [3040]" so [3040] is not treated as a placeholder.
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');
const { sanitizeTemplateXmlArtifacts } = require('../src/utils/templateDocumentUtils');

const templatesDir = path.join(__dirname, '../templates');
const files = fs
  .readdirSync(templatesDir)
  .filter((f) => f.startsWith('Form-B') && f.endsWith('.docx') && !f.startsWith('~$') && !f.startsWith('_'));

let fixed = 0;
for (const file of files) {
  const full = path.join(templatesDir, file);
  try {
    const zip = new PizZip(fs.readFileSync(full));
    let changed = false;
    Object.keys(zip.files).forEach((name) => {
      if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) return;
      const before = zip.files[name].asText();
      const after = sanitizeTemplateXmlArtifacts(before);
      if (after !== before) {
        zip.file(name, after);
        changed = true;
      }
    });
    if (changed) {
      fs.writeFileSync(full, zip.generate({ type: 'nodebuffer' }));
      fixed++;
      console.log('fixed', file);
    } else {
      console.log('ok    ', file);
    }
  } catch (err) {
    console.error('FAIL  ', file, err.message);
  }
}
console.log(`Done. Fixed ${fixed}/${files.length} Form-B templates.`);
