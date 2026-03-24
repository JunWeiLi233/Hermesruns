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
    return AVAILABLE_THEMES.includes(saved) ? saved : 'light';
  });

  const setTheme = useCallback((newTheme) => {
    const validated = AVAILABLE_THEMES.includes(newTheme) ? newTheme : 'light';
    localStorage.setItem(STORAGE_KEY, validated);
    setThemeState(validated);
  }, []);

  // Apply theme class to document.body whenever theme changes
  useEffect(() => {
    const body = document.body;
    THEME_CLASSES.forEach(cls => body.classList.remove(cls));
    if (theme !== 'light') {
      body.classList.add(`theme-${theme}`);
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
