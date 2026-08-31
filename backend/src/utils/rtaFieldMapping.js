const { firstNonEmpty } = require('./bankFieldMapping');

const resolveRtaName = (valueMap = {}) =>
  firstNonEmpty(
    valueMap['RTA Name'],
    valueMap['rta_name'],
    valueMap['RTA NAME'],
    valueMap['RTA'],
    valueMap['rta'],
    valueMap['RTA Name C1'],
    valueMap['rta_name_c1'],
    valueMap['Registrar Name'],
    valueMap['Registrar'],
    valueMap['Registrar and Transfer Agent'],
    valueMap['Registrar & Transfer Agent'],
    valueMap['R&T Agent'],
    valueMap['RT Agent'],
    valueMap['RTA Agent']
  );

const applyCanonicalRtaName = (valueMap) => {
  if (!valueMap) return valueMap;
  const name = resolveRtaName(valueMap);
  if (name) {
    valueMap['RTA Name'] = name;
    valueMap['rta_name'] = name;
  }
  const company = firstNonEmpty(
    valueMap['Company Name'],
    valueMap['company_name']
  );
  const composed = [name, company].filter(Boolean).join(' / ');
  if (composed) {
    valueMap['Name of the Company/RTA'] = composed;
    valueMap['Name of the Company / RTA'] = composed;
  }
  return valueMap;
};

const isRtaNameFieldKey = (key) => {
  const normalized = String(key || '')
    .trim()
    .toLowerCase()
    .replace(/_/g, ' ');
  if (!normalized || normalized.includes('address')) return false;
  return (
    normalized === 'rta' ||
    normalized === 'rta name' ||
    /^rta name c\d+$/.test(normalized) ||
    normalized === 'registrar' ||
    normalized === 'registrar name' ||
    normalized === 'registrar and transfer agent' ||
    normalized === 'registrar & transfer agent' ||
    (normalized.includes('rta') && normalized.includes('name'))
  );
};

module.exports = {
  resolveRtaName,
  applyCanonicalRtaName,
  isRtaNameFieldKey,
};
