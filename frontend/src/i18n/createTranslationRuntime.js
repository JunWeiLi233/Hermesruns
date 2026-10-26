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

export function createTranslationRuntime({ fallbackMessages, localeLoaders = {} }) {
  const loadedMessages = { [DEFAULT_LOCALE]: fallbackMessages };
  const pendingLoads = new Map();

  function getLoadedMessages(language) {
    return loadedMessages[normalizeLocale(language)] ?? null;
  }

  // Keep load state within each runtime so a public locale never installs or
  // downloads the private application's dictionary.
  async function ensureLocaleMessages(language) {
    const normalized = normalizeLocale(language);
    if (loadedMessages[normalized]) return loadedMessages[normalized];
    const loader = localeLoaders[normalized];
    if (!loader) return null;
    if (!pendingLoads.has(normalized)) {
      pendingLoads.set(normalized, loader().then((module) => {
        loadedMessages[normalized] = module.default;
        pendingLoads.delete(normalized);
        return module.default;
      }).catch(() => {
        pendingLoads.delete(normalized);
        return null;
      }));
    }
    return pendingLoads.get(normalized);
  }

  function getTranslationValue(language, key) {
    const messages = getLoadedMessages(language);
    if (!messages) return undefined;
    return key.split('.').reduce((current, part) => current && current[part], messages);
  }

  function translate(language, key, replacements, onMissing) {
    const normalizedLanguage = normalizeLocale(language);
    const localizedValue = getTranslationValue(normalizedLanguage, key);
    const fallbackValue = normalizedLanguage === DEFAULT_LOCALE
      ? localizedValue
      : getTranslationValue(DEFAULT_LOCALE, key);
    const value = typeof localizedValue === 'string' ? localizedValue : fallbackValue;
    // The eager fallback is intentional while a supported locale is loading.
    const localePending = normalizedLanguage !== DEFAULT_LOCALE
      && Boolean(localeLoaders[normalizedLanguage])
      && !loadedMessages[normalizedLanguage];

    if (!localePending && typeof localizedValue !== 'string' && typeof fallbackValue === 'string') {
      onMissing?.(key, normalizedLanguage, DEFAULT_LOCALE);
    }

    if (typeof value !== 'string') {
      if (!localePending) onMissing?.(key, normalizedLanguage, null);
      return humanizeTranslationKey(key);
    }

    return interpolateTranslation(value, replacements);
  }

  return {
    getLoadedMessages,
    ensureLocaleMessages,
    getTranslationValue,
    humanizeTranslationKey,
    interpolateTranslation,
    translate,
  };
}
