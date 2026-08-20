/**
 * Normalize oversized font runs in ISR-1 templates (sz >= 36 half-points on body/space runs).
 * Keeps Wingdings/symbol runs unchanged.
 */
const PizZip = require('pizzip');
const fs = require('fs');
const path = require('path');

const FILES = ['ISR-1_Template_fixed.docx', 'ISR-1_Template.docx'];

function normalizeFonts(xml) {
  // Clamp large sz on runs that are NOT symbol fonts
  return xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (/w:ascii="(?:Wingdings|Wingdings 2|Wingdings 3|Webdings|Symbol|MT Extra)"/i.test(run)) {
      return run;
    }
    return run.replace(/(<w:sz(?:Cs)?\s+w:val=")(\d+)(")/gi, (m, a, val, c) => {
      const n = parseInt(val, 10);
      // 40 half-points = 20pt was used on a spacer run and blew up merged body text
      if (n >= 36) return `${a}24${c}`;
      return m;
    });
  });
}

for (const name of FILES) {
  const file = path.join(__dirname, '../templates', name);
  if (!fs.existsSync(file)) {
    console.warn('skip missing', name);
    continue;
  }
  try {
    const zip = new PizZip(fs.readFileSync(file));
    const xml = zip.file('word/document.xml').asText();
    const before = (xml.match(/w:sz w:val="40"/g) || []).length;
    const next = normalizeFonts(xml);
    const after = (next.match(/w:sz w:val="40"/g) || []).length;
    zip.file('word/document.xml', next);
    const buf = zip.generate({ type: 'nodebuffer' });
    const fixedOut = file.replace(/\.docx$/i, '_fontsize.docx');
    try {
      fs.writeFileSync(file, buf);
      console.log(`Updated ${name}: sz=40 runs ${before} → ${after}`);
    } catch (e) {
      fs.writeFileSync(fixedOut, buf);
      console.warn(`Locked ${name}, wrote ${path.basename(fixedOut)} (${e.message})`);
    }
  } catch (e) {
    console.error(name, e.message);
  }
}
