export function civilDate(v) {
  return /^\d{4}-\d{2}-\d{2}$/.test(v || '') && Number.isFinite(Date.parse(v + 'T12:00:00Z')) && new Date(v + 'T12:00:00Z').toISOString().slice(0, 10) === v;
}
export function addDays(date, n) {
  const d = new Date(date + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function compileWorkout(source = '') {
  const steps = [],
    errors = [];
  if (new TextEncoder().encode(source).length > 65536) return {
    steps,
    errors: ['Source exceeds 64 KiB.'],
    minutes: 0
  };
  let repeat = 1,
    block = [];
  const flush = () => {
    for (let n = 0; n < repeat; n++) steps.push(...block.map(s => ({
      ...s
    })));
    repeat = 1;
    block = [];
  };
  source.split('\n').forEach((line, i) => {
    if (!line.trim()) return;
    const r = /^(\d{1,3})x$/.exec(line.trim());
    if (r) {
      if (/^\s/.test(line)) {
        errors.push(`Line ${i + 1}: nested repeats are unavailable in this client grammar.`);
        return;
      }
      flush();
      repeat = +r[1];
      if (repeat < 1 || repeat > 50) errors.push(`Line ${i + 1}: use 1–50 repeats.`);
      return;
    }
    const m = /^(\d+(?:\.\d+)?)m\s+@(\d+(?:\.\d+)?)(%|bpm|W|rpm|m\/s)\s+(.+)$/.exec(line.trim());
    if (!m || +m[1] <= 0 || +m[1] > 180 || +m[2] <= 0) {
      errors.push(`Line ${i + 1}: use “10m @65% Warm up”; units %, bpm, W, rpm or m/s.`);
      return;
    }
    const s = {
      minutes: +m[1],
      target: +m[2],
      unit: m[3],
      name: m[4]
    };
    if (/^\s/.test(line) && repeat > 1) block.push(s);else {
      flush();
      steps.push(s);
    }
  });
  flush();
  if (!steps.length && !errors.length) errors.push('Add a workout step.');
  if (steps.length > 2000) errors.push('Maximum 2,000 expanded steps.');
  return {
    errors,
    steps: errors.length ? [] : steps,
    minutes: errors.length ? 0 : steps.reduce((n, s) => n + s.minutes, 0)
  };
}
export function parseActivityFile(name, text, zone = 'America/New_York') {
  if (!/\.(gpx|tcx)$/i.test(name)) throw Error('Local import supports GPX/TCX. FIT, ZIP and GZ need the backend importer.');
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  if (xml.querySelector('parsererror')) throw Error('Invalid XML.');
  const find = (root, key) => [...root.getElementsByTagName('*')].find(n => n.localName.toLowerCase() === key.toLowerCase());
  const points = [...xml.getElementsByTagName('*')].filter(n => ['trkpt', 'Trackpoint'].includes(n.localName)).map(n => ({
    time: Date.parse(find(n, 'time')?.textContent || ''),
    hr: Number(find(n, 'hr')?.textContent || find(n, 'HeartRateBpm')?.textContent?.trim() || 0) || null,
    power: Number(find(n, 'watts')?.textContent || 0) || null
  })).filter(p => Number.isFinite(p.time));
  if (points.length < 2 || points.at(-1).time <= points[0].time || points.some((p, i) => i && p.time < points[i - 1].time)) throw Error('At least two ordered timestamped track points are required.');
  const startedAt = new Date(points[0].time).toISOString();
  return {
    title: find(xml, 'name')?.textContent || name,
    name,
    date: new Intl.DateTimeFormat('en-CA', {
      timeZone: zone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).format(new Date(startedAt)),
    startedAt,
    sport: /cycl|bik/i.test(text) ? 'Cycling' : 'Running',
    minutes: (points.at(-1).time - points[0].time) / 60000,
    samples: points.map(p => ({
      offset: (p.time - points[0].time) / 1000,
      hr: p.hr,
      power: p.power
    })),
    source: 'file'
  };
}
export function derive(a, settings = {
  maxHr: 190
}) {
  let known = 0,
    weighted = 0;
  const zones = [0, 0, 0, 0, 0],
    s = a.samples || [];
  for (let i = 0; i < s.length - 1; i++) {
    const seconds = Math.min(60, Math.max(0, s[i + 1].offset - s[i].offset));
    if (s[i].hr == null || s[i].hr < 30 || s[i].hr > 240) continue;
    known += seconds;
    const ratio = s[i].hr / (settings.maxHr || 190),
      band = ratio < .6 ? -1 : Math.min(4, Math.floor((ratio - .6) / .1));
    if (band >= 0) {
      zones[band] += seconds / 60;
      weighted += seconds / 60 * (band + 1);
    }
  }
  const coverage = Math.min(1, known / (a.minutes * 60)),
    load = coverage >= .9 ? Math.round(weighted) : a.rpe > 0 ? Math.round(a.minutes * a.rpe / 2) : null;
  return {
    load,
    coverage,
    zones,
    model: coverage >= .9 ? 'HR bands v1' : load == null ? 'Unknown' : 'RPE v1'
  };
}
export function detectIntervals(a) {
  const out = [];
  let start = null;
  const samples = a.samples || [];
  samples.forEach((s, i) => {
    const hard = s.hr != null && s.hr >= 150;
    if (hard && start == null) start = s.offset;
    if (start != null && (!hard || i === samples.length - 1)) {
      if (s.offset - start >= 30) out.push({
        id: `i-${out.length}`,
        start,
        end: s.offset,
        minutes: (s.offset - start) / 60
      });
      start = null;
    }
  });
  return out;
}
export function fitness(activities, events, {
  start = '2026-09-18',
  end = '2026-10-25',
  fitnessTau = 42,
  fatigueTau = 7
} = {}) {
  const out = [];
  let fit = 0,
    fat = 0;
  for (let date = start; date <= end; date = addDays(date, 1)) {
    const daily = activities.filter(a => a.date === date),
      projected = date > '2026-10-15',
      load = daily.reduce((n, a) => n + (a.load ?? 0), 0) + (projected ? events.filter(e => e.date === date && e.state === 'planned').reduce((n, e) => n + (e.projectedLoad || 0), 0) : 0);
    fit += (1 - Math.exp(-1 / fitnessTau)) * (load - fit);
    fat += (1 - Math.exp(-1 / fatigueTau)) * (load - fat);
    out.push({
      date,
      load,
      fitness: +fit.toFixed(2),
      fatigue: +fat.toFixed(2),
      form: +(fit - fat).toFixed(2),
      projected,
      provisional: daily.some(a => a.load == null)
    });
  }
  return out;
}
