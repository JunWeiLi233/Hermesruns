import { getBackendBaseUrl } from '../api.js';

const DEFAULT_MIN_LENGTH = 10;
const DEFAULT_SPECIAL_CHARS = "!@#$%^&*()_+-=[]{}|;:,.<>?/~`\"'\\";
const DEFAULT_RULE_ORDER = ['MIN_LENGTH', 'UPPERCASE', 'LOWERCASE', 'DIGIT', 'SPECIAL', 'NOT_COMMON'];
const KNOWN_RULE_IDS = new Set(DEFAULT_RULE_ORDER);

// ---------- runtime fetch with static fallback ----------

let cachedServerRules = null;
let fetchPromise = null;

function getStaticDefaults() {
  return {
    minLength: DEFAULT_MIN_LENGTH,
    specialCharsHint: DEFAULT_SPECIAL_CHARS,
    requireUppercase: true,
    requireLowercase: true,
    requireDigit: true,
    requireSpecial: true,
    commonPasswords: [],
    ruleIds: [...DEFAULT_RULE_ORDER],
  };
}

/**
 * Fetch password rules from the backend.
 * Caches the result so every call after the first returns instantly.
 * Falls back to static defaults if the API is unreachable.
 */
export async function fetchPasswordRules() {
  if (cachedServerRules) return cachedServerRules;
  if (fetchPromise) return fetchPromise;

  fetchPromise = (async () => {
    try {
      const baseUrl = getBackendBaseUrl();
      const res = await fetch(`${baseUrl}/api/auth/password-rules`);
      if (res.ok) {
        const data = await res.json();
        if (typeof data?.minLength === 'number') {
          cachedServerRules = data;
          return cachedServerRules;
        }
      }
    } catch {
      // API unavailable — fall through to static defaults
    }
    cachedServerRules = getStaticDefaults();
    return cachedServerRules;
  })();

  return fetchPromise;
}

const UPPERCASE_RE = /\p{Lu}/u;
const LOWERCASE_RE = /\p{Ll}/u;
const DIGIT_RE = /\d/u;

function isPositiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function uniqueKnownRuleIds(ruleIds) {
  const seen = new Set();
  return ruleIds.filter((ruleId) => {
    if (!KNOWN_RULE_IDS.has(ruleId) || seen.has(ruleId)) {
      return false;
    }
    seen.add(ruleId);
    return true;
  });
}

function extractCommonPasswords(rawRules) {
  const rawList = rawRules?.commonPasswords
    ?? rawRules?.blockedPasswords
    ?? rawRules?.disallowedPasswords
    ?? rawRules?.commonPasswordBlocklist
    ?? [];

  if (!Array.isArray(rawList)) {
    return [];
  }

  return rawList
    .map((entry) => (typeof entry === 'string' ? entry.trim().toLowerCase() : ''))
    .filter(Boolean);
}

function deriveRuleIds(rawRules, commonPasswords) {
  if (Array.isArray(rawRules?.ruleIds) && rawRules.ruleIds.length > 0) {
    return uniqueKnownRuleIds(rawRules.ruleIds);
  }

  const derived = ['MIN_LENGTH'];
  if (rawRules?.requireUppercase !== false) derived.push('UPPERCASE');
  if (rawRules?.requireLowercase !== false) derived.push('LOWERCASE');
  if (rawRules?.requireDigit !== false) derived.push('DIGIT');
  if (rawRules?.requireSpecial !== false) derived.push('SPECIAL');
  if (commonPasswords.length > 0) derived.push('NOT_COMMON');
  return derived;
}

function hasSpecialCharacter(password, specialCharsHint) {
  const specialChars = new Set(Array.from(specialCharsHint || DEFAULT_SPECIAL_CHARS));
  return Array.from(password).some((char) => specialChars.has(char));
}

function canEvaluateRule(ruleId, rules) {
  if (ruleId === 'NOT_COMMON') {
    return rules.commonPasswords.length > 0;
  }
  return KNOWN_RULE_IDS.has(ruleId);
}

export function normalizePasswordRules(rawRules = {}) {
  const commonPasswords = extractCommonPasswords(rawRules);
  const minLength = isPositiveInteger(rawRules?.minLength) ? rawRules.minLength : DEFAULT_MIN_LENGTH;
  const specialCharsValue = typeof rawRules?.specialCharsHint === 'string' && rawRules.specialCharsHint.length > 0
    ? rawRules.specialCharsHint
    : typeof rawRules?.specialChars === 'string' && rawRules.specialChars.length > 0
      ? rawRules.specialChars
      : '';
  const specialCharsHint = specialCharsValue
    ? specialCharsValue
    : DEFAULT_SPECIAL_CHARS;
  const ruleIds = deriveRuleIds(rawRules, commonPasswords);

  return {
    minLength,
    specialCharsHint,
    requireUppercase: rawRules?.requireUppercase !== false,
    requireLowercase: rawRules?.requireLowercase !== false,
    requireDigit: rawRules?.requireDigit !== false,
    requireSpecial: rawRules?.requireSpecial !== false,
    commonPasswords,
    ruleIds,
  };
}

export function getDisplayPasswordRuleIds(rawRules = {}) {
  const rules = normalizePasswordRules(rawRules);
  return rules.ruleIds.filter((ruleId) => canEvaluateRule(ruleId, rules));
}

export function getFailedPasswordRuleIds(password, rawRules = {}) {
  const rules = normalizePasswordRules(rawRules);
  const value = typeof password === 'string' ? password : '';
  const failedRules = [];

  for (const ruleId of getDisplayPasswordRuleIds(rules)) {
    if (ruleId === 'MIN_LENGTH' && value.length < rules.minLength) {
      failedRules.push(ruleId);
    } else if (ruleId === 'UPPERCASE' && rules.requireUppercase && !UPPERCASE_RE.test(value)) {
      failedRules.push(ruleId);
    } else if (ruleId === 'LOWERCASE' && rules.requireLowercase && !LOWERCASE_RE.test(value)) {
      failedRules.push(ruleId);
    } else if (ruleId === 'DIGIT' && rules.requireDigit && !DIGIT_RE.test(value)) {
      failedRules.push(ruleId);
    } else if (ruleId === 'SPECIAL' && rules.requireSpecial && !hasSpecialCharacter(value, rules.specialCharsHint)) {
      failedRules.push(ruleId);
    } else if (ruleId === 'NOT_COMMON' && rules.commonPasswords.includes(value.toLowerCase())) {
      failedRules.push(ruleId);
    }
  }

  return failedRules;
}
