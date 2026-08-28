// The fallback locale ships eagerly so first paint always has real copy; every
// other locale loads on demand (see ensureLocaleMessages) so visitors only
// download the dictionary they actually use.
import enMessages from './locales/en.js';
import { DEFAULT_LOCALE, normalizeLocale } from './localeRegistry.js';

const loadedMessages = { [DEFAULT_LOCALE]: enMessages };
const pendingLoads = new Map();

const LOCALE_LOADERS = {
  'zh-CN': () => import('./locales/zh-CN.js'),
};

export function getLoadedMessages(language) {
  return loadedMessages[normalizeLocale(language)] ?? null;
}

// Loads a locale dictionary on demand. Resolves null for unknown locales;
// the eager DEFAULT_LOCALE messages keep translate() working either way.
export async function ensureLocaleMessages(language) {
  const normalized = normalizeLocale(language);
  if (loadedMessages[normalized]) return loadedMessages[normalized];
  const loader = LOCALE_LOADERS[normalized];
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
  const messages = getLoadedMessages(language);
  if (!messages) return undefined;
  return key.split('.').reduce((current, part) => current && current[part], messages);
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
  // A non-default dictionary can be in flight during the first render. The
  // eager fallback is intentional in that window, so do not report every
  // valid key as missing before the lazy chunk has had a chance to install.
  const localePending = normalizedLanguage !== DEFAULT_LOCALE
    && Boolean(LOCALE_LOADERS[normalizedLanguage])
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
