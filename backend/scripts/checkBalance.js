const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(__dirname, '../templates/Annexure-E (Indemnity Bond)_Template.docx');
const fixPath = path.join(__dirname, 'fixAnnexureETemplate.js');

// Load fixDocumentXml by eval - simpler: inline import
const { fixDocumentXml } = (() => {
  delete require.cache[require.resolve('./fixAnnexureETemplate.js')];
  // Can't export - duplicate balance check by reading file and extracting function
  return {};
})();

function balance(xml) {
  const o = (xml.match(/<w:r[\s>]/g) || []).length;
  const c = (xml.match(/<\/w:r>/g) || []).length;
  return { o, c, d: o - c };
}

// Read fixDocumentXml from fix script - run via subprocess steps from debugAnnexureECompile logic
const buf = fs.readFileSync(templatePath);
let xml = new PizZip(buf).files['word/document.xml'].asText();
console.log('start', balance(xml));

// Minimal: require the fix function - add export to fix script temporarily
// Instead run each step from fixAnnexureETemplate manually

const steps = [];
const add = (name, fn) => steps.push([name, fn]);

add('proof', (x) => x.replace(/<w:proofErr[^>]*\/>/g, ''));
// ... run full fix via child process

// Run fix and compare
const { execSync } = require('child_process');
execSync('node scripts/fixAnnexureETemplate.js', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
xml = new PizZip(fs.readFileSync(templatePath)).files['word/document.xml'].asText();
console.log('after fix', balance(xml));
