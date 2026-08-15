export const DEFAULT_LOCALE = 'en';

export const LOCALE_REGISTRY = Object.freeze({
  en: Object.freeze({
    id: 'en',
    language: 'en',
    aliases: Object.freeze(['en-US', 'en-GB']),
    htmlLang: 'en',
    intlLocale: 'en-US',
    label: 'English',
  }),
  'zh-CN': Object.freeze({
    id: 'zh-CN',
    language: 'zh',
    aliases: Object.freeze(['zh', 'zh-Hans', 'zh-Hans-CN']),
    htmlLang: 'zh-CN',
    intlLocale: 'zh-CN',
    label: '中文',
  }),
});

export const SUPPORTED_LOCALES = Object.freeze(Object.keys(LOCALE_REGISTRY));

export function normalizeLocale(language) {
  if (!language) return DEFAULT_LOCALE;
  const candidate = String(language).trim().toLowerCase().replaceAll('_', '-');
  const definitions = Object.values(LOCALE_REGISTRY);
  const exactMatch = definitions.find((definition) => (
    definition.id.toLowerCase() === candidate
    || definition.aliases.some((alias) => alias.toLowerCase() === candidate)
  ));
  if (exactMatch) return exactMatch.id;

  const baseLanguage = candidate.split('-')[0];
  const languageMatches = definitions.filter((definition) => definition.language === baseLanguage);
  if (languageMatches.length === 1) return languageMatches[0].id;
  return DEFAULT_LOCALE;
}

export function getLocaleDefinition(language) {
  return LOCALE_REGISTRY[normalizeLocale(language)];
}

export function getIntlLocale(language) {
  return getLocaleDefinition(language).intlLocale;
}

export function formatNumberForLocale(language, value, options) {
  return new Intl.NumberFormat(getIntlLocale(language), options).format(value);
}

export function formatDateForLocale(language, value, options) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat(getIntlLocale(language), options).format(date);
}

export function formatListForLocale(language, values, options = {}) {
  return new Intl.ListFormat(getIntlLocale(language), {
    style: 'long',
    type: 'conjunction',
    ...options,
  }).format(values.map(String));
}
