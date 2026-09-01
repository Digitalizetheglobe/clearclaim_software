/**
 * Map share-certificate / distinctive-number rows and certificate holder names
 * for ISR-4 (including SEBI Format SC11–SC13 and Transposition Cert C1–C3).
 */

const MAX_SHARE_CERTIFICATES = 19;

const isBlank = (value) => {
  if (value === undefined || value === null) return true;
  const text = String(value).trim();
  return (
    !text ||
    /^undefined$/i.test(text) ||
    /^null$/i.test(text) ||
    text === '_________________'
  );
};

const firstNonEmpty = (...values) => {
  for (const value of values) {
    if (!isBlank(value)) return String(value).trim();
  }
  return '';
};

const cleanCertificateToken = (value) => {
  if (isBlank(value)) return '';
  let cleaned = String(value).replace(/undefined|null/gi, '').trim();
  cleaned = cleaned.replace(/[,.\s]*&[\s,]*$/g, '').replace(/[,.\s]+$/g, '').trim();
  if (!cleaned || cleaned === '&' || /^[,.\s&]+$/.test(cleaned)) return '';
  return cleaned;
};

const applyShareCertificateMappings = (valueMap, target = valueMap) => {
  if (!valueMap || !target) return target;
  const certificateNumbers = [];
  const distinctiveNumbers = [];

  for (let i = 1; i <= MAX_SHARE_CERTIFICATES; i++) {
    const sc = cleanCertificateToken(valueMap[`SC${i}`] || valueMap[`sc${i}`]);
    const dn = cleanCertificateToken(valueMap[`DN${i}`] || valueMap[`dn${i}`]);
    const nos = cleanCertificateToken(valueMap[`NOS${i}`] || valueMap[`nos${i}`]);
    const status = cleanCertificateToken(
      valueMap[`SC Status${i}`] ||
      valueMap[`SC Status ${i}`] ||
      valueMap[`sc_status${i}`]
    );

    target[`SC${i}`] = sc;
    target[`DN${i}`] = dn;
    target[`NOS${i}`] = nos;
    target[`SC Status${i}`] = status;

    if (i === 1) {
      const yop = cleanCertificateToken(
        valueMap[`Year of Purchase${i}`] ||
        valueMap[`Year of Purchase ${i}`] ||
        valueMap[`year_of_purchase${i}`] ||
        valueMap[`year_of_purchase_${i}`]
      );
      target[`Year of Purchase${i}`] = yop;
      target[`Year of Purchase ${i}`] = yop;
    }

    if (sc) certificateNumbers.push(sc);
    if (dn) distinctiveNumbers.push(dn);
  }

  const certificateNumbersStr = certificateNumbers.join(', ');
  const distinctiveNumbersStr = distinctiveNumbers.join(', ');
  target['Certificate numbers'] = certificateNumbersStr;
  target['certificate numbers'] = certificateNumbersStr;
  target['Certificate Numbers'] = certificateNumbersStr;
  target['Distinctive numbers'] = distinctiveNumbersStr;
  target['distinctive numbers'] = distinctiveNumbersStr;
  target['Distinctive Numbers'] = distinctiveNumbersStr;
  return target;
};

const resolveNameAsPerCert = (valueMap, num) => {
  const suffix = `C${num}`;
  return firstNonEmpty(
    valueMap[`Name as per Cert ${suffix}`],
    valueMap[`Name as per Certificate ${suffix}`],
    valueMap[`name_cert_c${num}`],
    valueMap[`Name as per Aadhar ${suffix}`],
    valueMap[`name_aadhar_c${num}`],
    valueMap[`Name as per PAN ${suffix}`],
    valueMap[`name_pan_c${num}`]
  );
};

const applyNameAsPerCertFallbacks = (valueMap, target = valueMap) => {
  if (!valueMap || !target) return target;
  for (let n = 1; n <= 3; n++) {
    const resolved = resolveNameAsPerCert(valueMap, n);
    if (!resolved) continue;
    if (isBlank(target[`Name as per Cert C${n}`])) {
      target[`Name as per Cert C${n}`] = resolved;
    }
    if (isBlank(target[`Name as per Certificate C${n}`])) {
      target[`Name as per Certificate C${n}`] = resolved;
    }
  }
  return target;
};

module.exports = {
  MAX_SHARE_CERTIFICATES,
  cleanCertificateToken,
  applyShareCertificateMappings,
  resolveNameAsPerCert,
  applyNameAsPerCertFallbacks,
};
