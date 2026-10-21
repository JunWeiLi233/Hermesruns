import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  formatDateForLocale,
  formatListForLocale,
  formatNumberForLocale,
  getLocaleDefinition,
  normalizeLocale,
} from '../i18n/localeRegistry.js';
import I18nContext from './i18nContextState.js';

const STORAGE_KEY = 'hermes_lang';
const warnedMissingKeys = new Set();

function detectSystemLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return normalizeLocale(candidates.find(Boolean) || DEFAULT_LOCALE);
}

function detectPreferredLanguage() {
  const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
  return normalizeLocale(stored || detectSystemLanguage());
}

function reportMissingTranslation(key, language, fallbackLanguage) {
  if (!import.meta.env?.DEV) return;
  const identity = `${language}:${key}`;
  if (warnedMissingKeys.has(identity)) return;
  warnedMissingKeys.add(identity);
  const fallbackMessage = fallbackLanguage
    ? `; using ${fallbackLanguage}`
    : ' and fallback locale';
  console.warn(`[i18n] Missing translation key "${key}" for ${language}${fallbackMessage}.`);
}

export function I18nProviderBase({ children, runtime, initialLanguage, deferLanguageDetection = false }) {
  const [localeState, setLocaleState] = useState(() => {
    const lang = initialLanguage
      ? normalizeLocale(initialLanguage)
      : deferLanguageDetection ? DEFAULT_LOCALE : detectPreferredLanguage();
    return { lang, messages: runtime.getLoadedMessages(lang) };
  });
  const { lang } = localeState;
  const languageRequest = useRef(0);

  // Install lazy messages and update the translator identity for consumers
  // that rendered eager fallback copy before the dictionary arrived.
  useEffect(() => {
    let cancelled = false;
    runtime.ensureLocaleMessages(lang).then((messages) => {
      if (cancelled || !messages) return;
      setLocaleState((current) => current.lang === lang && current.messages !== messages
        ? { lang, messages }
        : current);
    });
    return () => { cancelled = true; };
  }, [lang, runtime]);

  // Public prerendering uses English. Detect browser preferences only after
  // hydration and keep English until the preferred dictionary is available.
  useEffect(() => {
    if (!deferLanguageDetection) return undefined;
    let cancelled = false;
    const request = languageRequest.current;
    const preferred = detectPreferredLanguage();
    runtime.ensureLocaleMessages(preferred).then((messages) => {
      if (cancelled || !messages || languageRequest.current !== request) return;
      setLocaleState((current) => current.lang === preferred && current.messages === messages
        ? current
        : { lang: preferred, messages });
    });
    return () => { cancelled = true; };
  }, [deferLanguageDetection, runtime]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = getLocaleDefinition(lang).htmlLang;
  }, [lang]);

  const setLang = useCallback((language) => {
    const normalized = normalizeLocale(language);
    languageRequest.current += 1;
    if (typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_KEY, normalized);
    setLocaleState({ lang: normalized, messages: runtime.getLoadedMessages(normalized) });
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getLocaleDefinition(normalized).htmlLang;
    }
  }, [runtime]);

  const t = useCallback((key, replacements) => (
    runtime.translate(localeState.lang, key, replacements, reportMissingTranslation)
  ), [localeState, runtime]);
  const formatNumber = useCallback((value, options) => formatNumberForLocale(lang, value, options), [lang]);
  const formatDate = useCallback((value, options) => formatDateForLocale(lang, value, options), [lang]);
  const formatList = useCallback((values, options) => formatListForLocale(lang, values, options), [lang]);

  const contextValue = useMemo(() => ({
    lang,
    locale: getLocaleDefinition(lang),
    supportedLocales: SUPPORTED_LOCALES,
    setLang,
    t,
    formatNumber,
    formatDate,
    formatList,
  }), [formatDate, formatList, formatNumber, lang, setLang, t]);

  return <I18nContext.Provider value={contextValue}>{children}</I18nContext.Provider>;
}

export default I18nProviderBase;
