/**
 * Resolve ISR-2 bank account number / bank postal address from Excel keys,
 * Claimant rows, and related bank fields (name, branch, city, PIN).
 */

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

const setIfEmpty = (valueMap, key, value) => {
  if (!valueMap || !key || isBlank(value)) return;
  if (isBlank(valueMap[key])) {
    valueMap[key] = String(value).trim();
  }
};

const collectHolderNumbers = (valueMap) => {
  const nums = new Set(['1', '2', '3']);
  Object.keys(valueMap || {}).forEach((key) => {
    const match = String(key).match(/[cC](\d+)$/);
    if (match) nums.add(match[1]);
  });
  return [...nums].sort((a, b) => Number(a) - Number(b));
};

const normalizeBankAccountNumber = (value) => {
  if (isBlank(value)) return '';
  let text = String(value).trim();
  if (/^-?\d+(?:\.\d+)?e[+-]?\d+$/i.test(text)) {
    const numeric = Number(text);
    if (Number.isFinite(numeric) && Math.abs(numeric) <= 1e15) {
      text = String(Math.round(numeric));
    }
  }
  if (/^\d+\.0+$/.test(text)) {
    text = text.replace(/\.0+$/, '');
  }
  return text.replace(/\s+/g, '');
};

const resolveBankAccountNumber = (valueMap, num) => {
  const suffix = `C${num}`;
  const raw = firstNonEmpty(
    valueMap[`Bank AC ${suffix}`],
    valueMap[`bank_ac_c${num}`],
    valueMap[`bank_account_c${num}`],
    valueMap[`bank_account_number_c${num}`],
    valueMap[`Bank Account ${suffix}`],
    valueMap[`Bank Account Number ${suffix}`],
    valueMap[`Bank Account No ${suffix}`],
    valueMap[`Bank A/C ${suffix}`],
    valueMap[`Account Number ${suffix}`],
    valueMap[`Account No ${suffix}`],
    valueMap[`A/C Number ${suffix}`],
    valueMap[`A/C No ${suffix}`],
    String(num) === '1' ? valueMap['Bank AC'] : '',
    String(num) === '1' ? valueMap['Bank Account Number'] : '',
    String(num) === '1' ? valueMap['Bank Account No'] : '',
    String(num) === '1' ? valueMap['Account Number'] : '',
    String(num) === '1' ? valueMap['Account No'] : ''
  );
  return normalizeBankAccountNumber(raw);
};

const composeBankPostalAddress = (valueMap, num) => {
  const suffix = `C${num}`;
  const explicit = firstNonEmpty(
    valueMap[`Bank Address ${suffix}`],
    valueMap[`bank_address_c${num}`],
    valueMap[`Postal Address ${suffix}`],
    valueMap[`postal_address_c${num}`],
    valueMap[`Bank Postal Address ${suffix}`],
    String(num) === '1' ? valueMap['Bank Address'] : '',
    String(num) === '1' ? valueMap['Postal Address'] : ''
  );
  if (explicit) return explicit;

  const parts = [
    firstNonEmpty(valueMap[`Bank Name ${suffix}`], valueMap[`bank_name_c${num}`]),
    firstNonEmpty(valueMap[`Bank Branch ${suffix}`], valueMap[`bank_branch_c${num}`]),
    firstNonEmpty(valueMap[`Bank City ${suffix}`], valueMap[`bank_city_c${num}`], valueMap[`Bank City`]),
    firstNonEmpty(
      valueMap[`Bank PIN ${suffix}`],
      valueMap[`bank_pin_c${num}`],
      valueMap[`Bank PIN Code ${suffix}`],
      valueMap[`bank_pin_code_c${num}`]
    ),
  ].filter(Boolean);

  return parts.join(', ');
};

const mergeClaimantBankFields = (valueMap, claimants = []) => {
  if (!valueMap || !Array.isArray(claimants)) return valueMap;

  claimants.forEach((claimant) => {
    const num = claimant && claimant.claimant_number;
    if (!num) return;
    const suffix = `C${num}`;

    setIfEmpty(valueMap, `Bank AC ${suffix}`, claimant.bank_account_number);
    setIfEmpty(valueMap, `bank_ac_c${num}`, claimant.bank_account_number);
    setIfEmpty(valueMap, `bank_account_number_c${num}`, claimant.bank_account_number);
    setIfEmpty(valueMap, `Bank Address ${suffix}`, claimant.bank_address);
    setIfEmpty(valueMap, `bank_address_c${num}`, claimant.bank_address);
    setIfEmpty(valueMap, `Bank Name ${suffix}`, claimant.bank_name);
    setIfEmpty(valueMap, `bank_name_c${num}`, claimant.bank_name);
    setIfEmpty(valueMap, `Bank Branch ${suffix}`, claimant.bank_branch);
    setIfEmpty(valueMap, `bank_branch_c${num}`, claimant.bank_branch);
    setIfEmpty(valueMap, `Bank AC Type ${suffix}`, claimant.bank_account_type);
    setIfEmpty(valueMap, `IFSC ${suffix}`, claimant.ifsc_code);
    setIfEmpty(valueMap, `MICR ${suffix}`, claimant.micr_code);
    setIfEmpty(valueMap, `A/C Open Date ${suffix}`, claimant.account_open_date);
    setIfEmpty(valueMap, `Bank City ${suffix}`, claimant.bank_city);
    setIfEmpty(valueMap, `bank_city_c${num}`, claimant.bank_city);
    setIfEmpty(valueMap, `Bank PIN ${suffix}`, claimant.bank_pin_code);
    setIfEmpty(valueMap, `bank_pin_c${num}`, claimant.bank_pin_code);
  });

  return valueMap;
};

const applyCanonicalBankFields = (valueMap) => {
  if (!valueMap) return valueMap;

  collectHolderNumbers(valueMap).forEach((num) => {
    const suffix = `C${num}`;
    const account = resolveBankAccountNumber(valueMap, num);
    if (account) {
      valueMap[`Bank AC ${suffix}`] = account;
      valueMap[`bank_ac_c${num}`] = account;
      valueMap[`Bank Account ${suffix}`] = account;
      valueMap[`Bank Account Number ${suffix}`] = account;
      valueMap[`Bank Account No ${suffix}`] = account;
    }

    const address = composeBankPostalAddress(valueMap, num);
    if (address) {
      valueMap[`Bank Address ${suffix}`] = address;
      valueMap[`bank_address_c${num}`] = address;
      valueMap[`Postal Address ${suffix}`] = address;
    }
  });

  return valueMap;
};

module.exports = {
  isBlank,
  firstNonEmpty,
  normalizeBankAccountNumber,
  resolveBankAccountNumber,
  composeBankPostalAddress,
  mergeClaimantBankFields,
  applyCanonicalBankFields,
  collectHolderNumbers,
};
