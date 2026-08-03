const { postProcessDocumentXml, cleanFormattedListText } = require('../src/utils/templateDocumentUtils');

const fakeRow = (vals) =>
  '<w:tr>' + vals.map((t) => `<w:tc><w:p><w:r><w:t>${t}</w:t></w:r></w:p></w:tc>`).join('') + '</w:tr>';

const xml =
  '<w:tbl>' +
  fakeRow([
    'S.No.',
    'Name of the Issuer Company',
    'Folio No.',
    'Quantity of securities',
    'Face value of securities',
    'Distinctive number',
  ]) +
  fakeRow(['1', 'CEAT LIMITED', 'ZVR0003214', '37', '10', '3904735-3904771']) +
  fakeRow(['2', 'CEAT LIMITED', 'ZVR0003214', '', '10', '']) +
  fakeRow(['3', 'CEAT LIMITED', 'ZVR0003214', '', '10', '']) +
  '</w:tbl>';

console.log('auth rows after', (postProcessDocumentXml(xml).match(/<w:tr/g) || []).length);

const wingPara =
  '<w:p>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Wingdings" w:hAnsi="Wingdings"/></w:rPr><w:t>&#xF0FC;</w:t></w:r>' +
  '<w:r><w:rPr><w:rFonts w:ascii="Calibri"/></w:rPr><w:t>Original cancelled cheque; ; OR</w:t></w:r>' +
  '</w:p>';

const out = postProcessDocumentXml(wingPara);
console.log('still has Wingdings', out.includes('Wingdings'));
console.log('checkmark kept', /Wingdings[\s\S]*?<w:t[^>]*>[^<]+<\/w:t>/.test(out));
console.log('body has cleaned text', out.includes('Original cancelled cheque'));
console.log('no double semicolon', !out.includes('; ;'));
console.log('account # cleanup:', cleanFormattedListText('Account Number: 10378921868 #'));
