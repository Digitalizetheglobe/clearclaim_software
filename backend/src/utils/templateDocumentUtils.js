/**
 * Utilities for cleaning populated Word document XML and formatted list text.
 * Addresses: redundant &&, trailing commas/&, empty "or or" patterns, blank table rows.
 */

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

  // Remove repeated "or" with nothing between: "or or or", "or or ."
  cleaned = cleaned.replace(/(?:^|\s)(?:or\s*){2,}/gi, ' ');
  cleaned = cleaned.replace(/\s+or\s*\./gi, '.');
  cleaned = cleaned.replace(/\bor\s+or\b/gi, 'or');

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

const isBlankHeirCell = (text) =>
  isEmptyOrSeparatorOnly(text) || isSignaturePlaceholderOnly(text);

/** Cells that shouldn't keep an otherwise-empty claimant/heir row visible */
const isInsignificantHeirDetailCell = (text) => {
  if (isBlankHeirCell(text)) return true;
  const t = String(text || '').trim();
  // Lone Indian PIN / mobile leftovers after empty name
  if (/^\d{6}$/.test(t)) return true;
  if (/^\d{10}$/.test(t)) return true;
  if (/^(\d{6}|\d{10})(\s*,\s*(\d{6}|\d{10}))*$/.test(t)) return true;
  return false;
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
  return xml.replace(/<w:tr(?:\s[^>]*)?>([\s\S]*?)<\/w:tr>/g, (fullMatch, rowContent) => {
    // Preserve rows containing images, drawings, shapes, or textboxes
    if (/<w:(?:drawing|pict|object|txbxContent)/i.test(rowContent) || /<v:(?:shape|rect|textbox|group|line)/i.test(rowContent) || /<mc:AlternateContent/i.test(rowContent)) {
      return fullMatch;
    }

    const rowText = getRowText(rowContent);
    if (
      isEmptyOrSeparatorOnly(rowText) ||
      isNumberedEmptyHeirRow(rowContent) ||
      isEmptyAccountHolderPanNameRow(rowContent) ||
      isEmptySecuritiesDataRow(rowContent)
    ) {
      return '';
    }
    return fullMatch;
  });
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
      /\b(day\s+of|deponent|solemnly\s+affirm|on\s+this)\b/i.test(paraFullText);
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
 */
const removeTrailingEmptyTableColumns = (xml) => {
  return xml.replace(/<w:tbl>([\s\S]*?)<\/w:tbl>/g, (tableMatch, tableContent) => {
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
        if (isEmptyOrSeparatorOnly(t)) return true;
        // ISR-1 signature table: "Holder 2" / "Holder 3" headers count as empty
        // when that holder has no name/address/PIN data in the column.
        if (/^holder\s*\d+$/i.test(t)) return true;
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

/**
 * True for Form-B indemnity docs that use page-relative floating signature/address boxes.
 */
const isFormBIndemnityXml = (xml) =>
  /INDEMNITY/i.test(xml || '') &&
  (/Form\s*-?\s*B/i.test(xml || '') || /Signature of All holder/i.test(xml || ''));

/**
 * Form-B templates accidentally contain `strokecolor="black [3040]"` inside VML.
 * With `[`/`]` delimiters, docxtemplater treats `[3040]` as a tag and corrupts drawings
 * (Word "unreadable content" / floating boxes jumping onto body text).
 */
const sanitizeTemplateXmlArtifacts = (xml) => {
  if (!xml) return xml;
  let result = xml
    .replace(/strokecolor="black\s*\[3040\]"/gi, 'strokecolor="black"')
    .replace(/strokecolor="([^"]*?)\s*\[3040\]"/gi, 'strokecolor="$1"');
  result = fixIEPFIndemnityBondLayout(result);
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

  // Base IEPF template has neither year nor company in body (only in floats)
  if (!/\[Financial Dividend Year\]/i.test(plain)) {
    const next = result.replace(
      /(Financial Year <\/w:t>)(<\/w:r>)/i,
      '$1$2<w:r><w:t>[Financial Dividend Year]</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Company Name]</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>'
    );
    if (next !== result) {
      result = next;
      plain = bodyPlain(result);
    }
  }

  // After Financial Dividend Year → Company Name
  if (!/\[Company Name\]/i.test(plain)) {
    const next = result.replace(
      /(Financial Dividend Year\]<\/w:t>)(<\/w:r>)/i,
      '$1$2<w:r><w:t xml:space="preserve"> </w:t></w:r><w:r><w:t>[Company Name]</w:t></w:r><w:r><w:t xml:space="preserve"> </w:t></w:r>'
    );
    if (next !== result) {
      result = next;
      plain = bodyPlain(result);
    }
  }

  // Before "out of the Investor" → claimant PAN name(s)
  if (!/\[Name as per PAN C1\]/i.test(plain)) {
    const nameInsert = isMultiple
      ? '[Name as per PAN C1] &amp; [Name as per PAN C2] &amp; [Name as per PAN C3] '
      : '[Name as per PAN C1] ';
    const next = result.replace(/(<w:t[^>]*>)out(<\/w:t>)/i, `$1${nameInsert}out$2`);
    if (next !== result) {
      const probe = bodyPlain(next);
      if (/\[Name as per PAN C1\][\s\S]{0,80}?out\s*of/i.test(probe)) {
        result = next;
        plain = probe;
      }
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

  // Ensure spaces around key placeholders before surrounding words
  result = result.replace(/\[Company Name\]\s*from/gi, '[Company Name] from');
  result = result.replace(/\[Financial Dividend Year\](?=\[)/gi, '[Financial Dividend Year] ');
  result = result.replace(/\[Name as per PAN C1\]\s*out/gi, '[Name as per PAN C1] out');
  result = result.replace(/\[Total Shares\]\s*being/gi, '[Total Shares] being');
  result = result.replace(/\[Total Dividend Amount\]\s*and/gi, '[Total Dividend Amount] and');

  // Extreme negative character spacing collapses body text in browser preview
  result = result.replace(/<w:spacing\s+w:val="-\d+"\s*\/>/g, '');

  result = result.replace(/<w:drawing>\s*<\/w:drawing>/g, '');
  result = result.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');

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
 * After empty securities rows are removed, Form-B page-1 shortens and absolute
 * signature/address anchors land on page 1 over the intro paragraph.
 * Force the witness / signature block onto a fresh page.
 */
const ensureFormBWitnessPageBreak = (xml) => {
  if (!isFormBIndemnityXml(xml) || !/IN WITNESS WHEREOF/i.test(xml)) {
    return xml;
  }

  return xml.replace(
    /(<w:p\b[^>]*>)((?:<w:pPr\b[^>]*>[\s\S]*?<\/w:pPr>)?)([\s\S]*?)(<w:t\b[^>]*>)(IN WITNESS WHEREOF)/i,
    (full, open, pPr, mid, tOpen, witness) => {
      if (/<w:br\b[^>]*w:type="page"/i.test(full)) {
        return full;
      }
      return `${open}${pPr || ''}<w:r><w:br w:type="page"/></w:r>${mid}${tOpen}${witness}`;
    }
  );
};

/**
 * Form-B signature/address/office boxes are wp:anchor floats with relativeFrom=page.
 * Even after a page break, Word still paints them over the intro paragraph when the
 * body is short. Convert those layout boxes to inline so they flow with the witness
 * section, and drop zero-size decorative absolute lines.
 *
 * Important: never leave empty <w:drawing></w:drawing> (Word "unreadable content").
 */
const defloatFormBLayoutAnchors = (xml) => {
  if (!isFormBIndemnityXml(xml)) return xml;

  const anchorText = (inner) =>
    [...inner.matchAll(/<w:t[^>]*>([^<]*)<\/w:t>/g)].map((m) => m[1]).join('');

  const isLayoutBoxText = (text) =>
    /Signature of All holder|Address of First Holder|FOR OFFICE/i.test(text || '');

  const isDecorativeAnchorInner = (inner) => {
    const text = anchorText(inner);
    return !text.trim() && /<wp:extent\b[^>]*(?:cx="0"|cy="0")/i.test(inner);
  };

  const anchorToInline = (inner) => {
    const extent =
      (inner.match(/<wp:extent\b[^>]*\/>/) || ['<wp:extent cx="3127375" cy="1066800"/>'])[0];
    const docPr =
      (inner.match(/<wp:docPr\b[^>]*\/>/) || ['<wp:docPr id="1" name="TextBox"/>'])[0];
    const cNv =
      (inner.match(/<wp:cNvGraphicFramePr>[\s\S]*?<\/wp:cNvGraphicFramePr>/) || [''])[0];
    const graphic = (inner.match(/<a:graphic\b[\s\S]*?<\/a:graphic>/) || [''])[0];
    if (!graphic) return null;
    return `<wp:inline distT="0" distB="0" distL="114300" distR="114300">${extent}${docPr}${cNv}${graphic}</wp:inline>`;
  };

  // Prefer operating on AlternateContent so Choice+Fallback stay consistent
  let result = xml.replace(/<mc:AlternateContent>([\s\S]*?)<\/mc:AlternateContent>/g, (block) => {
    const anchorMatch = block.match(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/);
    if (!anchorMatch) return block;

    const inner = anchorMatch[1];
    if (isDecorativeAnchorInner(inner)) {
      return '';
    }

    const text = anchorText(inner);
    if (!isLayoutBoxText(text)) return block;

    const inline = anchorToInline(inner);
    if (!inline) return block;

    // Plain drawing — avoid Choice-without-Fallback (Word may flag unreadable content)
    return `<w:drawing>${inline}</w:drawing>`;
  });

  // Any remaining bare anchors (not wrapped in AlternateContent)
  result = result.replace(/<wp:anchor\b[^>]*>([\s\S]*?)<\/wp:anchor>/g, (full, inner) => {
    if (isDecorativeAnchorInner(inner)) return '';
    if (!isLayoutBoxText(anchorText(inner))) return full;
    return anchorToInline(inner) || full;
  });

  // Remove empty drawings / empty AlternateContent left after decorative deletion
  result = result.replace(/<w:drawing>\s*<\/w:drawing>/g, '');
  result = result.replace(
    /<mc:AlternateContent>\s*<mc:Choice\b[^>]*>\s*<\/mc:Choice>\s*(?:<mc:Fallback\b[^>]*>[\s\S]*?<\/mc:Fallback>)?\s*<\/mc:AlternateContent>/g,
    ''
  );
  result = result.replace(
    /<mc:AlternateContent>\s*<mc:Choice\b[^>]*>\s*<w:drawing>\s*<\/w:drawing>\s*<\/mc:Choice>[\s\S]*?<\/mc:AlternateContent>/g,
    ''
  );
  // Empty runs that only held a removed drawing
  result = result.replace(/<w:r\b[^>]*>\s*<\/w:r>/g, '');

  return result;
};

/**
 * Sanitize zip XML before Docxtemplater parses `[...]` tags.
 */
const sanitizeTemplateZip = (zip) => {
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
const postProcessDocumentXml = (xml) => {
  let result = xml;
  result = sanitizeTemplateXmlArtifacts(result);
  result = result.replace(/undefined|null/gi, '');
  result = normalizeOversizedBodyFonts(result);
  result = cleanParagraphsInXml(result); // Re-enabled with segmented logic to preserve formatting
  result = normalizeIEPFIndemnitySpacing(result);
  result = fixGluedDeclarationVerbs(result);
  result = removeEmptyTableRows(result);
  result = renumberLegalHeirTableRows(result);
  result = removeTrailingEmptyTableColumns(result);
  result = removeEmptyNonClaimantRows(result);
  // Form-B: remove empty securities rows, then keep signature/address boxes from
  // overlaying page-1 body text (page break + convert floats to inline).
  result = ensureFormBWitnessPageBreak(result);
  result = defloatFormBLayoutAnchors(result);
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

module.exports = {
  cleanFormattedListText,
  decodeXmlText,
  escapeXmlText,
  isEmptyOrSeparatorOnly,
  isEmptyAccountHolderPanNameRow,
  removeEmptyTableRows,
  removeTrailingEmptyTableColumns,
  sanitizeTemplateXmlArtifacts,
  sanitizeTemplateZip,
  ensureFormBWitnessPageBreak,
  defloatFormBLayoutAnchors,
  postProcessDocumentXml,
  postProcessDocxZip,
};
