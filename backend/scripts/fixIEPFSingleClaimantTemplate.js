/**
 * Fix IndemnityBond_IEPF_Single Claimant.docx so mapped data shows in preview + Word:
 * 1. Single-column page (2-column layout breaks docx-preview)
 * 2. Put placeholders into normal body text (they were only in floating textboxes)
 * 3. Remove those floating placeholder textboxes / AlternateContent duplicates
 */
const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const templatePath = path.join(
  __dirname,
  '..',
  'templates',
  'IndemnityBond_IEPF_Single Claimant.docx'
);

const zip = new PizZip(fs.readFileSync(templatePath));
let xml = zip.file('word/document.xml').asText();

const bak = templatePath.replace(/\.docx$/i, '_backup.docx');
if (!fs.existsSync(bak)) {
  fs.copyFileSync(templatePath, bak);
  console.log('Backup written:', bak);
}

// --- 1) Single column + normal letter height ---
xml = xml.replace(/<w:cols\b[^>]*>[\s\S]*?<\/w:cols>/gi, '<w:cols w:space="720"/>');
xml = xml.replace(/<w:pgSz\s+w:w="12240"\s+w:h="20160"\s*\/>/i, '<w:pgSz w:w="12240" w:h="15840"/>');

// --- 2) Inject placeholders into body runs (where underlines/gaps were) ---
// "Rs" + "and"  →  "Rs [Total Dividend Amount] and"
if (!xml.includes('Rs [Total Dividend Amount]') && !/>Rs \[Total Dividend Amount\]</.test(xml)) {
  xml = xml.replace(
    /(<w:t[^>]*>)Rs(<\/w:t>)/,
    '$1Rs [Total Dividend Amount]$2'
  );
  console.log('Injected [Total Dividend Amount] after Rs');
}

// "shares" immediately before "being" → "shares [Total Shares] being"
if (!xml.includes('shares [Total Shares]')) {
  // Match shares run then optional spacing runs then being
  const sharesInjected = xml.replace(
    /(<w:t[^>]*>)shares(<\/w:t>)([\s\S]{0,400}?<w:t[^>]*>)being(<\/w:t>)/,
    '$1shares [Total Shares]$2$3being$4'
  );
  if (sharesInjected !== xml) {
    xml = sharesInjected;
    console.log('Injected [Total Shares] after shares');
  } else {
    console.warn('Could not inject [Total Shares]');
  }
}

// After [Financial Dividend Year] insert [Company Name] if not already adjacent in body
if (!/Financial Dividend Year\]\[Company Name\]/.test(xml.replace(/<[^>]+>/g, ''))) {
  const companyInjected = xml.replace(
    /(<w:t[^>]*>\[Financial Dividend Year\]<\/w:t>)/,
    '$1</w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Company Name]</w:t>'
  );
  // careful - above might break if Financial Dividend Year is split across runs
  if (companyInjected === xml) {
    // split form: ...Year]</w:t> somewhere
    const alt = xml.replace(
      /(Financial Dividend Year\]<\/w:t>)/,
      '$1</w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Company Name]</w:t>'
    );
    if (alt !== xml) {
      xml = alt;
      console.log('Injected [Company Name] after Financial Dividend Year (alt)');
    } else {
      console.warn('Could not inject [Company Name]');
    }
  } else {
    xml = companyInjected;
    console.log('Injected [Company Name] after Financial Dividend Year');
  }
}

// Before "out of the Investor" insert [Name as per PAN C1]
if (!xml.includes('[Name as per PAN C1]out') && !/Name as per PAN C1\][\s\S]{0,80}out of the Investor/.test(xml.replace(/<[^>]+>/g, ''))) {
  const panInjected = xml.replace(
    /(<w:t[^>]*>)out(<\/w:t>)([\s\S]{0,200}?<w:t[^>]*>)of(<\/w:t>)([\s\S]{0,200}?<w:t[^>]*>)the(<\/w:t>)([\s\S]{0,200}?<w:t[^>]*>)Investor(<\/w:t>)/,
    '</w:r><w:r><w:t>[Name as per PAN C1]</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>$2out$3$4of$5$6the$7$8Investor$9'
  );
  // Simpler: find unique phrase near Authority, I son
  const simple = xml.replace(
    /(<w:t[^>]*>)out(<\/w:t>)/,
    '$1[Name as per PAN C1] out$2'
  );
  // Only first "out" that is part of "out of the Investor" - check
  if (simple !== xml && /Name as per PAN C1\] out/.test(simple.replace(/<[^>]+>/g, '')) || simple.includes('[Name as per PAN C1] out')) {
    // verify context
    const idx = simple.indexOf('[Name as per PAN C1] out');
    const ctx = simple.slice(idx, idx + 200).replace(/<[^>]+>/g, '');
    if (/out of/.test(ctx) || /out<\/w:t>[\s\S]*of/.test(simple.slice(idx, idx + 500))) {
      xml = simple;
      console.log('Injected [Name as per PAN C1] before out');
    } else {
      console.warn('PAN inject context mismatch', ctx.slice(0, 80));
    }
  } else {
    console.warn('Could not inject [Name as per PAN C1]');
  }
}

// --- 3) Remove floating AlternateContent / drawings that ONLY hold these placeholders ---
xml = xml.replace(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, (block) => {
  const text = [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (
    /^(?:\[Total Shares\]|\[Total Dividend Amount\]|\[Company Name\]|\[Name as per PAN C1\])+$/i.test(
      cleaned.replace(/\]\[/g, '][')
    ) ||
    /^(?:Total Shares|Total Dividend Amount|Company Name|Name as per PAN C1|\s|\[|\])+$/i.test(cleaned)
  ) {
    // Only placeholder(s) duplicated in Choice+Fallback
    if (
      /Total Shares|Total Dividend Amount|Company Name|Name as per PAN C1/i.test(cleaned) &&
      cleaned.length < 80
    ) {
      console.log('Removed floating box:', cleaned.slice(0, 60));
      return '';
    }
  }
  // Also remove if the only meaningful text is one of these placeholders (possibly twice)
  const onlyPh =
    cleaned.replace(/\[Total Shares\]/gi, '')
      .replace(/\[Total Dividend Amount\]/gi, '')
      .replace(/\[Company Name\]/gi, '')
      .replace(/\[Name as per PAN C1\]/gi, '')
      .trim() === '';
  if (onlyPh && /Total Shares|Total Dividend|Company Name|Name as per PAN/i.test(cleaned)) {
    console.log('Removed floating box (only ph):', cleaned.slice(0, 60));
    return '';
  }
  return block;
});

// Clean empty runs left behind
xml = xml.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');
xml = xml.replace(/<w:drawing>\s*<\/w:drawing>/g, '');

zip.file('word/document.xml', xml);
fs.writeFileSync(templatePath, zip.generate({ type: 'nodebuffer', compression: 'DEFLATE' }));
console.log('Saved', templatePath, fs.statSync(templatePath).size);
