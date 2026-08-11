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

  let cleaned = text;

  // Remove undefined/null remnants
  cleaned = cleaned.replace(/undefined|null/gi, '');

  // Collapse repeated ampersands: "& &", "&&", "&  &"
  cleaned = cleaned.replace(/\s*&\s*&\s*/g, ' ');
  cleaned = cleaned.replace(/&{2,}/g, '');

  // Remove "Late ;", "Late ,", trailing "Late", orphaned "Late &"
  cleaned = cleaned.replace(/\bLate\s*[,;]\s*/gi, '');
  cleaned = cleaned.replace(/[,;]\s*\bLate\b/gi, '');
  cleaned = cleaned.replace(/\bLate\s*&\s*/gi, '');
  cleaned = cleaned.replace(/\s*&\s*\bLate\b/gi, '');
  cleaned = cleaned.replace(/\bLate\s*$/gi, '');
  cleaned = cleaned.replace(/^\s*\bLate\b\s*[,;&]?\s*/gi, '');

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

  // Collapse / strip leftover semicolons from empty name slots: "; ;", ";;", "; are"
  let prev;
  do {
    prev = cleaned;
    cleaned = cleaned.replace(/;\s*;/g, ';');
  } while (cleaned !== prev);
  cleaned = cleaned.replace(/\s*;\s*(?=are\b)/gi, ' ');
  cleaned = cleaned.replace(/\s*&\s*(?=are\b)/gi, ' ');
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

  // Remove orphaned @ symbols
  cleaned = cleaned.replace(/\s*@\s*/g, ' ');

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

  // Collapse whitespace
  cleaned = cleaned.replace(/\s{2,}/g, ' ').trim();

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
 * True when a table row only has list numbering (e.g. "4)") with no heir data.
 */
const isNumberedEmptyHeirRow = (rowContent) => {
  const cells = [...rowContent.matchAll(/(<w:tc(?:\s[^>]*)?>)([\s\S]*?)(<\/w:tc>)/g)];
  if (cells.length === 0) return false;

  const cellTexts = cells.map((c) => getRowText(c[2]).trim());
  const firstWithoutNum = cellTexts[0].replace(/^\d+\)\s*/, '').trim();

  const otherCellsEmpty = cellTexts.slice(1).every((t) => isEmptyOrSeparatorOnly(t));
  const firstEmpty =
    isEmptyOrSeparatorOnly(firstWithoutNum) ||
    /^\d+\)?\s*$/.test(cellTexts[0]);

  return firstEmpty && otherCellsEmpty;
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
    const rowText = getRowText(rowContent);
    if (
      isEmptyOrSeparatorOnly(rowText) ||
      isNumberedEmptyHeirRow(rowContent) ||
      isEmptySecuritiesDataRow(rowContent)
    ) {
      return '';
    }
    return fullMatch;
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
      
      // Normal segment - extract all text, clean it, and place it in the first run containing text
      let textParts = [];
      let targetRunIdx = -1;
      
      for (let i = 0; i < segment.length; i++) {
        const runInner = segment[i][2];
        const tRegex = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let match;
        let hasText = false;
        while ((match = tRegex.exec(runInner)) !== null) {
          textParts.push(decodeXmlText(match[1]));
          hasText = true;
        }
        if (hasText && targetRunIdx === -1) {
          targetRunIdx = i; // First run with text
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
          const updatedInner = runInner.replace(/<w:t([^>]*)>([^<]*)<\/w:t>/g, (_tm, attrs) => {
            if (replaced) return `<w:t${attrs}></w:t>`;
            replaced = true;
            const spaceAttr = escaped.startsWith(' ') || escaped.endsWith(' ') ? ' xml:space="preserve"' : '';
            let newAttrs = attrs || '';
            if (spaceAttr && !/xml:space=/.test(newAttrs)) newAttrs += spaceAttr;
            return `<w:t${newAttrs}>${escaped}</w:t>`;
          });
          newPContent = newPContent.replace(runFull, runOpen + updatedInner + runClose);
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
    for (let colIdx = maxCols - 1; colIdx >= 0; colIdx--) {
      const allEmptyInCol = cellMatrix.every((row) => {
        if (colIdx >= row.length) return true;
        return isEmptyOrSeparatorOnly(row[colIdx].text);
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
 * Post-process document XML after docxtemplater render.
 */
const postProcessDocumentXml = (xml) => {
  let result = xml;
  result = result.replace(/undefined|null/gi, '');
  result = cleanParagraphsInXml(result); // Re-enabled with segmented logic to preserve formatting
  result = removeEmptyTableRows(result);
  result = removeTrailingEmptyTableColumns(result);
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
  removeEmptyTableRows,
  removeTrailingEmptyTableColumns,
  postProcessDocumentXml,
  postProcessDocxZip,
};
