import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'hermes_theme';
const AVAILABLE_THEMES = ['light', 'midnight'];
const BODY_THEME_CLASSES = ['light', 'midnight', 'high-contrast', 'high-contrast-light'].map((t) => `theme-${t}`);

const ThemeContext = createContext(null);

function normalizeTheme(theme) {
  if (theme === 'high-contrast') return 'midnight';
  if (theme === 'high-contrast-light') return 'light';
  return AVAILABLE_THEMES.includes(theme) ? theme : 'light';
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const normalized = normalizeTheme(localStorage.getItem(STORAGE_KEY));
    localStorage.setItem(STORAGE_KEY, normalized);
    return normalized;
  });

  const setTheme = useCallback((newTheme) => {
    const validated = normalizeTheme(newTheme);
    localStorage.setItem(STORAGE_KEY, validated);
    setThemeState(validated);
  }, []);

  // Theme classes live on body; CSS targets `body.theme-* .dashboard-body` (see style.css).
  // `data-theme` mirrors the active theme for selectors like [data-theme="light"].
  useEffect(() => {
    const body = document.body;
    BODY_THEME_CLASSES.forEach((cls) => body.classList.remove(cls));
    body.classList.add(`theme-${theme}`);
    const html = document.documentElement;
    html.setAttribute('data-theme', theme);
    html.style.colorScheme = theme === 'midnight' ? 'dark' : 'light';
  }, [theme]);

  const isDark = theme === 'midnight';

  const contextValue = useMemo(() => ({ theme, setTheme, isDark }), [theme, setTheme, isDark]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
