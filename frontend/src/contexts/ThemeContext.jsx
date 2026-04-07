import { createContext, useContext, useState, useCallback, useEffect, useMemo } from 'react';

const STORAGE_KEY = 'hermes_theme';
const AVAILABLE_THEMES = ['light', 'midnight', 'high-contrast', 'high-contrast-light'];
const THEME_CLASSES = AVAILABLE_THEMES.filter(t => t !== 'light').map(t => `theme-${t}`);

const ThemeContext = createContext(null);

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light') return 'light';
    localStorage.setItem(STORAGE_KEY, 'light');
    return 'light';
  });

  const setTheme = useCallback((newTheme) => {
    const validated = AVAILABLE_THEMES.includes(newTheme) ? newTheme : 'light';
    localStorage.setItem(STORAGE_KEY, validated);
    setThemeState(validated);
  }, []);

  // Theme classes live on body; CSS targets `body.theme-* .dashboard-body` (see style.css).
  // `data-theme` mirrors midnight / high-contrast for selectors like [data-theme="midnight"].
  useEffect(() => {
    const body = document.body;
    THEME_CLASSES.forEach(cls => body.classList.remove(cls));
    if (theme !== 'light') {
      body.classList.add(`theme-${theme}`);
    }
    const html = document.documentElement;
    if (theme === 'midnight' || theme === 'high-contrast') {
      html.setAttribute('data-theme', theme);
    } else {
      html.removeAttribute('data-theme');
    }
  }, [theme]);

  const isDark = theme === 'midnight' || theme === 'high-contrast';

  const contextValue = useMemo(() => ({ theme, setTheme, isDark }), [theme, setTheme, isDark]);

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
}

export default ThemeContext;
