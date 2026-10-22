export const EMPTY_FILTER = Object.freeze({ name: '', start: '', end: '', sport: 'all', subtype: 'all', gear: 'all', commute: 'any', trainer: 'any', min: '', max: '', minMinutes: '', maxMinutes: '' });
export const SPORTS = { run: 'Running', ride: 'Cycling', walk: 'Walking', hike: 'Hiking', swim: 'Swimming', other: 'Other' };
export const DEFAULT_PREFS = { units: 'km', zone: 'America/New_York', theme: 'light', currency: 'USD', metric: 'distance', annualGoalKm: '', hideFromClubs: true, reportEmail: '', reportsEnabled: false, language: 'en' };
export function civilDate(instant, zone) {
  const parts = new Intl.DateTimeFormat('en-CA', {timeZone: zone, year:'numeric', month:'2-digit', day:'2-digit'}).formatToParts(new Date(instant));
  return ['year','month','day'].map(key => parts.find(p => p.type === key).value).join('-');
}
export function validZone(zone) { try { new Intl.DateTimeFormat('en', { timeZone: zone }).format(); return true; } catch { return false; } }
export function filterErrors(filter) {
  const errors = {};
  for (const key of ['start','end']) if (filter[key] && (!/^\d{4}-\d{2}-\d{2}$/.test(filter[key]) || !Number.isFinite(Date.parse(`${filter[key]}T12:00:00Z`)) || new Date(`${filter[key]}T12:00:00Z`).toISOString().slice(0,10) !== filter[key])) errors[key] = 'Choose a valid calendar date.';
  if (filter.start && filter.end && filter.start > filter.end) errors.start = 'The first date must be on or before the last date.';
  for (const key of ['min','max','minMinutes','maxMinutes']) if (filter[key] !== '' && (!Number.isFinite(Number(filter[key])) || Number(filter[key]) < 0)) errors[key] = 'Enter zero or a positive number.';
  if (filter.min !== '' && filter.max !== '' && Number(filter.min) > Number(filter.max)) errors.min = 'Minimum distance must not exceed maximum distance.';
  if (filter.minMinutes !== '' && filter.maxMinutes !== '' && Number(filter.minMinutes) > Number(filter.maxMinutes)) errors.minMinutes = 'Minimum time must not exceed maximum time.';
  return errors;
}
export function matches(activity, f, zone) {
  const date = civilDate(activity.startTime, zone);
  const range = (value, min, max) => (min === '' && max === '') || value != null && (min === '' || value >= Number(min)) && (max === '' || value <= Number(max));
  return activity.name.toLocaleLowerCase().includes(f.name.trim().toLocaleLowerCase()) && (!f.start || date >= f.start) && (!f.end || date <= f.end)
    && ['sport','subtype','gear'].every(key => f[key] === 'all' || activity[key] === f[key])
    && ['commute','trainer'].every(key => f[key] === 'any' || activity[key] === (f[key] === 'yes'))
    && range(activity.distanceKm, f.min, f.max) && range(activity.movingSeconds == null ? null : activity.movingSeconds / 60, f.minMinutes, f.maxMinutes);
}
export function selectActivities(activities, filter, zone) { if (Object.keys(filterErrors(filter)).length) return []; return activities.filter(a => matches(a, filter, zone)); }
export function sortActivities(rows, key = 'startTime', descending = true) {
  return [...rows].sort((a,b) => {
    if (a[key] == null || b[key] == null) return a[key] == null && b[key] == null ? a.id - b.id : a[key] == null ? 1 : -1;
    const cmp = typeof a[key] === 'number' ? a[key] - b[key] : String(a[key]).localeCompare(String(b[key]));
    return cmp * (descending ? -1 : 1) || a.id - b.id;
  });
}
export const distanceValue = (km, units) => km == null ? null : units === 'mi' ? km / 1.609344 : km;
export function distance(km, units = 'km', locale = 'en') { const value = distanceValue(km, units); return value == null ? '—' : value.toLocaleString(locale, {maximumFractionDigits: 1, minimumFractionDigits: 1}); }
export function duration(seconds) { return seconds == null ? '—' : `${Math.floor(seconds / 3600)}h ${String(Math.floor(seconds / 60) % 60).padStart(2,'0')}m`; }
export function totals(rows) {
  const sum = key => rows.length && rows.every(a=>a[key]==null) ? null : rows.reduce((n,a) => n + (a[key] ?? 0), 0);
  return { count: rows.length, distanceKm: sum('distanceKm'), movingSeconds: sum('movingSeconds'), ascentM: sum('ascentM'), gps: rows.filter(a => a.segments.some(s => s.length)).length, missingDistance: rows.filter(a => a.distanceKm == null).length, missingTime: rows.filter(a => a.movingSeconds == null).length };
}
export function periodSeries(rows, zone, period) {
  const grouped = new Map();
  for (const a of rows) {
    const date = civilDate(a.startTime, zone); let key = period === 'year' ? date.slice(0,4) : period === 'month' ? date.slice(0,7) : date;
    if (period === 'week') { const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7); key = d.toISOString().slice(0,10); }
    if (!grouped.has(key)) grouped.set(key, []); grouped.get(key).push(a);
  }
  return [...grouped].sort(([a],[b]) => a.localeCompare(b)).map(([period, items]) => ({period, ...totals(items)}));
}
export function statistics(rows, zone, now = new Date()) {
  const today = civilDate(now, zone); const daysAgo = n => { const d = new Date(`${today}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0,10); };
  const through = start => totals(rows.filter(a => { const day = civilDate(a.startTime, zone); return day >= start && day <= today; }));
  const monthly = periodSeries(rows,zone,'month'); let cumulative = 0;let knownCumulative=false;
  return { totals: totals(rows), records: { distance: sortActivities(rows.filter(a=>a.distanceKm!=null),'distanceKm')[0] || null, time: sortActivities(rows.filter(a=>a.movingSeconds!=null),'movingSeconds')[0] || null, ascent: sortActivities(rows.filter(a=>a.ascentM!=null),'ascentM')[0] || null },
    monthly, yearly: periodSeries(rows,zone,'year'), weekly: periodSeries(rows,zone,'week'), cumulative: monthly.map(row => {if(row.distanceKm!=null){cumulative+=row.distanceKm;knownCumulative=true;}return {...row,distanceKm:knownCumulative?cumulative:null};}),
    rolling: [7,30,90,365].map(days => ({period:`${days} days`, ...through(daysAgo(days-1))})),
    toDate: [{period:'Month to date',...through(`${today.slice(0,7)}-01`)},{period:'Year to date',...through(`${today.slice(0,4)}-01-01`)}] };
}
export function filterCount(f) { return Object.keys(EMPTY_FILTER).filter(key => f[key] !== EMPTY_FILTER[key]).length; }
