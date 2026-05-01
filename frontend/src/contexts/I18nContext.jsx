import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import zhCN from '../i18n/locales/zh-CN.js';
import en from '../i18n/locales/en.js';

const TRANSLATIONS = { 'zh-CN': zhCN, en };

const STORAGE_KEY = 'hermes_lang';
const DEFAULT_LANGUAGE = 'en';

const I18nContext = createContext(null);

const RUNTIME_FALLBACKS = {
  en: {},
  'zh-CN': {},
};

const INTERNAL_KEY_PREFIXES = [
  'stitch_',
];

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

function normalizeLanguage(language) {
  if (!language) return DEFAULT_LANGUAGE;
  return String(language).toLowerCase().startsWith('zh') ? 'zh-CN' : 'en';
}

function detectSystemLanguage() {
  if (typeof navigator === 'undefined') return DEFAULT_LANGUAGE;
  const candidates = Array.isArray(navigator.languages) && navigator.languages.length
    ? navigator.languages
    : [navigator.language];
  return normalizeLanguage(candidates.find(Boolean) || DEFAULT_LANGUAGE);
}

function getValue(language, key) {
  return key.split('.').reduce((current, part) => current && current[part], TRANSLATIONS[language]);
}

function humanizeKey(key) {
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

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const stored = typeof localStorage !== 'undefined' ? localStorage.getItem(STORAGE_KEY) : null;
    return normalizeLanguage(stored || detectSystemLanguage());
  });

  useEffect(() => {
    if (typeof document === 'undefined') return;
    document.documentElement.lang = lang;
  }, [lang]);

  const setLang = useCallback((language) => {
    const normalized = normalizeLanguage(language);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, normalized);
    }
    setLangState(normalized);
    if (typeof document !== 'undefined') {
      document.documentElement.lang = normalized;
    }
  }, []);

  const t = useCallback((key, replacements) => {
    const value = getValue(lang, key)
      || RUNTIME_FALLBACKS[lang]?.[key]
      || getValue(DEFAULT_LANGUAGE, key)
      || RUNTIME_FALLBACKS[DEFAULT_LANGUAGE]?.[key];

    if (typeof value !== 'string') {
      return humanizeKey(key);
    }

    if (!replacements) return value;

    return Object.entries(replacements).reduce(
      (result, [token, tokenValue]) => result.replaceAll(`{${token}}`, tokenValue),
      value,
    );
  }, [lang]);

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export default I18nContext;
