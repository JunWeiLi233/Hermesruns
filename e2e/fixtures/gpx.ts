// Builds GPX 1.1 files for seeding runs.
//
// A run is described by a few numbers ("an 8 km loop at 5:00/km, 150 bpm, with hills"), so a test can read the same
// numbers back in its assertions. The route is a circle that starts and ends at `origin` (or a straight line due
// north), points are `stepM` metres apart, and the clock follows the pace you give.
//
// Erasable TypeScript only (no enums), so plain Node can import this file as well as Playwright.

export interface LatLon {
  lat: number;
  lon: number;
}

export interface GpxRunOptions {
  /** Track name, which becomes the run's name. */
  name: string;
  /** When the run starts (UTC). */
  start: Date;
  /** Route length in metres: a loop's circumference, or a line's length. */
  distanceM: number;
  /** Moving pace in seconds per km: one number, or a function of the metres already run. */
  pace: number | ((metresRun: number) => number);
  /** Where the route starts and, for a loop, ends. */
  origin?: LatLon;
  /** `loop` goes round a circle through `origin`; `line` runs due north. Default `loop`. */
  shape?: 'loop' | 'line';
  /** Direction round a loop. Default true. */
  clockwise?: boolean;
  /** Heart rate in bpm: a number, a function of the metres already run, or null for none. Default null. */
  hr?: number | ((metresRun: number) => number) | null;
  /** Elevation in metres as a function of the metres already run; null writes no elevation. Default null. */
  elevation?: ((metresRun: number) => number) | null;
  /** false leaves out every <time> (a route with no timestamps). Default true. */
  timestamps?: boolean;
  /** Stops: after `atM` metres the clock runs on for `forSec` seconds while the runner stands still. */
  stops?: Array<{ atM: number; forSec: number }>;
  /** Metres between points. Default 10. */
  stepM?: number;
  /** Cadence in steps per minute, or null for none. Default null. */
  cadence?: number | null;
  /** Sport label written to <type>. Default `running`. */
  type?: string;
}

/** A spot in Central Park's Great Lawn area; every route that should match another starts from the same door. */
export const DEFAULT_ORIGIN: LatLon = { lat: 40.7812, lon: -73.9665 };

const METRES_PER_DEGREE_LAT = 111_320;

function xmlEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isoUtc(ms: number): string {
  return new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
}

/** Elevation that rises and falls `amplitudeM` metres every `periodM` metres, on top of `baseM`. */
export function rollingHills(amplitudeM: number, periodM: number, baseM = 20): (metresRun: number) => number {
  return (metresRun) => baseM + (amplitudeM * (1 - Math.cos((2 * Math.PI * metresRun) / periodM))) / 2;
}

/** Alternates `fastSecPerKm` and `slowSecPerKm` every `segmentM` metres. */
export function intervalPace(fastSecPerKm: number, slowSecPerKm: number, segmentM: number): (metresRun: number) => number {
  return (metresRun) => (Math.floor(metresRun / segmentM) % 2 === 0 ? fastSecPerKm : slowSecPerKm);
}

export function gpxRun(options: GpxRunOptions): string {
  const origin = options.origin ?? DEFAULT_ORIGIN;
  const shape = options.shape ?? 'loop';
  const clockwise = options.clockwise ?? true;
  const stepM = options.stepM ?? 10;
  const withTime = options.timestamps ?? true;
  const radius = options.distanceM / (2 * Math.PI);
  const cosLat = Math.cos((origin.lat * Math.PI) / 180);
  const paceAt = (metresRun: number): number =>
    typeof options.pace === 'function' ? options.pace(metresRun) : options.pace;
  const hrAt = (metresRun: number): number | null => {
    const hr = options.hr ?? null;
    if (hr === null) return null;
    return Math.round(typeof hr === 'function' ? hr(metresRun) : hr);
  };

  const position = (metresRun: number): LatLon => {
    let east: number;
    let north: number;
    if (shape === 'line') {
      east = 0;
      north = metresRun;
    } else {
      const angle = (2 * Math.PI * metresRun) / options.distanceM;
      east = (clockwise ? -1 : 1) * radius * Math.sin(angle);
      north = radius * (1 - Math.cos(angle));
    }
    return { lat: origin.lat + north / METRES_PER_DEGREE_LAT, lon: origin.lon + east / (METRES_PER_DEGREE_LAT * cosLat) };
  };

  const stops = [...(options.stops ?? [])].sort((a, b) => a.atM - b.atM);
  const lines: string[] = [];
  let clockSec = 0;
  let nextStop = 0;

  const point = (metresRun: number, atSec: number): void => {
    const where = position(metresRun);
    const parts = [`<trkpt lat="${where.lat.toFixed(7)}" lon="${where.lon.toFixed(7)}">`];
    if (options.elevation) parts.push(`<ele>${options.elevation(metresRun).toFixed(1)}</ele>`);
    if (withTime) parts.push(`<time>${isoUtc(options.start.getTime() + atSec * 1000)}</time>`);
    const hr = hrAt(metresRun);
    const cadence = options.cadence ?? null;
    if (hr !== null || cadence !== null) {
      parts.push('<extensions><gpxtpx:TrackPointExtension>');
      if (hr !== null) parts.push(`<gpxtpx:hr>${hr}</gpxtpx:hr>`);
      if (cadence !== null) parts.push(`<gpxtpx:cad>${cadence}</gpxtpx:cad>`);
      parts.push('</gpxtpx:TrackPointExtension></extensions>');
    }
    parts.push('</trkpt>');
    lines.push(parts.join(''));
  };

  point(0, 0);
  for (let metres = 0; metres < options.distanceM; ) {
    const next = Math.min(options.distanceM, metres + stepM);
    clockSec += (paceAt((metres + next) / 2) / 1000) * (next - metres);
    metres = next;
    while (nextStop < stops.length && stops[nextStop].atM <= metres) {
      // Standing still: the clock moves, the position does not. A point every 5 s keeps the stop visible.
      for (let waited = 5; waited <= stops[nextStop].forSec; waited += 5) point(metres, clockSec + waited);
      clockSec += stops[nextStop].forSec;
      nextStop += 1;
    }
    point(metres, clockSec);
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<gpx version="1.1" creator="hermesruns-e2e" xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">',
    `<metadata><name>${xmlEscape(options.name)}</name>${withTime ? `<time>${isoUtc(options.start.getTime())}</time>` : ''}</metadata>`,
    `<trk><name>${xmlEscape(options.name)}</name><type>${xmlEscape(options.type ?? 'running')}</type><trkseg>`,
    ...lines,
    '</trkseg></trk>',
    '</gpx>',
    '',
  ].join('\n');
}

/** Midnight-free "n days ago at 07:00 UTC", so seeded runs land on recent, distinct days. */
export function daysAgo(days: number, hourUtc = 11): Date {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  date.setUTCHours(hourUtc, 0, 0, 0);
  return date;
}
