import translations from './translations.js';
import { DEFAULT_LOCALE, normalizeLocale } from './localeRegistry.js';

const INTERNAL_KEY_PREFIXES = ['stitch_'];
const INTERNAL_KEY_SUFFIXES = [
  '_label',
  '_surface_label',
  '_preview_label',
  '_kicker',
  '_subtitle',
  '_copy',
  '_desc',
  '_description',
  '_helper',
  '_hint',
  '_actions',
  '_reset',
  '_status',
  '_caption',
  '_eyebrow',
];

export function getTranslationValue(language, key) {
  return key.split('.').reduce((current, part) => current && current[part], translations[language]);
}

export function humanizeTranslationKey(key) {
  if (!key || typeof key !== 'string') return '';
  const leaf = key.includes('.') ? key.split('.').pop() : key;
  const normalizedLeaf = String(leaf).trim().toLowerCase();
  const looksInternal = INTERNAL_KEY_PREFIXES.some((prefix) => normalizedLeaf.startsWith(prefix))
    || INTERNAL_KEY_SUFFIXES.some((suffix) => normalizedLeaf.endsWith(suffix));
  if (looksInternal) return '';
  const normalized = leaf.replaceAll(/[_-]+/g, ' ').replaceAll(/\s+/g, ' ').trim();
  if (!normalized) return key;
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function interpolateTranslation(value, replacements) {
  if (!replacements) return value;
  return Object.entries(replacements).reduce(
    (result, [token, tokenValue]) => result.replaceAll(`{${token}}`, String(tokenValue)),
    value,
  );
}

export function translate(language, key, replacements, onMissing) {
  const normalizedLanguage = normalizeLocale(language);
  const localizedValue = getTranslationValue(normalizedLanguage, key);
  const fallbackValue = normalizedLanguage === DEFAULT_LOCALE
    ? localizedValue
    : getTranslationValue(DEFAULT_LOCALE, key);
  const value = typeof localizedValue === 'string' ? localizedValue : fallbackValue;

  if (typeof localizedValue !== 'string' && typeof fallbackValue === 'string') {
    onMissing?.(key, normalizedLanguage, DEFAULT_LOCALE);
  }

  if (typeof value !== 'string') {
    onMissing?.(key, normalizedLanguage, null);
    return humanizeTranslationKey(key);
  }

  return interpolateTranslation(value, replacements);
}
