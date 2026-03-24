import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'hermes_unit';
const UnitContext = createContext(null);

export function useUnit() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnit must be used within UnitProvider');
  return ctx;
}

export function UnitProvider({ children }) {
  const [unit, setUnitState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'mile' ? 'mile' : 'km';
  });

  const setUnit = useCallback((u) => {
    const val = u === 'mile' ? 'mile' : 'km';
    localStorage.setItem(STORAGE_KEY, val);
    setUnitState(val);
  }, []);

  const isMile = unit === 'mile';

  const contextValue = useMemo(() => ({ unit, setUnit, isMile }), [unit, setUnit, isMile]);

  return (
    <UnitContext.Provider value={contextValue}>
      {children}
    </UnitContext.Provider>
  );
}

export default UnitContext;
