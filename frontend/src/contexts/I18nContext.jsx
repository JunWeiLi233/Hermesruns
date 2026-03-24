import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import translations from '../i18n/translations';

const STORAGE_KEY = 'hermes_lang';
const DEFAULT_LANGUAGE = 'zh-CN';

const I18nContext = createContext(null);

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used within I18nProvider');
  return ctx;
}

function normalizeLanguage(language) {
  if (!language) return DEFAULT_LANGUAGE;
  return language.toLowerCase().startsWith('en') ? 'en' : 'zh-CN';
}

function getValue(language, key) {
  return key.split('.').reduce((current, part) => current && current[part], translations[language]);
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    return normalizeLanguage(localStorage.getItem(STORAGE_KEY) || DEFAULT_LANGUAGE);
  });

  const setLang = useCallback((language) => {
    const normalized = normalizeLanguage(language);
    localStorage.setItem(STORAGE_KEY, normalized);
    setLangState(normalized);
    document.documentElement.lang = normalized;
  }, []);

  const t = useCallback((key, replacements) => {
    const fallbackValue = getValue(DEFAULT_LANGUAGE, key);
    const value = getValue(lang, key) || fallbackValue || key;

    if (typeof value !== 'string') {
      return key;
    }

    if (!replacements) return value;

    return Object.entries(replacements).reduce((result, [token, tokenValue]) => {
      return result.replaceAll(`{${token}}`, tokenValue);
    }, value);
  }, [lang]);

  const contextValue = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={contextValue}>
      {children}
    </I18nContext.Provider>
  );
}

export default I18nContext;
