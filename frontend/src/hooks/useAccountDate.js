import { useEffect, useState } from 'react';
import { getAccountDate } from '../utils/timeZone';

/** Refresh the account calendar on midnight, page return, and timezone changes. */
export function useAccountDate(timeZone) {
  const [clock, setClock] = useState(() => new Date());
  useEffect(() => {
    const refresh = () => {
      const now = new Date();
      setClock(previous => getAccountDate(timeZone, previous) === getAccountDate(timeZone, now) ? previous : now);
    };
    // A profile timezone can arrive after focus was handled by the previous
    // zone's listener. Reconcile the clock now instead of waiting a minute.
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [timeZone]);
  return getAccountDate(timeZone, clock);
}
