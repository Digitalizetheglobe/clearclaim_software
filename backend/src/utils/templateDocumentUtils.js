/**
 * Utilities for cleaning populated Word document XML and formatted list text.
 * Addresses: redundant &&, trailing commas/&, empty "or or" patterns, blank table rows.
 */

const fs = require('fs');
const path = require('path');
const PizZip = require('pizzip');

const countWordTags = (xml, tag) => ({
  open: (xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>`, 'g')) || []).length,
  close: (xml.match(new RegExp(`</${tag}>`, 'g')) || []).length,
});

const isUnbalancedTableXml = (xml) => {
  if (!xml) return false;
  const tbl = countWordTags(xml, 'w:tbl');
  const tr = countWordTags(xml, 'w:tr');
  return tbl.open !== tbl.close || tr.open !== tr.close;
};

/**
 * Annexure-D Individual Affidavit LH6–LH10 were gutted by a greedy <w:p> delete,
 * leaving orphan </w:tbl>/</w:tr>. Rebuild deponent identity from the intact LH5 file.
 */
const replaceAnnexureDDeponentLh = (xml, fromNum, toNum) => {
  if (!xml || fromNum === toNum) return xml;
  const swap = (s) => s.replace(new RegExp(`LH${fromNum}(?!\\d)`, 'g'), `LH${toNum}`);
  const tblRe = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  let out = '';
  let last = 0;
  let m;
  while ((m = tblRe.exec(xml))) {
    out += swap(xml.slice(last, m.index));
    const table = m[0];
    if (/Name of the Legal Heir/i.test(table)) {
      out += table.replace(/\[Mobile No LH\d+\]/g, '');
    } else {
      out += swap(table);
    }
    last = m.index + m[0].length;
  }
  out += swap(xml.slice(last));
  return out;
};

const repairGuttedAnnexureDLhZip = (zip, templateFileName) => {
  const doc = zip && zip.files && zip.files['word/document.xml'];
  if (!doc) return zip;
  const xml = doc.asText();
  if (!isUnbalancedTableXml(xml) && (xml.match(/<w:tbl(?:\s[^>]*)?>/g) || []).length > 0) {
    return zip;
  }

  const m = String(templateFileName || '').match(
    /Annexure-D \(Individual Affidavit\)_LH(\d+)/i
  );
  if (!m) return zip;
  const n = Number(m[1]);
  if (!n || n < 1 || n > 10 || n === 5) return zip;

  const sourcePath = path.join(
    __dirname,
    '../../templates',
    'Annexure-D (Individual Affidavit)_LH5_Template.docx'
  );
  if (!fs.existsSync(sourcePath)) return zip;

  let sourceZip;
  try {
    sourceZip = new PizZip(fs.readFileSync(sourcePath));
  } catch (err) {
    console.warn('Could not load Annexure-D LH5 donor template:', err.message);
    return zip;
  }

  Object.keys(sourceZip.files).forEach((filePath) => {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(filePath)) return;
    const srcXml = sourceZip.files[filePath].asText();
    zip.file(filePath, replaceAnnexureDDeponentLh(srcXml, 5, n));
  });
  console.log(`♻️ Rebuilt gutted ${path.basename(String(templateFileName))} from LH5 donor`);
  return zip;
};

/**
 * Annexure-D deponent opener was copied from a header: Heading1 + a leading
 * center-tab at 142 twips (~0.1in). Long populated names/addresses center on
 * that point and overflow the left page edge in preview and Word.
 */
const fixAnnexureDDeponentAlignment = (xml) => {
  if (!xml || !/do hereby solemnly affirm/i.test(xml)) {
    return xml;
  }

  return xml.replace(/<w:p(\s[^>]*)?>([\s\S]*?)<\/w:p>/g, (full, attrs, inner) => {
    const text = [...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!/do hereby solemnly affirm/i.test(text)) return full;
    if (/herein above|solemnly affirmed at/i.test(text)) return full;
    if (!/Residing at|Name as per Aadhar/i.test(text)) return full;

    const pPrMatch = inner.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/);
    let pPrXml = pPrMatch ? pPrMatch[0] : '<w:pPr></w:pPr>';
    let rest = pPrMatch ? inner.slice(pPrMatch[0].length) : inner;

    pPrXml = pPrXml.replace(/<w:tabs\b[^>]*>[\s\S]*?<\/w:tabs>/g, '');
    pPrXml = pPrXml.replace(/<w:pStyle w:val="Heading1"\s*\/>/i, '<w:pStyle w:val="Default"/>');
    if (/<w:ind\b/i.test(pPrXml)) {
      pPrXml = pPrXml.replace(/<w:ind\b[^>]*\/?>/g, '<w:ind w:left="0" w:right="0"/>');
    }

    rest = rest.replace(/^(?:\s*<w:r\b[^>]*>(?:(?!<\/w:r>)[\s\S])*?<w:tab\s*\/>[\s\S]*?<\/w:r>)+/, '');

    return `<w:p${attrs || ''}>${pPrXml}${rest}</w:p>`;
  });
};

const isEmptyOrSeparatorOnly = (text) => {
  if (!text || typeof text !== 'string') return true;
  const trimmed = text.trim();
  if (!trimmed) return true;
  return trimmed.match(/^[,.\s&;]+$/) ||
    trimmed.match(/^(Late[,\s;]*)+$/i) ||
    trimmed.match(/^(\s*or\s*)+$/i) ||
    trimmed === '&' ||
    trimmed === '&&';
};

/**
 * Decode common XML entities from w:t text nodes.
 */
const decodeXmlText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
};

const escapeXmlText = (text) => {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

/**
 * Clean list-style text: remove empty slots leaving redundant separators.
 */
const cleanFormattedListText = (text) => {
  if (!text || typeof text !== 'string') return '';

  // Keep intentional lone punctuation (e.g. "," after "day of" tab in affidavits)
  if (/^[,.;:()]+$/.test(text.trim())) {
    return text.trim();
  }

  let cleaned = text;
  let prev;

  // Remove undefined/null remnants
  cleaned = cleaned.replace(/undefined|null/gi, '');

  // Collapse repeated ampersands to a single separator: "A & & B" → "A & B"
  // (empty optional slots like C2/C3 leave orphan "&" between real values)
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/\s*&\s*(?:&\s*)+/g, ' & ');
    cleaned = cleaned.replace(/&{2,}/g, '&');
  } while (cleaned !== prev);

  // Affidavit / multi-claimant: remove "&" when the next value is missing and the
  // next token is structural legal text (not another name).
  // e.g. "Ramesh & Anuradha & Son / daughter..." → "Ramesh & Anuradha Son / daughter..."
  // e.g. "Father1 & Father2 & respectively" → "Father1 & Father2 respectively"
  // e.g. "Name1 & Name2 & further swear" → "Name1 & Name2 further swear"
  // e.g. "Name1 & Name2 & here by further" → "Name1 & Name2 here by further"
  // e.g. "Name1 & Name2 & are making" → "Name1 & Name2 are making"
  const ampBeforeStructure =
    /\s*&\s+(?=(?:Son|daughter|spouse|respectively|swear|further|hereby|here\s+by|do\b|residing|having|held|that\b|whose|who\b|are\b|is\b|making|apply|applying|confirm|declare|affirm|state|undertake|agree)\b)/gi;
  cleaned = cleaned.replace(ampBeforeStructure, ' ');

  // Generic: orphan "&" before lowercase continuation (empty C3 left "Name & further/here…")
  cleaned = cleaned.replace(/\s*&\s+(?=[a-z])/g, ' ');

  // Orphan "&" after commas / before sentence (empty first slot): "We, & Name2"
  cleaned = cleaned.replace(/,\s*&\s+/g, ', ');
  cleaned = cleaned.replace(/\(\s*&\s+/g, '(');

  // Remove "Late ;" / "Late ," only when no shareholder name follows
  // Keep "Late, Suresh Kumar" / "Late Suresh" (Form-B Point 1)
  cleaned = cleaned.replace(/\bLate\s*[,;]\s*(?=(?:Late\b|[,;&]|\s*$))/gi, '');
  cleaned = cleaned.replace(/[,;]\s*\bLate\b(?=\s*[,;&]|\s*$)/gi, '');
  cleaned = cleaned.replace(/\bLate\s*&\s*(?=(?:Late\b|[,;&]|\s*$))/gi, '');
  cleaned = cleaned.replace(/\s*&\s*\bLate\b(?=\s*[,;&]|\s*$)/gi, '');
  cleaned = cleaned.replace(/\bLate\s*$/gi, '');
  // Orphan "Late" at start of a fragment with only separators after
  cleaned = cleaned.replace(/^\s*\bLate\b\s*[,;&]+\s*$/gi, '');
  // Empty Late slots in lists: "Late, Late," or "Late ; Late"
  cleaned = cleaned.replace(/(?:\bLate\s*[,;&]\s*){2,}/gi, '');

  // Empty name-mismatch slots leave "Name1 or or or Name2". Keep one "or"
  // when another name follows. Do not use (?:or\s*){2,} — that also eats the
  // "or" in "original" / similar words.
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/\s*\bor\b(?:\s+\bor\b)+/gi, ' or ');
  } while (cleaned !== prev);
  cleaned = cleaned.replace(/\s+\bor\b\s*\./gi, '.');
  cleaned = cleaned.replace(/\s+\bor\b\s*$/gi, '');

  // Remove redundant death-clause leftovers: "on , on on , on"
  cleaned = cleaned.replace(/(?:\s*on\s*,\s*)+/gi, ' ');
  cleaned = cleaned.replace(/(?:\s+on){2,}/gi, ' on');
  cleaned = cleaned.replace(/\bon\s*,\s*on\b/gi, 'on');
  cleaned = cleaned.replace(/\bdied intestate\s+(?:on\s*,?\s*)+/gi, 'died intestate ');
  cleaned = cleaned.replace(/\bdied intestate\s*,+/gi, 'died intestate ');
  cleaned = cleaned.replace(/\s+on\s+(?=without\b)/gi, ' ');

  // Collapse / strip leftover semicolons from empty name/PAN slots: "; ;", ";;", "; are", "; do"
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/;\s*;/g, ';');
  } while (cleaned !== prev);
  cleaned = cleaned.replace(/\s*;\s*(?=are\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*;\s*(?=do\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*;\s*(?=was\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*;\s*(?=were\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=are\b)/gi, ' ');
  // "That Late, ; was" / "That Late,  was" when shareholder name missing
  cleaned = cleaned.replace(/\bLate\s*,\s*(?=was\b)/gi, '');
  cleaned = cleaned.replace(/\bLate\s*,\s*$/gi, '');
  cleaned = cleaned.replace(/\bLate\s*;+/gi, '');
  cleaned = cleaned.replace(/\bLate\s+(?=are\b)/gi, '');
  cleaned = cleaned.replace(/\s+&\s+Late\s*$/gi, '');
  cleaned = cleaned.replace(/\s+&\s+Late\s+(?=are\b)/gi, ' ');

  // Remove trailing/leading separators: commas, ampersands (PRESERVE semicolons and dots)
  cleaned = cleaned.replace(/[,&\s]*&[\s,&]*$/g, '');
  cleaned = cleaned.replace(/^[\s,&]+/g, '');
  cleaned = cleaned.replace(/[,&\s]+$/g, '');
  // Collapse repeated commas (run until stable)
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/,\s*,/g, ',');
    cleaned = cleaned.replace(/(\s*,\s*){2,}/g, ', ');
  } while (cleaned !== prev);

  // Remove commas before @, quotes, or opening parenthesis
  cleaned = cleaned.replace(/,\s*(?=[@("])/g, '');
  cleaned = cleaned.replace(/,\s*$/g, '');

  // "Mr. / Mrs." with no deceased name — remove stray commas after
  cleaned = cleaned.replace(/Mr\.\s*\/?\s*Mrs\.?\s*,+\s*/gi, 'Mr. / Mrs. ');

  // Add space after comma when missing (e.g. "Society,Flat" -> "Society, Flat")
  cleaned = cleaned.replace(/,([A-Za-z])/g, ', $1');

  // Remove ", &" and ". &" patterns mid-text
  cleaned = cleaned.replace(/,\s*&\s*/g, ', ');
  cleaned = cleaned.replace(/\.\s*&\s*/g, '. ');
  cleaned = cleaned.replace(/\s*&\s*,/g, ',');
  cleaned = cleaned.replace(/\s*&\s*;/g, ';');

  // Remove standalone ampersands (not part of valid text like "A&B")
  cleaned = cleaned.replace(/\s+&\s+(?=&)/g, ' ');
  cleaned = cleaned.replace(/\s+&\s*$/g, '');
  cleaned = cleaned.replace(/^\s*&\s+/g, '');
  // Empty joint slots: "Name1 & &hereby" / "Name1 && Name2"
  cleaned = cleaned.replace(/\s*&\s*(?=hereby\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=declare\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=confirm\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=undertake\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=have\b)/gi, ' ');
  cleaned = cleaned.replace(/([A-Za-z])(?=(hereby|declare|confirm|undertake|have)\b)/g, '$1 ');

  // Normalize spaced emails FIRST so orphan-@ cleanup cannot destroy them
  // e.g. "user @ gmail.com" / "user@ gmail.com" → "user@gmail.com"
  cleaned = cleaned.replace(
    /([A-Za-z0-9._%+-]+)\s*@\s*([A-Za-z0-9.-]+\.[A-Za-z]{2,})/g,
    '$1@$2'
  );

  // Remove orphaned standalone "@" only — do NOT strip @ inside email addresses
  cleaned = cleaned.replace(/(^|[\s,;])@(?=[\s,;]|$)/g, '$1');

  // Remove footnote "#" stuck to filled values (e.g. account "10378921868 #")
  cleaned = cleaned.replace(/(\d)\s+#(?=\s|$)/g, '$1');
  cleaned = cleaned.replace(/([A-Za-z0-9])\s+#(?=\s*$)/g, '$1');

  // Final trailing comma cleanup after @ removal (PRESERVE semicolons)
  cleaned = cleaned.replace(/[,&\s]+$/g, '');
  cleaned = cleaned.replace(/^[,&\s]+/g, '');

  // Remove lone "or ." or trailing dot-only remnants
  cleaned = cleaned.replace(/\s+or\s*\.\s*$/gi, '');
  cleaned = cleaned.replace(/\s+or\s*$/gi, '');
  cleaned = cleaned.replace(/^\.\s*$/g, '');

  // Remove empty numbered list slots left by missing joint holders:
  // "1. Ramesh 2.  3." or "1. Ramesh2. 3." → "1. Ramesh"
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/\d+\.\s*(?=\d+\.)/g, '');
    cleaned = cleaned.replace(/(?:^|\s)\d+\.\s*$/g, '');
    cleaned = cleaned.replace(/([A-Za-z0-9\)])\d+\.\s*$/g, '$1');
  } while (cleaned !== prev);

  // Preserve intentional multi-space gaps on form/signature/date lines
  // (e.g. "on this      day of        , 2026          (DEPONENT)")
  const isLayoutLine =
    /\b(day\s+of|deponent|solemnly\s+affirm|signature|witness)\b/i.test(cleaned) ||
    /_{3,}/.test(cleaned) ||
    /\bon\s+this\b/i.test(cleaned);

  if (isLayoutLine) {
    // Keep internal spacing; only trim edges and curb extreme leftover runs
    cleaned = cleaned.replace(/[ \t]+$/g, '').replace(/^[ \t]+/g, '');
    cleaned = cleaned.replace(/ {25,}/g, '                    ');
  } else {
    // Normal paragraphs: collapse whitespace
    cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();
  }

  // I/We: multiple names (comma or &) → We, single → I
  if (/\bI\/We\b/i.test(cleaned)) {
    const nameLikeParts = cleaned
      .replace(/\bI\/We\b/gi, '')
      .split(/[,&]/)
      .map((p) => p.trim())
      .filter((p) => p && !isEmptyOrSeparatorOnly(p) && p.length > 2);
    const pronoun = nameLikeParts.length > 1 ? 'We' : 'I';
    cleaned = cleaned.replace(/\bI\/We\b/gi, pronoun);
  }

  // Repair glued wording (IEPF indemnity + similar Word templates)
  cleaned = cleaned.replace(/Rsand\b/gi, 'Rs and');
  cleaned = cleaned.replace(/sharesbeing\b/gi, 'shares being');
  cleaned = cleaned.replace(/amountand\b/gi, 'amount and');
  cleaned = cleaned.replace(/\bIson\b/g, 'I son');
  cleaned = cleaned.replace(/\)\s*out\b/g, ') out');
  cleaned = cleaned.replace(/([A-Za-z0-9\)])from\(/gi, '$1 from (');
  cleaned = cleaned.replace(/([A-Za-z0-9\)])from\b/gi, '$1 from');
  cleaned = cleaned.replace(/\bfrom\(/gi, 'from (');
  cleaned = cleaned.replace(/(LTD|LIMITED|BANK|PVT\.?|PRIVATE)\s*(from\b)/gi, '$1 $2');
  cleaned = cleaned.replace(/\b(Rs)\s*(\d)/gi, '$1 $2');
  cleaned = cleaned.replace(/\b(shares)\s*(\d)/gi, '$1 $2');
  cleaned = cleaned.replace(/BCIN\)([A-Za-z])/gi, 'BCIN) $1');
  cleaned = cleaned.replace(/CIN\/BCIN\)([A-Za-z])/gi, 'CIN/BCIN) $1');

  return cleaned;
};

/**
 * Extract visible text from a table row XML fragment.
 */
const getRowText = (rowContent) => {
  const texts = [];
  const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = tRegex.exec(rowContent)) !== null) {
    texts.push(decodeXmlText(match[1]));
  }
  return texts.join('').trim();
};

/**
 * Row text with list numbering stripped from the first cell (e.g. "4)" -> "").
 */
const getRowTextWithoutListPrefix = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length === 0) return getRowText(rowContent);

  const cellTexts = cells.map((c) => getRowText(c[2]));
  const first = cellTexts[0].replace(/^\d+\)\s*/, '').trim();
  const rest = cellTexts.slice(1).map((t) => t.trim());
  return [first, ...rest].join('').trim();
};

/**
 * Signature-mark placeholders left in Annexure-E / similar heir tables (e.g. "X").
 * These must not keep an otherwise-empty numbered heir row visible.
 */
const isSignaturePlaceholderOnly = (text) => {
  const t = String(text || '').trim();
  if (!t) return true;
  return /^(x|✓|✔|☑|☐|□|■|_+|-+|\.+)$/i.test(t);
};

/** Header-only cells in ISR holder/signature tables (not real claimant data). */
const isUnusedHolderColumnHeader = (text) =>
  /^(?:security\s+)?holder\s*\d+(?:\s*\/\s*claimant)?$/i.test(String(text || '').trim());

const isEmptyHolderTableCell = (text) => {
  const t = String(text || '').trim();
  if (isEmptyOrSeparatorOnly(t) || isSignaturePlaceholderOnly(t)) return true;
  if (/^\[[^\]]+\]$/.test(t)) return true;
  if (isUnusedHolderColumnHeader(t)) return true;
  return false;
};

/**
 * ISR-4 Section C: drop "Joint Holder (3)" when claimant 3 has no name.
 */
const isEmptyIsr4JointHolder3Row = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length < 2) return false;
  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  const label = cellTexts[0].replace(/\s+/g, ' ');
  if (!/joint\s*holder\s*1?\s*\(\s*3\s*\)/i.test(label)) return false;
  return cellTexts.slice(1).every((t) => isEmptyHolderTableCell(t));
};

const isBlankHeirCell = (text) =>
  isEmptyOrSeparatorOnly(text) || isSignaturePlaceholderOnly(text);

/** Cells that shouldn't keep an otherwise-empty claimant/heir row visible */
const isInsignificantHeirDetailCell = (text) => {
  if (isBlankHeirCell(text)) return true;
  const t = String(text || '').replace(/^[,.\s&;]+|[,.\s&;]+$/g, '').trim();
  if (!t) return true;
  // Unreplaced leftover tags after empty C3/C2 (e.g. "[Age C3]")
  if (/^\[[^\]]+\]$/.test(t)) return true;
  if (/^(address|mobile no|age|pin|relation with deceased|deceased relation)(\s*c\d+)?$/i.test(t)) {
    return true;
  }
  // Lone Indian PIN / mobile leftovers after empty name
  if (/^\d{6}$/.test(t)) return true;
  if (/^\d{10}$/.test(t)) return true;
  if (/^(\d{6}|\d{10})(\s*,\s*(\d{6}|\d{10}))*$/.test(t)) return true;
  return false;
};

/**
 * Annexure-F Claimants Details (4-col, no list numbers): hide C2/C3 when the
 * name cell is blank. Leftover PIN/mobile from another claimant must not keep
 * the empty row visible.
 */
const isEmptyClaimantDetailsRow = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length !== 4) return false;

  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  const joined = cellTexts.join(' ').toLowerCase();

  if (/name of the claimant|name of the legal heir/i.test(joined)) return false;
  if (/company\s*name|folio|securities\s*held|certificate\s*no|distinctive/i.test(joined)) {
    return false;
  }
  if (/^age$/i.test(cellTexts[2]) && /relationship/i.test(cellTexts[3])) return false;

  const nameEmpty = isBlankHeirCell(cellTexts[0]);
  if (!nameEmpty) return false;

  return cellTexts.slice(1).every((t) => isInsignificantHeirDetailCell(t));
};

/**
 * True when a table row only has list numbering (e.g. "4)") with no heir data.
 * Signature column may still contain a static "X" mark — treat that as empty.
 * Also drop empty C3/LH slots that only have leftover PIN/mobile after the name is blank.
 */
const isNumberedEmptyHeirRow = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length === 0) return false;

  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  // "3) Name" / "3)" / "(3)" → strip leading list number
  const firstWithoutNum = cellTexts[0]
    .replace(/^\s*\(?\d{1,2}\)?\s*[).:-]?\s*/, '')
    .trim();

  const nameEmpty =
    isBlankHeirCell(firstWithoutNum) ||
    /^\(?\d{1,2}\)?\s*[).:-]?\s*$/.test(cellTexts[0]);

  const otherCellsInsignificant = cellTexts
    .slice(1)
    .every((t) => isInsignificantHeirDetailCell(t));

  // Only treat as heir/signature list rows (2–5 cols), not securities headers
  if (cells.length < 2 || cells.length > 5) return false;
  const joined = cellTexts.join(' ').toLowerCase();
  if (/company\s*name|folio|securities\s*held|certificate\s*no|distinctive/i.test(joined)) {
    return false;
  }

  const hasListNumber =
    /^\s*\(?\d{1,2}\)?\s*[).:-]?/.test(cellTexts[0]) ||
    /^\s*\d{1,2}\s*\)/.test(getRowText(rowContent));
  if (!hasListNumber) return false;

  return nameEmpty && otherCellsInsignificant;
};

/**
 * Strip leading roman-numeral list markers: "i)", "ii)", "iii)", "iv)", "(iii)"
 */
const stripRomanListPrefix = (text) =>
  String(text || '')
    .replace(/^\s*\(?[ivx]{1,4}\)?\s*[).:-]?\s*/i, '')
    .trim();

/**
 * ISR-2 Bank Joint (and similar): 2-column Account holder PAN | Name rows.
 * After population, empty claimants leave only "iii)" / "iv)" labels — remove those rows.
 * Keep rows that still have a PAN or name after the roman prefix.
 */
const isEmptyAccountHolderPanNameRow = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length < 2 || cells.length > 3) return false;

  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  const joined = cellTexts.join(' ');

  // Do not touch header / photo / other section rows
  if (/account\s*holder|photograph|bank\s*records|signature|folio|company/i.test(joined)) {
    return false;
  }

  const hasRomanMarker = cellTexts.some((t) =>
    /^\s*\(?[ivx]{1,4}\)?\s*[).:]/i.test(t) || /^\s*[ivx]{1,4}\)\s*$/i.test(t)
  );
  if (!hasRomanMarker) return false;

  // Every cell is empty once roman list prefixes are removed
  return cellTexts.every((t) => {
    const stripped = stripRomanListPrefix(t);
    return isEmptyOrSeparatorOnly(stripped);
  });
};

/**
 * True when a face-value cell is effectively empty (e.g. "Rs./-").
 */
const isEmptyFaceValue = (text) => {
  if (isEmptyOrSeparatorOnly(text)) return true;
  return /^Rs\.?\s*\/?-?$/i.test(String(text).trim());
};

/**
 * Affidavit Cum Indemnity / similar: NOS cell keeps static label when empty:
 * "Number and Face Value Rs./-" — real rows start with quantity ("37 Number and...").
 */
const isEmptyNosOrFaceLabelCell = (text) => {
  if (isEmptyOrSeparatorOnly(text) || isEmptyFaceValue(text)) return true;
  const t = String(text).trim();
  if (/number\s*&?\s*face\s*value|number\s+and\s+face\s+value/i.test(t)) {
    return !/^\d+/.test(t);
  }
  return false;
};

/**
 * True when a securities table data row has no real securities identifiers,
 * even if Company Name / Folio / Face Value are repeated.
 * Supports:
 * - 5-col Annexure-E / Affidavit Cum Indemnity: Company, Folio, NOS(+label), SC, DN
 * - 6-col Form-B: Company, Folio, NOS, Face, SC, DN
 * - 6-col ISR-1 auth: S.No., Company, Folio, NOS, Face, DN
 */
const isEmptySecuritiesDataRow = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length < 5) return false;

  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  const joined = cellTexts.join(' ').toLowerCase();

  const headerLike =
    /^company$/i.test(cellTexts[0]) ||
    /company\s*name/i.test(cellTexts[0]) ||
    (/s\.?\s*no\.?/i.test(cellTexts[0]) && /company/i.test(joined)) ||
    (/folio/i.test(cellTexts[1]) && /quantity|securities held|number.*face/i.test(joined)) ||
    /securities\s*held/i.test(joined) ||
    (/certificate/i.test(joined) && /distinctive/i.test(joined) && /company/i.test(joined));
  if (headerLike) return false;

  // Sub-header row with From/To only
  if (cellTexts.some((t) => /^from$/i.test(t)) && cellTexts.some((t) => /^to$/i.test(t))) {
    return false;
  }

  const isBlankSecurity = (t) =>
    isEmptyOrSeparatorOnly(t) || isEmptyFaceValue(t) || isEmptyNosOrFaceLabelCell(t);

  // ISR-1 authorization table: S.No. | Company | Folio | Quantity | Face | DN
  if (cells.length >= 6 && /^\d{1,2}$/.test(cellTexts[0])) {
    return isBlankSecurity(cellTexts[3]) && isBlankSecurity(cellTexts[5]);
  }

  // 6+ columns: Company, Folio, NOS, Face Value, SC, DN
  if (cells.length >= 6) {
    return isBlankSecurity(cellTexts[2]) && isBlankSecurity(cellTexts[4]) && isBlankSecurity(cellTexts[5]);
  }

  // 5 columns: Company, Folio, NOS(+Face label), SC, DN
  return isBlankSecurity(cellTexts[2]) && isBlankSecurity(cellTexts[3]) && isBlankSecurity(cellTexts[4]);
};

/**
 * Remove table rows that are empty or contain only separators after population.
 */
const removeEmptyTableRows = (xml) => {
  const next = xml.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullMatch, rowContent) => {
    // Preserve rows containing images, drawings, shapes, or textboxes
    if (/<w:(?:drawing|pict|object|txbxContent)/i.test(rowContent) || /<v:(?:shape|rect|textbox|group|line)/i.test(rowContent) || /<mc:AlternateContent/i.test(rowContent)) {
      return fullMatch;
    }

    const rowText = getRowText(rowContent);
    if (
      isEmptyOrSeparatorOnly(rowText) ||
      isNumberedEmptyHeirRow(rowContent) ||
      isEmptyClaimantDetailsRow(rowContent) ||
      isEmptyAccountHolderPanNameRow(rowContent) ||
      isEmptySecuritiesDataRow(rowContent) ||
      isEmptyIsr4JointHolder3Row(rowContent)
    ) {
      return '';
    }
    return fullMatch;
  });
  if (isUnbalancedTableXml(next)) return xml;
  return next;
};

/**
 * After empty numbered heir rows are removed, renumber remaining "1)", "4)" → "1)", "2)".
 * Applies to Annexure-E style Legal Heir / Signature tables only.
 */
const renumberLegalHeirTableRows = (xml) => {
  return xml.replace(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g, (table) => {
    const tableText = getRowText(table).toLowerCase();
    if (!/legal\s*heir/.test(tableText)) return table;

    let counter = 0;
    return table.replace(/<w:tr\b[^>]*>[\s\S]*?<\/w:tr>/g, (row) => {
      const rowText = getRowText(row);
      if (/name\s*(of\s*the\s*)?legal\s*heir|signature\s*of\s*the\s*legal|address\s*and\s*contact|relationship\s*with/i.test(rowText)) {
        return row;
      }
      if (!/^\s*\d{1,2}\s*\)/.test(rowText)) return row;

      counter += 1;
      let replaced = false;
      return row.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (tm, attrs, text) => {
        if (replaced) return tm;
        if (!/^\s*\d{1,2}\s*\)/.test(text)) return tm;
        replaced = true;
        const next = text.replace(/^\s*\d{1,2}\s*\)/, `${counter})`);
        return `<w:t${attrs}>${next}</w:t>`;
      });
    });
  });
};

/**
 * True when a run uses a symbol font (Wingdings etc.) — must not receive body text.
 */
const runUsesSymbolFont = (runXml) =>
  /w:ascii="(?:Wingdings|Wingdings 2|Wingdings 3|Webdings|Symbol|MT Extra)"/i.test(runXml || '');

/**
 * Clean text within paragraphs — merge runs for formatting cleanup, escape XML on write.
 * Never write cleaned body text into Wingdings/Symbol runs (that produces garbled glyphs).
 */
const cleanParagraphsInXml = (xml) => {
  return xml.replace(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g, (fullMatch, pContent) => {
    // Extract visible paragraph text once for layout detection
    const paraTexts = [];
    const paraTRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let paraMatch;
    while ((paraMatch = paraTRegex.exec(pContent)) !== null) {
      paraTexts.push(decodeXmlText(paraMatch[1]));
    }
    const paraFullText = paraTexts.join('');

    // Date / signature lines that use tabs or multi-space blanks — do not merge/collapse
    // (preserves "on this ____ day of ____ , 2026" and DEPONENT alignment)
    const hasTabs = /<w:tab[\s/>]/i.test(pContent);
    const isLayoutPara =
      (hasTabs || / {3,}/.test(paraFullText) || /\u00A0{2,}/.test(paraFullText)) &&
      /\b(day\s+of|deponent|solemnly\s+affirmed\s+at|on\s+this)\b/i.test(paraFullText);
    if (isLayoutPara) {
      // Light cleanup only: strip undefined/null leftovers inside text nodes
      if (!/undefined|null/i.test(paraFullText)) {
        return fullMatch;
      }
      let light = pContent.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (tm, attrs, text) => {
        const cleaned = decodeXmlText(text).replace(/undefined|null/gi, '');
        return `<w:t${attrs}>${escapeXmlText(cleaned)}</w:t>`;
      });
      return fullMatch.replace(pContent, light);
    }

    // Extract all runs
    const runs = [...pContent.matchAll(/(<w:r(?:\s[^>]*)?>)([\s\S]*?)(<\/w:r>)/g)];
    if (runs.length === 0) return fullMatch;
    
    // Group runs into segments separated by boundary runs (tabs, breaks, drawing, symbols, etc.)
    const segments = [];
    let currentSegment = [];
    
    for (let i = 0; i < runs.length; i++) {
      const runFull = runs[i][0];
      const runInner = runs[i][2];
      
      const isBoundary = /<w:(?:tab|br|cr|drawing|pict|object|lastRenderedPageBreak)/i.test(runInner) || runUsesSymbolFont(runFull);
      
      if (isBoundary) {
        if (currentSegment.length > 0) {
          segments.push([...currentSegment]);
          currentSegment = [];
        }
        segments.push([runs[i]]);
      } else {
        currentSegment.push(runs[i]);
      }
    }
    if (currentSegment.length > 0) {
      segments.push(currentSegment);
    }
    
    let newPContent = pContent;
    
    // Process each segment
    for (const segment of segments) {
      if (segment.length === 0) continue;
      
      const firstRunFull = segment[0][0];
      const firstRunInner = segment[0][2];
      const isBoundarySegment = segment.length === 1 && (/<w:(?:tab|br|cr|drawing|pict|object|lastRenderedPageBreak)/i.test(firstRunInner) || runUsesSymbolFont(firstRunFull));
      
      if (isBoundarySegment) {
        // Just clean the text inside this boundary run without touching anything else (ignore symbols)
        if (!runUsesSymbolFont(firstRunFull)) {
          const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
          let textParts = [];
          let match;
          while ((match = tRegex.exec(firstRunInner)) !== null) {
            textParts.push(decodeXmlText(match[1]));
          }
          if (textParts.length > 0) {
             const fullText = textParts.join('');
             const cleaned = cleanFormattedListText(fullText);
             const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim();
             if (normalizeWhitespace(cleaned) !== normalizeWhitespace(fullText)) {
                const escaped = escapeXmlText(cleaned);
                let replaced = false;
                const updatedInner = firstRunInner.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_tm, attrs) => {
                  if (replaced) return `<w:t${attrs}></w:t>`;
                  replaced = true;
                  const spaceAttr = escaped.startsWith(' ') || escaped.endsWith(' ') ? ' xml:space="preserve"' : '';
                  let newAttrs = attrs || '';
                  if (spaceAttr && !/xml:space=/.test(newAttrs)) newAttrs += spaceAttr;
                  return `<w:t${newAttrs}>${escaped}</w:t>`;
                });
                newPContent = newPContent.replace(firstRunFull, segment[0][1] + updatedInner + segment[0][3]);
             }
          }
        }
        continue;
      }
      
      // Normal segment - extract all text, clean it, and place it in the best body-text run
      // (not a whitespace-only / oversized run — that caused ISR-1 "cancelled cheque" to print huge)
      let textParts = [];
      let targetRunIdx = -1;
      let bestScore = -Infinity;

      for (let i = 0; i < segment.length; i++) {
        const runFull = segment[i][0];
        const runInner = segment[i][2];
        const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let match;
        let runText = '';
        let hasTextNode = false;
        while ((match = tRegex.exec(runInner)) !== null) {
          runText += decodeXmlText(match[1]);
          hasTextNode = true;
        }
        if (!hasTextNode) continue;
        textParts.push(runText);

        const meaningful = runText.trim().length > 0;
        const szMatch = runFull.match(/<w:sz(?:Cs)? w:val="(\d+)"/i);
        const sz = szMatch ? parseInt(szMatch[1], 10) : 24;
        // Prefer real words; prefer ~12pt (sz 24); heavily penalize space-only / huge decorative runs
        let score = meaningful ? 1000 : 0;
        score += Math.max(0, 40 - Math.abs(sz - 24));
        if (!meaningful) score -= 200;
        if (sz >= 36) score -= 80;
        if (score > bestScore) {
          bestScore = score;
          targetRunIdx = i;
        }
      }

      if (textParts.length === 0 || targetRunIdx === -1) continue;

      const fullText = textParts.join('');
      const cleanedFull = cleanFormattedListText(fullText);
      const normalizeWhitespace = (str) => str.replace(/\s+/g, ' ').trim();
      if (normalizeWhitespace(fullText) === normalizeWhitespace(cleanedFull)) continue;

      const escaped = escapeXmlText(cleanedFull);

      for (let i = 0; i < segment.length; i++) {
        const runMatch = segment[i];
        const runFull = runMatch[0];
        const runOpen = runMatch[1];
        const runInner = runMatch[2];
        const runClose = runMatch[3];

        if (!/<w:t[\s>]/.test(runInner)) continue;

        if (i === targetRunIdx) {
          let replaced = false;
          // Ensure body text is not left on an oversized run (half-points: 24 = 12pt)
          let normalizedOpen = runOpen.replace(
            /(<w:sz(?:Cs)?\s+w:val=")(\d+)(")/gi,
            (m, a, val, c) => (parseInt(val, 10) >= 36 ? `${a}24${c}` : m)
          );
          // If no sz on run but cleaned text is long body copy, leave as-is
          const updatedInner = runInner.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_tm, attrs) => {
            if (replaced) return `<w:t${attrs}></w:t>`;
            replaced = true;
            const spaceAttr = escaped.startsWith(' ') || escaped.endsWith(' ') ? ' xml:space="preserve"' : '';
            let newAttrs = attrs || '';
            if (spaceAttr && !/xml:space=/.test(newAttrs)) newAttrs += spaceAttr;
            return `<w:t${newAttrs}>${escaped}</w:t>`;
          });
          newPContent = newPContent.replace(runFull, normalizedOpen + updatedInner + runClose);
        } else {
          // Clear text from other runs in this segment to avoid duplicates
          const clearedInner = runInner.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_tm, attrs) => `<w:t${attrs}></w:t>`);
          newPContent = newPContent.replace(runFull, runOpen + clearedInner + runClose);
        }
      }
    }
    
    return fullMatch.replace(pContent, newPContent);
  });
};

/**
 * Remove trailing table columns that are completely empty across all rows.
 * Skip tables with horizontally merged cells (gridSpan): ISR-4 Transposition
 * certificate/DN rows span the last two columns, and treating "missing" cells
 * as empty would delete the value column.
 */
const removeTrailingEmptyTableColumns = (xml) => {
  return xml.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tableMatch, tableContent) => {
    if (/<w:gridSpan w:val="[2-9]\d*"/i.test(tableContent)) {
      return tableMatch;
    }
    const rowMatches = [...tableContent.matchAll(/(<w:tr(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tr>)/g)];
    if (rowMatches.length === 0) return tableMatch;

    const cellMatrix = rowMatches.map((m) => {
      const cells = [...m[2].matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
      return cells.map((c) => ({ open: c[1], content: c[2], close: c[3], text: getRowText(c[2]) }));
    });

    const maxCols = Math.max(...cellMatrix.map((r) => r.length), 0);
    if (maxCols <= 1) return tableMatch;

    let trailingEmptyCols = 0;
    for (let colIdx = maxCols - 1; colIdx >= 1; colIdx--) {
      // Never strip the first column (usually row labels: Name, PIN, S.No., etc.)
      const allEmptyInCol = cellMatrix.every((row) => {
        if (colIdx >= row.length) return true;

        // Check if the cell contains media (images, drawings, shapes)
        const hasMedia =
          /<w:(?:drawing|pict|object|txbxContent)/i.test(row[colIdx].content) ||
          /<v:(?:shape|rect|textbox|group|line)/i.test(row[colIdx].content) ||
          /<mc:AlternateContent/i.test(row[colIdx].content);
        if (hasMedia) return false;

        const t = String(row[colIdx].text || '').trim();
        if (isEmptyHolderTableCell(t)) return true;
        return false;
      });
      if (allEmptyInCol && colIdx === maxCols - 1 - trailingEmptyCols) {
        trailingEmptyCols++;
      } else {
        break;
      }
    }

    if (trailingEmptyCols === 0) return tableMatch;

    const rebuiltRows = rowMatches.map((m, rowIdx) => {
      const cells = cellMatrix[rowIdx];
      const kept = cells.slice(0, Math.max(0, cells.length - trailingEmptyCols));
      const newContent = kept.map((c) => c.open + c.content + c.close).join('');
      return m[1] + newContent + m[3];
    });

    let newTableContent = tableContent;
    rowMatches.forEach((m, i) => {
      newTableContent = newTableContent.replace(m[0], rebuiltRows[i]);
    });

    // Keep tblGrid column count in sync with row cells
    const gridMatch = newTableContent.match(/<w:tblGrid>([\s\S]*?)<\/w:tblGrid>/);
    if (gridMatch) {
      const gridCols = [...gridMatch[1].matchAll(/<w:gridCol[^>]*\/>/g)];
      if (gridCols.length > trailingEmptyCols) {
        const keptCols = gridCols.slice(0, gridCols.length - trailingEmptyCols);
        const newGrid = '<w:tblGrid>' + keptCols.map((c) => c[0]).join('') + '</w:tblGrid>';
        newTableContent = newTableContent.replace(gridMatch[0], newGrid);
      }
    }

    return '<w:tbl>' + newTableContent + '</w:tbl>';
  });
};

/**
 * Remove empty paragraphs for Non-Claimants and Deponents.
 */
const removeEmptyNonClaimantRows = (xml) => {
  return xml.replace(/<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g, (fullMatch, pContent) => {
    // Extract text from the paragraph
    const texts = [];
    const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let match;
    while ((match = tRegex.exec(pContent)) !== null) {
      texts.push(decodeXmlText(match[1]));
    }
    const fullText = texts.join('').trim();
    
    // Match empty Non-Claimant lines, e.g., "Name of the Non-Claimant-2: Sign-2 X _____"
    if (/^Name of the Non-Claimant-\d+:\s*(?:Sign-\d+\s*X?\s*_*)?$/i.test(fullText) || 
        /^Name of the Non-Claimant-\d+:\s*$/i.test(fullText)) {
      return '';
    }
    
    // Match empty Deponent lines that have literal "(2)" text
    if (/^\(\d+\)\s*$/.test(fullText)) {
      return '';
    }
    
    // Check for Word auto-numbered list items that have NO text content
    // These render as empty "(2)", "(3)", etc. if the placeholder was removed
    const hasMedia = /<w:(?:drawing|pict|object|txbxContent)/i.test(pContent) || 
                     /<v:(?:shape|rect|textbox|group|line)/i.test(pContent) || 
                     /<mc:AlternateContent/i.test(pContent);
                     
    if (fullText === '' && /<w:numPr>/i.test(pContent) && !hasMedia) {
      return '';
    }
    
    return fullMatch;
  });
};

/**
 * Clamp oversized body-run font sizes (half-points >= 36 / 18pt+) on non-symbol runs.
 * Prevents spacer runs (sz=40) from making merged paragraph text print huge after cleanup.
 */
const normalizeOversizedBodyFonts = (xml) => {
  return xml.replace(/<w:r\b[^>]*>[\s\S]*?<\/w:r>/g, (run) => {
    if (runUsesSymbolFont(run)) return run;
    return run.replace(/(<w:sz(?:Cs)?\s+w:val=")(\d+)(")/gi, (m, a, val, c) => {
      const n = parseInt(val, 10);
      return n >= 36 ? `${a}24${c}` : m;
    });
  });
};

const visibleWtText = (xml) =>
  [...String(xml || '').matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => decodeXmlText(m[1]))
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

const compactWtText = (xml) => visibleWtText(xml).replace(/\s+/g, '');

/**
 * True for Form-B / Affidavit Cum Indemnity docs that use floating
 * address + signature + office boxes. Labels are often split across w:t
 * runs ("F OR OFFICEUSE", "Signature of A ll holder"), so match visible
 * text rather than raw XML.
 */
const isFormBIndemnityXml = (xml) => {
  if (!xml) return false;
  const visible = visibleWtText(xml);
  const compact = visible.replace(/\s+/g, '');
  if (!/INDEMNITY/i.test(visible) && !/INDEMNITY/i.test(xml)) return false;
  if (/Form[\s-]*B/i.test(visible)) return true;
  if (/SignatureofAllholder/i.test(compact)) return true;
  return /AddressofFirstHolder/i.test(compact) && /INWITNESSWHEREOF/i.test(compact);
};

/**
 * Annexure-F Claimants Details: the C3 row was copied from C2, so contact
 * used [Mobile No C2]. That leftover C2 mobile kept an empty C3 row visible.
 * Also merge split [Relation with Deceased C3] so the tag resolves.
 */
const fixAnnexureFClaimantsC3Row = (xml) => {
  if (!xml || !/Name as per Aadhar C3/.test(xml)) return xml;

  return xml.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullRow, rowContent) => {
    const rowText = getRowText(rowContent);
    if (!/Name as per Aadhar C3/.test(rowText)) return fullRow;

    let updated = fullRow.replace(/\[Mobile No C2\]/g, '[Mobile No C3]');
    updated = updated.replace(
      /<w:t(\s[^>]*)?>\[<\/w:t><\/w:r>([\s\S]{0,500}?<w:t(?:\s[^>]*)?>)Relation with Deceased<\/w:t><\/w:r>[\s\S]{0,500}?<w:t(?:\s[^>]*)?>\s*C3\]<\/w:t><\/w:r>/,
      '<w:t$1>[Relation with Deceased C3]</w:t></w:r>'
    );
    return updated;
  });
};

/**
 * Form-B templates accidentally contain `strokecolor="black [3040]"` inside VML.
 * With `[`/`]` delimiters, docxtemplater treats `[3040]` as a tag and corrupts drawings
 * (Word "unreadable content" / floating boxes jumping onto body text).
 */
/**
 * ISR-4 Transposition Section C is stored as two tables split by a continuous
 * section break (page-number restart). That cuts Joint Holder (3) / certificate
 * rows onto the next page as an empty-looking fragment. Merge them and keep
 * rows from splitting.
 */
const tablePlainText = (tableXml) =>
  [...String(tableXml || '').matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');

const isIsr4SectionCHeadTable = (tableXml) => {
  const p = tablePlainText(tableXml);
  return (
    /Name of the Company/i.test(p) &&
    /Folio Number/i.test(p) &&
    /First Holder/i.test(p) &&
    !/Certificate\s*Numbers/i.test(p)
  );
};

const isIsr4SectionCTailTable = (tableXml) => {
  const p = tablePlainText(tableXml);
  return /Certificate\s*Numbers/i.test(p) && /Distinctive\s*Numbers/i.test(p);
};

const addCantSplitToTableRows = (tableXml) =>
  tableXml.replace(/<w:tr\b[^>]*>([\s\S]*?)<\/w:tr>/g, (row) => {
    if (/<w:cantSplit\b/.test(row)) return row;
    if (/<w:trPr[\s>/]/.test(row)) {
      return row.replace(/<w:trPr(\s[^>]*)?>/, (pr) => `${pr}<w:cantSplit/>`);
    }
    return row.replace(/(<w:tr\b[^>]*>)/, '$1<w:trPr><w:cantSplit/></w:trPr>');
  });

const fixIsr4TranspositionSectionCTable = (xml) => {
  if (!xml) return xml;
  const plain = tablePlainText(xml);
  if (!/Certificate\s*Numbers/i.test(plain) || !/Distinctive\s*Numbers/i.test(plain)) {
    return xml;
  }

  let result = xml;

  const tables = [];
  const re = /<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g;
  let match;
  while ((match = re.exec(result))) {
    tables.push({ start: match.index, end: match.index + match[0].length, xml: match[0] });
  }

  for (let i = 0; i < tables.length - 1; i++) {
    if (!isIsr4SectionCHeadTable(tables[i].xml) || !isIsr4SectionCTailTable(tables[i + 1].xml)) {
      continue;
    }

    const between = result.slice(tables[i].end, tables[i + 1].start);
    const sectPr = (between.match(/<w:sectPr\b[\s\S]*?<\/w:sectPr>/) || [])[0] || '';
    const tailXml = tables[i + 1].xml.replace(
      /<w:t([^>]*)>Holder1<\/w:t>/g,
      '<w:t$1>Holder</w:t>'
    );
    const tailRows = tailXml.match(/<w:tr\b[\s\S]*?<\/w:tr>/g) || [];
    let merged = tables[i].xml.replace(/<\/w:tbl>\s*$/, `${tailRows.join('')}</w:tbl>`);
    merged = addCantSplitToTableRows(merged);

    const afterSect = sectPr ? `<w:p><w:pPr>${sectPr}</w:pPr></w:p>` : '';
    result =
      result.slice(0, tables[i].start) +
      merged +
      afterSect +
      result.slice(tables[i + 1].end);
    break;
  }

  return result;
};

const sanitizeTemplateXmlArtifacts = (xml) => {
  if (!xml) return xml;
  let result = xml
    .replace(/strokecolor="black\s*\[3040\]"/gi, 'strokecolor="black"')
    .replace(/strokecolor="([^"]*?)\s*\[3040\]"/gi, 'strokecolor="$1"');
  result = fixIsr4TranspositionSectionCTable(result);
  result = fixAnnexureFClaimantsC3Row(result);
  result = fixIEPFIndemnityBondLayout(result);
  result = ensureFormBRtaNamePlaceholder(result);
  result = fixAffidavitCumIndemnityPlaceholders(result);
  result = result.replace(/<w:lastRenderedPageBreak\b[^>]*\/?>/gi, '');
  result = removeEmptyLayoutDrawings(result);
  result = fixAnnexureDDeponentAlignment(result);
  return result;
};

/**
 * Form-B Point 3 should read: [Company Name] / [RTA Name] (Company / RTA name).
 * Several All/Multiple templates only have [Company Name] before that parenthetical.
 */
const ensureFormBRtaNamePlaceholder = (xml) => {
  if (!xml || !/Company\s*\/\s*RTA name/i.test(xml)) return xml;

  return xml.replace(
    /(<w:t[^>]*>)(\[Company Name\])(<\/w:t><\/w:r>)([\s\S]{0,2500}?)(Company\s*\/\s*RTA name)/gi,
    (full, open, tag, close, mid, paren) => {
      if (/\[RTA Name\]/i.test(mid)) return full;
      const midPlain = [...mid.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1].replace(/&amp;/g, '&'))
        .join('');
      if (!/^[\s(]*$/.test(midPlain)) return full;
      return (
        `${open}${tag}${close}` +
        '<w:r><w:t xml:space="preserve"> / </w:t></w:r>' +
        '<w:r><w:t>[RTA Name]</w:t></w:r>' +
        `${mid}${paren}`
      );
    }
  );
};

/**
 * Affidavit-cum-Indemnity (Annexure-A) templates:
 * - `[Name of the Company/RTA]` is an instructional label, not a data field.
 *   Left as a tag it survives populate (screenshot leftover after RTA/Company).
 * - `[Face Value ]` trailing space does not match mapped `Face Value`.
 * - Title notes wrapped in [ ] are parsed as tags and get wiped or preserved.
 */
const fixAffidavitCumIndemnityPlaceholders = (xml) => {
  if (!xml) return xml;

  let result = xml.replace(
    /\[Name of the Company\s*\/\s*RTA\]/gi,
    '(Name of the Company/RTA)'
  );

  result = result.replace(/\[([^\]]+?)\]/g, (full, inner) => {
    if (/</.test(inner)) return full;
    const trimmed = String(inner).replace(/^\s+|\s+$/g, '');
    if (!trimmed || trimmed === inner) return full;
    return `[${trimmed}]`;
  });

  const isAffidavitBond =
    /AFFIDAVIT-?CUM-?INDEMNITY/i.test(xml) ||
    /Affidavit Cum Indemnity/i.test(xml) ||
    /Format for Affidavit-cum-Indemnity/i.test(xml);
  if (!isAffidavitBond) return result;

  result = result.replace(
    /\[For issuance of duplicate securities\]/gi,
    'For issuance of duplicate securities'
  );
  result = result.replace(
    /\[To be submitted in non-judicial stamp paper[^\]]*\]/gi,
    (tag) => tag.slice(1, -1)
  );

  return result;
};

const iepfParaPlain = (paraXml) =>
  [...String(paraXml || '').matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1].replace(/&amp;/g, '&'))
    .join('');

/**
 * Official IEPF indemnity blanks:
 *   Financial Year [year]
 *   from (Name of company or Bank on the basis of CIN/BCIN) [company]
 *   out of the IEPF by the Authority, I [claimant(s)]
 *   son / daughter of [father(s)]
 * Older sanitizes put company after the year and claimants before "out of".
 */
const placeIEPFIndemnityMappedFields = (xml, isMultiple) => {
  if (!xml) return xml;
  const nameInsert = isMultiple
    ? '[Name as per PAN C1] &amp; [Name as per PAN C2] &amp; [Name as per PAN C3]'
    : '[Name as per PAN C1]';

  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const text = iepfParaPlain(para);

    if (
      /\[Financial Dividend Year\]/i.test(text) &&
      /\[Company Name\]/i.test(text) &&
      !/CIN\/BCIN/i.test(text)
    ) {
      return para.replace(
        /<w:r\b[^>]*>[\s\S]*?<w:t[^>]*>\s*\[Company Name\]\s*<\/w:t>[\s\S]*?<\/w:r>/gi,
        ''
      );
    }

    if (
      /CIN\/BCIN/i.test(text) &&
      /Name of company or Bank/i.test(text) &&
      !/\[Company Name\]/i.test(text)
    ) {
      return para.replace(
        /<\/w:p>$/i,
        '<w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Company Name]</w:t></w:r></w:p>'
      );
    }

    const isAuthorityLine =
      /out of the Investor Education/i.test(text) ||
      (/\[Name as per PAN C1\]/i.test(text) && /\bI\s*$/i.test(text.trim()));
    if (!isAuthorityLine) return para;

    let next = para;
    if (/\[Name as per PAN C1\]/i.test(text) && !/I\s*\[Name as per PAN C1\]/i.test(text)) {
      next = next.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (full, attrs, t) => {
        if (!/\[Name as per PAN C/i.test(t)) return full;
        const kept = t
          .replace(/\[Name as per PAN C[123]\]/gi, '')
          .replace(/&amp;/gi, '')
          .replace(/&/g, '')
          .replace(/\s+/g, ' ')
          .trim();
        if (!kept) return `<w:t${attrs}></w:t>`;
        const spaceAttr =
          (kept.startsWith(' ') || kept.endsWith(' ')) && !/xml:space=/.test(attrs || '')
            ? ' xml:space="preserve"'
            : '';
        return `<w:t${attrs}${spaceAttr}>${kept}</w:t>`;
      });
    }

    const afterStrip = iepfParaPlain(next);
    if (/I\s*\[Name as per PAN C1\]/i.test(afterStrip)) return next;

    if (/<w:t[^>]*>I\s*<\/w:t>\s*<\/w:r>\s*<\/w:p>$/i.test(next)) {
      return next.replace(
        /(<w:t[^>]*>I\s*<\/w:t>)(\s*<\/w:r>\s*)(<\/w:p>)$/i,
        `$1$2<w:r><w:t xml:space="preserve"> ${nameInsert}</w:t></w:r>$3`
      );
    }
    return next.replace(
      /<\/w:p>$/i,
      `<w:r><w:t xml:space="preserve"> ${nameInsert}</w:t></w:r></w:p>`
    );
  });
};

const iepfParagraphRuns = (paraXml) => {
  const inner = String(paraXml || '')
    .replace(/^<w:p\b[^>]*>/, '')
    .replace(/<\/w:p>$/, '');
  return inner.replace(/^<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/, '');
};

/**
 * Original IEPF Word file is a 2-/3-column form with <w:br type="column"/>.
 * After flattening to one column those column breaks become PAGE breaks in Word
 * (address on page 1, "Rs" on page 2, share count on page 3, rest on page 4).
 * Merge the legal body into one paragraph and drop spacer empties.
 */
const flattenIEPFIndemnityFlow = (xml) => {
  if (!xml) return xml;
  const visible = [...xml.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
    .map((m) => m[1])
    .join(' ')
    .replace(/\s+/g, ' ');
  if (!/Investor Education and Protection Fund Authority/i.test(visible)) return xml;
  if (
    !/Indemnity\s+Bond/i.test(visible) &&
    !/In\s+consideration\s+of\s+the\s+payment/i.test(visible)
  ) {
    return xml;
  }

  let result = xml.replace(/<w:r\b[^>]*>\s*<w:br\b[^>]*w:type="column"[^>]*\/?>\s*<\/w:r>/gi, '');
  result = result.replace(/<w:br\b[^>]*w:type="column"[^>]*\/?>/gi, '');

  const collectParas = (docXml) => {
    const list = [];
    const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
    let m;
    while ((m = re.exec(docXml))) {
      list.push({
        full: m[0],
        start: m.index,
        end: m.index + m[0].length,
        text: iepfParaPlain(m[0]).replace(/\s+/g, ' ').trim(),
      });
    }
    return list;
  };

  const paras = collectParas(result);
  const firstBody = paras.findIndex((p) =>
    /In\s+consideration\s+of\s+the\s+payment/i.test(p.text)
  );
  const firstSig = paras.findIndex((p) => /^Signature$/i.test(p.text));

  if (firstBody >= 0) {
    const endIdx = firstSig > firstBody ? firstSig : paras.length;
    const body = paras.slice(firstBody, endIdx).filter((p) => p.text);
    if (body.length > 1) {
      const spaceRun = '<w:r><w:t xml:space="preserve"> </w:t></w:r>';
      let mergedInner = iepfParagraphRuns(body[0].full);
      for (let i = 1; i < body.length; i += 1) {
        mergedInner += spaceRun + iepfParagraphRuns(body[i].full);
      }
      mergedInner = mergedInner.replace(/<w:r\b[^>]*>\s*<w:br\b[^>]*\/?>\s*<\/w:r>/gi, '');
      mergedInner = mergedInner.replace(/<w:br\b[^>]*\/?>/gi, '');
      mergedInner = mergedInner.replace(/<w:tab\s*\/>/gi, '');

      const open = body[0].full.match(/^<w:p\b[^>]*>/)[0];
      let pPr = (body[0].full.match(/<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>/) || [''])[0];
      pPr = pPr.replace(/<w:tabs\b[^>]*>[\s\S]*?<\/w:tabs>/gi, '');
      pPr = pPr.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi, '');
      const mergedPara = `${open}${pPr}${mergedInner}</w:p>`;
      const blankPara = '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr></w:p>';
      result =
        result.slice(0, paras[firstBody].start) +
        mergedPara +
        blankPara +
        result.slice(paras[endIdx - 1].end);
    }
  }

  // Consecutive empty spacer paragraphs (from the old form grid) → a single blank
  result = result.replace(
    /(?:<w:p\b[^>]*>\s*(?:<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>\s*)?(?:<w:r\b[^>]*>[\s\S]*?<\/w:r>\s*)*<\/w:p>\s*){2,}/g,
    (block) => {
      if (/<w:t[^>]*>[^<]*\S/.test(block)) return block;
      return '<w:p><w:pPr><w:pStyle w:val="BodyText"/></w:pPr></w:p>';
    }
  );

  return result;
};

/**
 * IndemnityBond_IEPF_* templates put key fields in floating textboxes on a
 * multi-column / continuous-section layout. docx-preview then shows only the
 * address header (body appears blank) even when data maps. Move placeholders
 * into body flow, drop those floats, collapse continuous sections, and force
 * a normal single-column page.
 */
const fixIEPFIndemnityBondLayout = (xml) => {
  if (!xml) return xml;
  const isIEPFBond =
    /Investor Education and Protection Fund Authority/i.test(xml) &&
    (/Indemnity Bond/i.test(xml) || /\[Total Dividend Amount\]/i.test(xml) || /\[Total Shares\]/i.test(xml));
  if (!isIEPFBond) return xml;

  let result = xml;
  const isMultiple =
    /\[Name as per PAN C2\]/i.test(xml) || /\[Father Name C2\]/i.test(xml);

  const bodyPlain = (docXml) => {
    const sans = docXml.replace(/<w:txbxContent[\s\S]*?<\/w:txbxContent>/g, '');
    return [...sans.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
  };

  const normalizeSectPr = (sect) => {
    let s = sect.replace(/<w:cols\b[^>]*>[\s\S]*?<\/w:cols>/gi, '<w:cols w:space="720"/>');
    s = s.replace(/<w:cols\b[^/]*\/>/gi, '<w:cols w:space="720"/>');
    s = s.replace(/<w:type\s+w:val="continuous"\s*\/>/gi, '');
    s = s.replace(/<w:pgSz\b[^>]*\/?>/gi, '<w:pgSz w:w="12240" w:h="15840"/>');
    return s;
  };

  // Continuous section breaks were used for the float/column layout. After we
  // flatten to one column, intermediate sectPr make docx-preview show only the
  // first section (address + title) and hide the bond body.
  const sectMatches = [...result.matchAll(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi)];
  if (sectMatches.length > 1) {
    let seen = 0;
    const total = sectMatches.length;
    result = result.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi, (sect) => {
      seen += 1;
      if (seen < total) return '';
      return normalizeSectPr(sect);
    });
  } else {
    result = result.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi, normalizeSectPr);
  }

  // Clean empty paragraph properties left after removing intermediate sectPr
  result = result.replace(/<w:pPr>\s*<\/w:pPr>/g, '');

  let plain = bodyPlain(result);

  // "Rs" → include dividend amount in body flow
  if (!/Rs\s*\[Total Dividend Amount\]/i.test(plain)) {
    const next = result.replace(/(<w:t[^>]*>)Rs(<\/w:t>)/, '$1Rs [Total Dividend Amount] $2');
    if (next !== result) {
      result = next;
      plain = bodyPlain(result);
    }
  }

  // "shares" … "being" → include share count
  if (!/shares\s*\[Total Shares\]/i.test(plain)) {
    const next = result.replace(
      /(<w:t[^>]*>)shares(<\/w:t>)([\s\S]{0,500}?<w:t[^>]*>)being(<\/w:t>)/i,
      '$1shares [Total Shares] $2$3being$4'
    );
    if (next !== result) {
      result = next;
      plain = bodyPlain(result);
    }
  }

  // Base IEPF template may only have the year in a float — keep it on the FY line
  if (!/\[Financial Dividend Year\]/i.test(plain)) {
    const next = result.replace(
      /(Financial Year <\/w:t>)(<\/w:r>)/i,
      '$1$2<w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Financial Dividend Year]</w:t></w:r>'
    );
    if (next !== result) {
      result = next;
      plain = bodyPlain(result);
    }
  }

  // Remove floating boxes that only carry mapped placeholders (or empty leftovers)
  result = result.replace(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, (block) => {
    const text = [...block.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    const stripped = text
      .replace(/\[Total Shares\]/gi, '')
      .replace(/\[Total Dividend Amount\]/gi, '')
      .replace(/\[Company Name\]/gi, '')
      .replace(/\[Financial Dividend Year\]/gi, '')
      .replace(/\[Name as per PAN C[123]\]/gi, '')
      .replace(/&amp;/gi, '')
      .replace(/&/g, '')
      .replace(/\s+/g, '');
    const isPlaceholderFloat =
      /Total Shares|Total Dividend Amount|Company Name|Financial Dividend Year|Name as per PAN C/i.test(
        text
      );
    if (stripped === '' && (isPlaceholderFloat || /wp:anchor|w:txbxContent|v:textbox/i.test(block))) {
      return '';
    }
    return block;
  });

  // Collapse duplicate adjacent placeholders (body + leftover float copies)
  const dupTags = [
    'Total Shares',
    'Total Dividend Amount',
    'Financial Dividend Year',
    'Company Name',
    'Name as per PAN C1',
    'Name as per PAN C2',
    'Name as per PAN C3',
    'Father Name C1',
    'Father Name C2',
    'Father Name C3',
  ];
  dupTags.forEach((tag) => {
    const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const reSameNode = new RegExp(`(\\[${esc}\\])\\s*\\1`, 'gi');
    result = result.replace(reSameNode, '$1');
    const reAcrossRuns = new RegExp(
      `(\\[${esc}\\])(<\\/w:t>[\\s\\S]{0,240}?<w:t[^>]*>)\\s*\\[${esc}\\]`,
      'gi'
    );
    result = result.replace(reAcrossRuns, '$1$2');
  });

  // Official bond blanks: company after CIN/BCIN label; claimants after "I"
  result = placeIEPFIndemnityMappedFields(result, isMultiple);

  // Ensure spaces around key placeholders before surrounding words
  result = result.replace(/\[Financial Dividend Year\](?=\[)/gi, '[Financial Dividend Year] ');
  result = result.replace(/\[Total Shares\]\s*being/gi, '[Total Shares] being');
  result = result.replace(/\[Total Dividend Amount\]\s*and/gi, '[Total Dividend Amount] and');

  // Extreme negative character spacing collapses body text in browser preview
  result = result.replace(/<w:spacing\s+w:val="-\d+"\s*\/>/g, '');

  result = result.replace(/<w:drawing>\s*<\/w:drawing>/g, '');
  result = result.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');

  result = flattenIEPFIndemnityFlow(result);
  result = normalizeIEPFIndemnitySpacing(result);

  return result;
};

/**
 * When drawings/floats split words across adjacent <w:t> nodes (e.g. "amount"+"and"),
 * insert a trailing space on the left node if mid-XML has no other visible text.
 */
const insertIEPFCrossRunSpace = (xml, leftExact, rightPrefix) => {
  const esc = (s) => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(
    `(<w:t([^>]*)>)(${esc(leftExact)})(</w:t>)([\\s\\S]{0,800}?)(<w:t([^>]*)>)(${esc(rightPrefix)})`,
    'g'
  );
  return xml.replace(re, (full, open1, attrs1, left, close1, mid, open2, attrs2, right) => {
    const midPlain = [...mid.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join('');
    if (midPlain.replace(/\s+/g, '').length > 0) return full;
    if (/\s$/.test(left) || /^\s/.test(right)) return full;
    const spaceAttr = /xml:space=/.test(attrs1 || '') ? '' : ' xml:space="preserve"';
    return `<w:t${attrs1 || ''}${spaceAttr}>${left} </w:t>${mid}<w:t${attrs2 || ''}>${right}`;
  });
};

/**
 * Fix glued words / missing spaces typical of IEPF IndemnityBond templates
 * (both placeholder stage and after population).
 */
const normalizeIEPFIndemnitySpacing = (xml) => {
  if (!xml || !/Investor Education and Protection Fund Authority/i.test(xml)) return xml;

  let result = xml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (full, attrs, text) => {
    let t = text;
    // Common glued tokens in the official bond wording
    t = t.replace(/Rsand\b/gi, 'Rs and');
    t = t.replace(/sharesbeing\b/gi, 'shares being');
    t = t.replace(/amountand\b/gi, 'amount and');
    t = t.replace(/\bIson\b/g, 'I son');
    t = t.replace(/\bI(?=son\b)/g, 'I ');
    t = t.replace(/\)out\b/g, ') out');
    t = t.replace(/\)from\b/gi, ') from');
    t = t.replace(/([A-Za-z0-9\]\)])from\(/gi, '$1 from (');
    t = t.replace(/([A-Za-z0-9\])])from\b/gi, '$1 from');
    t = t.replace(/\bfrom\(/gi, 'from (');
    t = t.replace(/Year\[/gi, 'Year [');
    t = t.replace(/\]\[/g, '] [');
    // Ensure space after filled company / year before "from"
    t = t.replace(/(\d{4}\s*[-–]\s*\d{2,4})([A-Za-z])/g, '$1 $2');
    t = t.replace(/(LTD|LIMITED|BANK|PVT\.?|PRIVATE)(from\b)/gi, '$1 $2');
    // "No. of shares100" / "Rs12500"
    t = t.replace(/\b(Rs)\s*(\d)/gi, '$1 $2');
    t = t.replace(/\b(shares)\s*(\d)/gi, '$1 $2');
    t = t.replace(/BCIN\)([A-Za-z])/gi, 'BCIN) $1');
    t = t.replace(/\)([A-Z][a-z])/g, ') $1');
    // Preserve intentional leading/trailing spaces
    if (t === text) return full;
    const spaceAttr =
      (t.startsWith(' ') || t.endsWith(' ')) && !/xml:space=/.test(attrs || '')
        ? ' xml:space="preserve"'
        : '';
    return `<w:t${attrs || ''}${spaceAttr}>${t}</w:t>`;
  });

  // Cross-run glue (float/drawing boundaries prevent paragraph merge cleanup)
  result = insertIEPFCrossRunSpace(result, 'amount', 'and');
  result = insertIEPFCrossRunSpace(result, 'I', 'son');
  result = insertIEPFCrossRunSpace(result, 'from', '(Name');
  // ")" then next run starting with a capital letter (claimant name after BCIN))
  result = result.replace(
    /(<w:t([^>]*)>)(\))(<\/w:t>)([\s\S]{0,800}?)(<w:t([^>]*)>)([A-Z][A-Za-z])/g,
    (full, _open1, attrs1, left, _close1, mid, _open2, attrs2, right) => {
      const midPlain = [...mid.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
        .map((m) => m[1])
        .join('');
      if (midPlain.replace(/\s+/g, '').length > 0) return full;
      const spaceAttr = /xml:space=/.test(attrs1 || '') ? '' : ' xml:space="preserve"';
      return `<w:t${attrs1 || ''}${spaceAttr}>${left} </w:t>${mid}<w:t${attrs2 || ''}>${right}`;
    }
  );

  return result;
};

/**
 * After empty securities rows are removed, Form-B page-1 used to shorten so
 * page-relative signature/address floats painted over the intro. Those floats
 * are now rebuilt as an inline table, so a forced page break before
 * "IN WITNESS WHEREOF" only creates a blank stretched page. Keep this as a
 * no-op so older callers/tests can still import it.
 */
const ensureFormBWitnessPageBreak = (xml) => xml;

/**
 * Body paragraphs between IN WITNESS and "Signed before me" that only exist
 * because Word parked empty list items / unused claimant slots under the old
 * floating boxes. Left in the flow they become multi-page white gaps.
 */
const isUnusedWitnessSlotPara = (p) => {
  if (/<w:(?:drawing|pict|object|tbl)|<mc:AlternateContent|<w:txbxContent/i.test(p)) {
    return false;
  }
  const t = visibleWtText(p).replace(/\s+/g, ' ').trim();
  if (!t) return true;
  if (/^And$/i.test(t)) return true;
  if (/^And\s+\d+\)$/i.test(t)) return true;
  if (/^\d+\)$/i.test(t)) return true;
  if (/^#?,?$/.test(t)) return true;
  return false;
};

const stripLeadingWitnessHash = (p) => {
  const t = visibleWtText(p).replace(/\s+/g, ' ').trim();
  if (!/^[#,]/.test(t)) return p;
  let stripping = true;
  return p.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (full, attrs, text) => {
    if (!stripping) return full;
    const next = text.replace(/^\s*#\s*/, '').replace(/^\s*,\s*/, '');
    if (!String(next).trim()) {
      return `<w:t${attrs}></w:t>`;
    }
    stripping = false;
    return `<w:t${attrs}>${next}</w:t>`;
  });
};

const tightenFormBWitnessRegion = (xml) => {
  const start = xml.search(/IN WITNESS WHEREOF/i);
  if (start < 0) return xml;
  const signed = xml.search(/Signed before me/i);
  const end = signed >= 0 ? signed : xml.length;
  const region = xml.slice(start, end).replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (p) => {
    if (isUnusedWitnessSlotPara(p)) return '';
    return stripLeadingWitnessHash(p);
  });
  return xml.slice(0, start) + region + xml.slice(end);
};

const insertAfterMatchingParagraph = (xml, tableXml, testFn) => {
  const start = xml.search(/IN WITNESS WHEREOF/i);
  if (start < 0) return xml;
  const signed = xml.search(/Signed before me/i);
  const end = signed >= 0 ? signed : xml.length;
  const slice = xml.slice(start, end);
  const re = /<w:p\b[^>]*>[\s\S]*?<\/w:p>/g;
  let match;
  let insertAt = -1;
  while ((match = re.exec(slice))) {
    if (testFn(visibleWtText(match[0]))) {
      insertAt = start + match.index + match[0].length;
    }
  }
  if (insertAt < 0) {
    insertAt = end;
  }
  return xml.slice(0, insertAt) + tableXml + xml.slice(insertAt);
};

/**
 * Leftover empty floating rectangles (often named "Rectangles 18", sizeRel 0%)
 * render in docx-preview as a blank white box above the first page.
 * Only drop large empty shapes — keep checkboxes and signature-line boxes.
 */
const removeEmptyLayoutDrawings = (xml) => {
  if (!xml || !/<wp:anchor\b/i.test(xml)) return xml;

  const EMU_MIN = 1371600; // 1.5in — Affidavit leftover is ~3.8in x 2.5in

  const hasVisibleContent = (inner) => {
    const text = [...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join('')
      .replace(/\s+/g, '');
    if (text) return true;
    return /<a:blip\b|<v:imagedata\b/i.test(inner);
  };

  const isGhostBox = (inner) => {
    if (hasVisibleContent(inner)) return false;
    const ext = (inner.match(/<wp:extent\b[^>]*\/?>/i) || [''])[0];
    const cx = parseInt((ext.match(/cx="(\d+)"/) || [])[1] || '0', 10);
    const cy = parseInt((ext.match(/cy="(\d+)"/) || [])[1] || '0', 10);
    return cx >= EMU_MIN && cy >= EMU_MIN;
  };

  let result = xml.replace(/<mc:AlternateContent>([\s\S]*?)<\/mc:AlternateContent>/g, (block) => {
    const anchorMatch = block.match(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/);
    if (anchorMatch && isGhostBox(anchorMatch[1])) return '';
    return block;
  });

  result = result.replace(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/g, (full, inner) =>
    isGhostBox(inner) ? '' : full
  );

  result = result.replace(/<w:drawing>\s*<\/w:drawing>/g, '');
  result = result.replace(
    /<mc:AlternateContent>\s*<mc:Choice\b[^>]*>\s*<\/mc:Choice>\s*(?:<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>)?\s*<\/mc:AlternateContent>/g,
    ''
  );
  result = result.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');
  return result;
};

/**
 * Form-B signature/address/office boxes are wp:anchor floats with relativeFrom=page.
 * Even after a page break, Word still paints them over the intro paragraph when the
 * body is short. Pull the text out of those floats into a real table:
 *   [ Address of First Holder          (full width) ]
 *   [ Signature of All holders | FOR OFFICE USE ONLY ]
 * so the last two boxes sit side-by-side with a shared bottom edge (the default
 * template layout). Inline drawings were stacking on the left because 3.3"+3.4"
 * plus wrap distances exceeded the line width.
 *
 * Important: never leave empty <w:drawing></w:drawing> (Word "unreadable content").
 */
const formBLayoutBoxKind = (text) => {
  const compact = String(text || '').replace(/\s+/g, '');
  if (/AddressofFirstHolder/i.test(compact)) return 'address';
  if (/FOROFFICE/i.test(compact)) return 'office';
  if (/SignatureofAllholder/i.test(compact)) return 'signature';
  return null;
};

const formBBoxCellBorders = () =>
  `<w:tcBorders>
    <w:top w:val="single" w:sz="12" w:space="0" w:color="000000"/>
    <w:left w:val="single" w:sz="12" w:space="0" w:color="000000"/>
    <w:bottom w:val="single" w:sz="12" w:space="0" w:color="000000"/>
    <w:right w:val="single" w:sz="12" w:space="0" w:color="000000"/>
  </w:tcBorders>`;

const formBBoxCell = (innerXml, opts = {}) => {
  const { gridSpan = 1, width = 5000 } = opts;
  let content = String(innerXml || '').trim();
  if (!content) {
    content = '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
  } else if (!/<w:p\b/.test(content)) {
    content = `<w:p><w:r><w:t>${escapeXmlText(content)}</w:t></w:r></w:p>`;
  }
  content = content.replace(/F\s*OR\s*OFFICEUSE/gi, 'FOR OFFICE USE');
  content = content.replace(/FOR OFFICEUSE/gi, 'FOR OFFICE USE');
  const span = gridSpan > 1 ? `<w:gridSpan w:val="${gridSpan}"/>` : '';
  const vAlign = `<w:vAlign w:val="top"/>`;
  return `<w:tc>
    <w:tcPr>
      <w:tcW w:w="${width}" w:type="dxa"/>
      ${span}
      ${formBBoxCellBorders()}
      ${vAlign}
      <w:tcMar>
        <w:top w:w="80" w:type="dxa"/>
        <w:left w:w="100" w:type="dxa"/>
        <w:bottom w:w="80" w:type="dxa"/>
        <w:right w:w="100" w:type="dxa"/>
      </w:tcMar>
    </w:tcPr>
    ${content}
  </w:tc>`;
};

const extractFormBTxbxContent = (block) => {
  const match = String(block || '').match(/<w:txbxContent\b[^>]*>([\s\S]*?)<\/w:txbxContent>/i);
  if (!match) return '';
  let inner = match[1];
  inner = inner.replace(/<w:sectPr\b[^>]*>[\s\S]*?<\/w:sectPr>/gi, '');
  inner = inner.replace(/<w:lastRenderedPageBreak\b[^>]*\/?>/gi, '');
  // Textboxes used empty paragraphs to fill a tall float. In a table cell those
  // spacers stack and push "Signed before me" onto an extra page.
  inner = inner.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (p) => {
    if (/<w:(?:drawing|pict|object)|<mc:AlternateContent/i.test(p)) return p;
    return visibleWtText(p).replace(/\s+/g, '') ? p : '';
  });
  return inner;
};

const buildFormBSignatureTable = (boxes) => {
  const address = boxes.address ? extractFormBTxbxContent(boxes.address) : '';
  const signature = boxes.signature ? extractFormBTxbxContent(boxes.signature) : '';
  const office = boxes.office ? extractFormBTxbxContent(boxes.office) : '';
  const rows = [];
  if (address) {
    rows.push(`<w:tr>
    <w:trPr><w:cantSplit/><w:trHeight w:val="3000" w:hRule="atLeast"/></w:trPr>
    ${formBBoxCell(address, { gridSpan: 2, width: 10000 })}
  </w:tr>`);
  }
  if (signature && office) {
    rows.push(`<w:tr>
    <w:trPr><w:cantSplit/><w:trHeight w:val="2400" w:hRule="exact"/></w:trPr>
    ${formBBoxCell(signature, { width: 5000 })}
    ${formBBoxCell(office, { width: 5000 })}
  </w:tr>`);
  } else if (signature) {
    rows.push(`<w:tr>
    <w:trPr><w:cantSplit/><w:trHeight w:val="2400" w:hRule="exact"/></w:trPr>
    ${formBBoxCell(signature, { gridSpan: 2, width: 10000 })}
  </w:tr>`);
  } else if (office) {
    rows.push(`<w:tr>
    <w:trPr><w:cantSplit/><w:trHeight w:val="2400" w:hRule="exact"/></w:trPr>
    ${formBBoxCell(office, { gridSpan: 2, width: 10000 })}
  </w:tr>`);
  }
  if (!rows.length) return '';
  return `<w:tbl>
    <w:tblPr>
      <w:tblW w:w="10000" w:type="dxa"/>
      <w:jc w:val="left"/>
      <w:tblLayout w:type="fixed"/>
      <w:tblLook w:val="04A0"/>
    </w:tblPr>
    <w:tblGrid>
      <w:gridCol w:w="5000"/>
      <w:gridCol w:w="5000"/>
    </w:tblGrid>
    ${rows.join('')}
  </w:tbl>`;
};

const defloatFormBLayoutAnchors = (xml) => {
  if (!isFormBIndemnityXml(xml)) return xml;

  // Already converted on a previous pass
  const existingTbl = [...xml.matchAll(/<w:tbl\b[^>]*>[\s\S]*?<\/w:tbl>/g)].find((m) => {
    const compact = compactWtText(m[0]);
    return (
      /AddressofFirstHolder/i.test(compact) &&
      (/SignatureofAllholder/i.test(compact) || /FOROFFICE/i.test(compact))
    );
  });
  if (existingTbl) return xml;

  const boxes = { address: null, office: null, signature: null };
  const takeBlock = (block) => {
    const kind = formBLayoutBoxKind(visibleWtText(block));
    if (!kind || boxes[kind]) return block;
    boxes[kind] = block;
    return '';
  };

  let result = xml.replace(/<mc:AlternateContent>[\s\S]*?<\/mc:AlternateContent>/g, takeBlock);
  result = result.replace(/<w:drawing\b[^>]*>[\s\S]*?<\/w:drawing>/g, (block) => {
    if (boxes.address && boxes.office && boxes.signature) return block;
    return takeBlock(block);
  });

  if (!boxes.address && !boxes.office && !boxes.signature) return result;

  result = tightenFormBWitnessRegion(result);

  const tableXml = buildFormBSignatureTable(boxes);
  if (!tableXml) return result;

  result = insertAfterMatchingParagraph(
    result,
    tableXml,
    (text) => /this\s+day\s+of/i.test(text) || /hands and seals/i.test(text)
  );

  // Drop leftover zero-size decorative absolute lines
  result = result.replace(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/g, (full, inner) => {
    const text = [...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');
    if (!text.trim() && /<wp:extent\b[^>]*(?:cx="0"|cy="0")/i.test(inner)) return '';
    return full;
  });

  result = result.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');
  result = result.replace(/<w:drawing>\s*<\/w:drawing>/g, '');
  return result;
};

/**
 * Sanitize zip XML before Docxtemplater parses `[...]` tags.
 * @param {object} zip PizZip instance
 * @param {{ templateName?: string }} [options]
 */
const sanitizeTemplateZip = (zip, options = {}) => {
  if (options.templateName) {
    repairGuttedAnnexureDLhZip(zip, options.templateName);
  }

  const xmlFiles = Object.keys(zip.files).filter((f) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(f)
  );

  xmlFiles.forEach((filePath) => {
    const file = zip.files[filePath];
    if (!file) return;
    const content = file.asText();
    const cleaned = sanitizeTemplateXmlArtifacts(content);
    if (cleaned !== content) {
      zip.file(filePath, cleaned);
    }
  });

  return zip;
};

/**
 * After empty joint-name slots are cleared, declaration text can glue as
 * "Kumarhereby" across adjacent w:t runs. Insert a leading space on the verb run.
 */
const fixGluedDeclarationVerbs = (xml) => {
  if (!xml) return xml;
  const verbs = 'hereby|declare|confirm|undertake|have|agree|affirm|state';
  const re = new RegExp(
    `(<w:t([^>]*)>)([^<]*[A-Za-z])(</w:t>)([\\s\\S]{0,4000}?)(<w:t([^>]*)>)((?:${verbs})\\b)`,
    'gi'
  );
  return xml.replace(re, (full, _o1, a1, left, _c1, mid, _o2, a2, verb) => {
    const midPlain = [...mid.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)]
      .map((m) => m[1])
      .join('');
    if (midPlain.replace(/\s+/g, '').length > 0) return full;
    if (/\s$/.test(left) || /^\s/.test(verb)) return full;
    const spaceAttr = /xml:space=/.test(a2 || '') ? '' : ' xml:space="preserve"';
    return `<w:t${a1 || ''}>${left}</w:t>${mid}<w:t${a2 || ''}${spaceAttr}> ${verb}`;
  });
};

/**
 * Post-process document XML after docxtemplater render.
 */
/**
 * Rebuild IEPF multiple-claimant father clauses after list cleanup strips
 * "&" before "son / daughter of", and drop empty C2/C3 slots.
 */
const rebuildIEPFFatherClauseText = (text) => {
  if (!text || !/son\s*\/\s*daughter of/i.test(text)) return text;

  const names = [];
  const clauseRe =
    /son\s*\/\s*daughter of\s*(.*?)(?=\s*(?:&amp;|&)?\s*son\s*\/\s*daughter of|\s*respectively\b|$)/gi;
  let m;
  while ((m = clauseRe.exec(text))) {
    const name = decodeXmlText(m[1] || '')
      .replace(/&amp;/gi, '&')
      .replace(/[&]+/g, ' ')
      .replace(/\s+/g, ' ')
      .replace(/^respectively$/i, '')
      .trim();
    if (name) names.push(name);
  }

  const rebuilt =
    names.length === 0
      ? ''
      : names.map((n) => `son / daughter of ${n}`).join(' & ') +
        (names.length > 1 ? ' respectively' : '');

  return text
    .replace(/son\s*\/\s*daughter of[\s\S]*?(?=do hereby|to indemnify|$)/i, rebuilt ? `${rebuilt} ` : '')
    .replace(/\s+/g, ' ')
    .trim();
};

const rewriteParagraphPlainText = (paraXml, newText) => {
  let used = false;
  const escaped = escapeXmlText(newText);
  return paraXml.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_m, attrs) => {
    if (used) return `<w:t${attrs}></w:t>`;
    used = true;
    const spaceAttr =
      (escaped.startsWith(' ') || escaped.endsWith(' ')) && !/xml:space=/.test(attrs || '')
        ? ' xml:space="preserve"'
        : '';
    return `<w:t${attrs}${spaceAttr}>${escaped}</w:t>`;
  });
};

const uniqueJoinedNames = (chunk, splitter, joiner) => {
  const seen = new Set();
  const unique = [];
  String(chunk || '')
    .split(splitter)
    .map((part) => part.replace(/\s+/g, ' ').trim())
    .forEach((part) => {
      if (!part || /^[&,;]+$/.test(part) || /^or$/i.test(part)) return;
      const key = part.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      unique.push(part);
    });
  return unique.length ? unique.join(joiner) : String(chunk || '').replace(/\s+/g, ' ').trim();
};

const dedupeNameMismatchParagraphText = (text) => {
  let t = String(text || '');
  t = t.replace(
    /(aforesaid documents as\s+)(.+?)(\s+belongs to one and same person)/i,
    (_, lead, names, tail) => `${lead}${uniqueJoinedNames(names, /\s*&\s*/, ' & ')}${tail}`
  );
  t = t.replace(
    /((?:Aadhaar|Aadhar) and PAN as\s+)(.+?)(\s+s\/o\s*\/\s*w\/o)/i,
    (_, lead, names, tail) => `${lead}${uniqueJoinedNames(names, /\s*&\s*/, ' & ')}${tail}`
  );
  t = t.replace(
    /(name appears as\s+)(.+?)(\s*\.)/i,
    (_, lead, names, tail) => `${lead}${uniqueJoinedNames(names, /\s+or\s+/i, ' or ')}${tail}`
  );
  return t.replace(/\s+/g, ' ').trim();
};

/**
 * Name Mismatch SELF affidavits list Aadhaar/PAN/CML/Bank/Passport/Cert in
 * one clause. When several fields hold the same spelling, print that name
 * once; append any different spelling after "&" (point 3 / KYC) or "or"
 * (customary documents).
 */
const dedupeNameMismatchAffidavitNames = (xml) => {
  if (
    !xml ||
    !/belongs to one and same person/i.test(xml) ||
    !/aforesaid documents/i.test(xml)
  ) {
    return xml;
  }

  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const text = visibleWtText(para);
    if (!text) return para;
    if (
      !/aforesaid documents as/i.test(text) &&
      !/(?:Aadhaar|Aadhar) and PAN as/i.test(text) &&
      !/name appears as/i.test(text)
    ) {
      return para;
    }
    const cleaned = dedupeNameMismatchParagraphText(text);
    if (cleaned === text.replace(/\s+/g, ' ').trim()) return para;
    return rewriteParagraphPlainText(para, cleaned);
  });
};

const cleanupIEPFIndemnityPopulatedXml = (xml) => {
  if (!xml || !/Investor Education and Protection Fund Authority/i.test(xml)) return xml;

  return xml.replace(/<w:p\b[^>]*>[\s\S]*?<\/w:p>/g, (para) => {
    const text = iepfParaPlain(para);
    if (!/son\s*\/\s*daughter of/i.test(text)) return para;
    const cleaned = rebuildIEPFFatherClauseText(text);
    if (cleaned === text.replace(/\s+/g, ' ').trim()) return para;
    return rewriteParagraphPlainText(para, cleaned);
  });
};

const postProcessDocumentXml = (xml) => {
  let result = xml;
  result = sanitizeTemplateXmlArtifacts(result);
  result = result.replace(/undefined|null/gi, '');
  result = normalizeOversizedBodyFonts(result);
  result = cleanParagraphsInXml(result); // Re-enabled with segmented logic to preserve formatting
  result = dedupeNameMismatchAffidavitNames(result);
  result = cleanupIEPFIndemnityPopulatedXml(result);
  result = flattenIEPFIndemnityFlow(result);
  result = normalizeIEPFIndemnitySpacing(result);
  result = fixGluedDeclarationVerbs(result);
  result = removeEmptyTableRows(result);
  result = renumberLegalHeirTableRows(result);
  result = removeTrailingEmptyTableColumns(result);
  result = removeEmptyNonClaimantRows(result);
  // Address + signature/office boxes become an inline table after the witness
  // clause. Do not page-break that clause — it stretched the generated file
  // to extra mostly-blank pages.
  result = defloatFormBLayoutAnchors(result);
  result = fixIsr4TranspositionSectionCTable(result);
  return result;
};

/**
 * Apply post-processing to all document XML parts in a PizZip instance.
 */
const postProcessDocxZip = (zip) => {
  const xmlFiles = Object.keys(zip.files).filter((f) =>
    /^word\/(document|header\d*|footer\d*)\.xml$/.test(f)
  );

  xmlFiles.forEach((filePath) => {
    const file = zip.files[filePath];
    if (!file) return;
    const content = file.asText();
    try {
      const cleaned = postProcessDocumentXml(content);
      if (cleaned !== content) {
        zip.file(filePath, cleaned);
      }
    } catch (err) {
      console.warn(`Post-processing skipped for ${filePath}:`, err.message);
    }
  });

  return zip;
};

const isSelectableTemplateFile = (file) => {
  if (!file || String(file).startsWith('~$')) return false;
  if (!/\.docx$/i.test(file)) return false;
  const lower = String(file).toLowerCase();
  if (lower.includes('backup') || lower.includes('_restored')) return false;
  if (String(file).includes('--')) return false;
  return true;
};

const toDisplayTemplateName = (filename) => {
  const raw = String(filename || '');
  const lower = raw.toLowerCase();
  if (lower.includes('form isr-4') && lower.includes('sebi')) {
    return 'Form ISR-4 - SEBI Format';
  }
  if (lower.includes('form isr-4') && lower.includes('transposition')) {
    return 'Form ISR-4 Transposition';
  }
  if (lower.includes('iepf') && lower.includes('indemnity')) {
    if (lower.includes('multiple')) return 'Indemnity Bond IEPF - Multiple Claimant';
    if (lower.includes('single')) return 'Indemnity Bond IEPF - Single Claimant';
    return 'Indemnity Bond IEPF';
  }
  return raw
    .replace(/_Template\.docx$/i, '')
    .replace(/\.docx$/i, '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
};

const toPopulatedDownloadName = (filename) => {
  const base = String(filename || '').split(/[/\\]/).pop() || 'Template.docx';
  if (/_Template\.docx$/i.test(base)) {
    return base.replace(/_Template\.docx$/i, '_Populated.docx');
  }
  return base.replace(/\.docx$/i, '_Populated.docx');
};

module.exports = {
  cleanFormattedListText,
  decodeXmlText,
  escapeXmlText,
  isEmptyOrSeparatorOnly,
  isEmptyAccountHolderPanNameRow,
  isEmptyClaimantDetailsRow,
  removeEmptyTableRows,
  removeTrailingEmptyTableColumns,
  sanitizeTemplateXmlArtifacts,
  sanitizeTemplateZip,
  ensureFormBRtaNamePlaceholder,
  fixAffidavitCumIndemnityPlaceholders,
  replaceAnnexureDDeponentLh,
  repairGuttedAnnexureDLhZip,
  fixAnnexureDDeponentAlignment,
  ensureFormBWitnessPageBreak,
  defloatFormBLayoutAnchors,
  removeEmptyLayoutDrawings,
  postProcessDocumentXml,
  postProcessDocxZip,
  isSelectableTemplateFile,
  toDisplayTemplateName,
  toPopulatedDownloadName,
  fixIsr4TranspositionSectionCTable,
};
