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

const resolveRtaAddress = (valueMap = {}) =>
  firstNonEmpty(
    valueMap['RTA Address'],
    valueMap['rta_address'],
    valueMap['RTA address'],
    valueMap['rtaAddress'],
    valueMap['Registrar Address'],
    valueMap['registrar_address'],
    valueMap['RTA Address C1'],
    valueMap['rta_address_c1']
  );

const resolveRtaCity = (valueMap = {}) => {
  const explicit = firstNonEmpty(
    valueMap['RTA City'],
    valueMap['rta_city'],
    valueMap['rtaCity'],
    valueMap['Registrar City'],
    valueMap['registrar_city'],
    valueMap['RTA City C1'],
    valueMap['rta_city_c1']
  );
  if (explicit) return explicit;
  return '';
};

const resolveRtaPin = (valueMap = {}) => {
  const explicit = firstNonEmpty(
    valueMap['RTA PIN'],
    valueMap['rta_pin'],
    valueMap['RTA Pin'],
    valueMap['RTA Pincode'],
    valueMap['rtaPin'],
    valueMap['Registrar PIN'],
    valueMap['registrar_pin'],
    valueMap['RTA PIN C1'],
    valueMap['rta_pin_c1']
  );
  if (explicit) return explicit;
  const address = resolveRtaAddress(valueMap);
  if (address) {
    const pinMatch = String(address).match(/\b(\d{6})\b/);
    if (pinMatch) return pinMatch[1];
  }
  return '';
};

const applyCanonicalRtaName = (valueMap) => {
  if (!valueMap) return valueMap;
  const name = resolveRtaName(valueMap);
  if (name) {
    valueMap['RTA Name'] = name;
    valueMap['rta_name'] = name;
  }
  const address = resolveRtaAddress(valueMap);
  if (address) {
    valueMap['RTA Address'] = address;
    valueMap['rta_address'] = address;
  }
  const city = resolveRtaCity(valueMap);
  if (city) {
    valueMap['RTA City'] = city;
    valueMap['rta_city'] = city;
  }
  const pin = resolveRtaPin(valueMap);
  if (pin) {
    valueMap['RTA PIN'] = pin;
    valueMap['rta_pin'] = pin;
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
  resolveRtaAddress,
  resolveRtaCity,
  resolveRtaPin,
  applyCanonicalRtaName,
  isRtaNameFieldKey,
};
