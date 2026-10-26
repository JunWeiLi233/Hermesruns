import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const STORAGE_KEY = 'hermes_unit';
export const UNIT_PREFERENCE_EVENT = 'hermes-unit-preference-change';
const UnitContext = createContext(null);

export function useUnit() {
  const ctx = useContext(UnitContext);
  if (!ctx) throw new Error('useUnit must be used within UnitProvider');
  return ctx;
}

export function UnitProvider({ children }) {
  const [unit, setUnitState] = useState(() => {
    let saved;
    try { saved = localStorage.getItem(STORAGE_KEY); } catch { /* The current preference still works without storage. */ }
    return saved === 'mile' ? 'mile' : 'km';
  });

  const setUnit = useCallback((u, { source = 'user' } = {}) => {
    const val = u === 'mile' ? 'mile' : 'km';
    try { localStorage.setItem(STORAGE_KEY, val); } catch { /* Keep the in-memory choice when storage is unavailable. */ }
    setUnitState(val);
    if (source === 'user') window.dispatchEvent(new CustomEvent(UNIT_PREFERENCE_EVENT, { detail: { unit: val } }));
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
