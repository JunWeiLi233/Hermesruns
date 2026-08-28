import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_LOCALE,
  SUPPORTED_LOCALES,
  formatDateForLocale,
  formatListForLocale,
  formatNumberForLocale,
  getLocaleDefinition,
  normalizeLocale,
} from '../i18n/localeRegistry.js';
import { translate, ensureLocaleMessages } from '../i18n/translationRuntime.js';

const STORAGE_KEY = 'hermes_lang';

const I18nContext = createContext(null);
const warnedMissingKeys = new Set();

function detectSystemLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LOCALE;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return normalizeLocale(candidates.find(Boolean) || DEFAULT_LOCALE);
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

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return normalizeLocale(stored || detectSystemLanguage());
  });

  // Non-default locale dictionaries load on demand; until the chunk arrives
  // translate() falls back to the eager DEFAULT_LOCALE copy, then this bump
  // re-renders consumers in the requested language.
  const [messagesVersion, setMessagesVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    ensureLocaleMessages(lang).then(() => {
      if (!cancelled) setMessagesVersion((version) => version + 1);
    });
    return () => {
      cancelled = true;
    };
  }, [lang]);

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = getLocaleDefinition(lang).htmlLang;
  }, [lang]);

  const setLang = useCallback((language) => {
    const normalized = normalizeLocale(language);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, normalized);
    }
    setLangState(normalized);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = getLocaleDefinition(normalized).htmlLang;
    }
  }, []);

  const t = useCallback((key, replacements) => {
    return translate(lang, key, replacements, reportMissingTranslation);
  }, [lang, messagesVersion]);

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
  }), [formatDate, formatList, formatNumber, lang, messagesVersion, setLang, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export default I18nContext;
