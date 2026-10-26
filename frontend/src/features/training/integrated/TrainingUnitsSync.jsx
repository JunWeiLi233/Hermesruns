import { useEffect, useRef } from 'react';
import { useAuth } from '../../../contexts/AuthContext';
import { UNIT_PREFERENCE_EVENT, useUnit } from '../../../contexts/UnitContext';
import { createHttpClient } from '../data/http.mjs';

const OWNER_KEY = 'hermes_training_units_owner';
const migrationKey = id => `hermes_training_units_migrated_${id}`;
const serverUnits = unit => unit === 'mile' ? 'imperial' : 'metric';
const nativeUnits = units => units === 'imperial' ? 'mile' : 'km';
function readStorage(key) { try { return localStorage.getItem(key); } catch { return null; } }
function rememberOwner(id) {
  try {
    // Store only server-issued account identifiers, never credentials or another preference copy.
    localStorage.setItem(migrationKey(id), id);
    localStorage.setItem(OWNER_KEY, id);
  } catch { /* Synchronization also works when browser storage is unavailable. */ }
}

/** Mounted once under AuthProvider and UnitProvider. It adds no second units control. */
export default function TrainingUnitsSync() {
  const { token, authHydrated } = useAuth();
  const { setUnit } = useUnit();
  const previousCredential = useRef(null);
  useEffect(() => {
    if (!token || !authHydrated) return undefined;
    const sameInitialAccount = !previousCredential.current || previousCredential.current === token;
    previousCredential.current = token;
    const previousPreference = sameInitialAccount ? readStorage('hermes_unit') : null;
    const previousOwner = readStorage(OWNER_KEY);
    // The closure is bound to this credential. Cookie state can never select a different account.
    const api = createHttpClient({ getToken: () => token });
    let active = true, busy = false, queued = false, migrationChecked = false, pending = null;

    function applyProfile(profile) {
      if (!active || pending) return;
      if (!['metric', 'imperial'].includes(profile.units)) throw Error('INVALID_UNITS');
      setUnit(nativeUnits(profile.units), { source: 'server' });
      rememberOwner(profile.id);
    }

    async function synchronize() {
      if (!active) return;
      if (busy) { queued = true; return; }
      busy = true;
      try {
        let profile = await api.getMe();
        if (!active) return;
        if (!migrationChecked) {
          migrationChecked = true;
          const unclaimedPreference = !previousOwner || previousOwner === profile.id;
          if (!pending && readStorage(migrationKey(profile.id)) !== profile.id && unclaimedPreference
              && previousPreference === 'mile' && profile.units === 'metric') {
            pending = { unit: previousPreference, source: 'migration' };
          }
        }
        if (pending) {
          const choice = pending;
          const save = () => api.updateProfile({ units: serverUnits(choice.unit), revision: profile.revision });
          try {
            profile = await save();
          } catch (error) {
            if (!active) return;
            const conflict = error.status === 409 || error.status === 412;
            if (!conflict || choice.source !== 'user' || pending !== choice) {
              if (conflict && pending === choice && choice.source === 'migration') pending = null;
              throw error;
            }
            // Retry only a still-current explicit user choice, once, against a fresh revision.
            profile = await api.getMe();
            if (!active) return;
            if (pending !== choice) { queued = true; return; }
            profile = await save();
          }
          if (!active) return;
          if (pending === choice) pending = null;
          else { queued = true; return; }
        }
        applyProfile(profile);
      } catch {
        // The local choice remains visible. Pending user intent survives until a successful retry.
      } finally {
        busy = false;
        if (active && queued) { queued = false; void synchronize(); }
      }
    }

    const onChoice = event => {
      if (!['km', 'mile'].includes(event.detail?.unit)) return;
      pending = { unit: event.detail.unit, source: 'user' };
      void synchronize();
    };
    const refresh = () => { void synchronize(); };
    window.addEventListener(UNIT_PREFERENCE_EVENT, onChoice);
    window.addEventListener('focus', refresh);
    window.addEventListener('online', refresh);
    const interval = window.setInterval(refresh, 30000);
    void synchronize();
    return () => {
      active = false;
      window.clearInterval(interval);
      window.removeEventListener(UNIT_PREFERENCE_EVENT, onChoice);
      window.removeEventListener('focus', refresh);
      window.removeEventListener('online', refresh);
    };
  }, [token, authHydrated, setUnit]);
  return null;
}
