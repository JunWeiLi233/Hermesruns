import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = readFileSync(new URL('../AnalysisInsightDetail.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function buildLoadChartGeometry(');
const end = source.indexOf('\nfunction tonePalette(', start);
const buildGeometry = new Function(`${source.slice(start, end)}; return buildLoadChartGeometry;`)();
const dashboard = {
  chartMax: 100,
  chartWindow: Array.from({ length: 20 }, (_, index) => ({
    day: `day-${index}`, label: `9/${index + 1}`, acute: index * 5, chronic: 50,
  })),
};

for (const width of [300, 920, 1100]) {
  const geometry = buildGeometry(dashboard, width);
  assert.equal(geometry.width, width);
  assert.equal(geometry.height, 280, 'The chart must retain readable height on phones.');
  assert.equal(geometry.pts.length, 20, 'Responsive sizing must preserve every daily value.');
  assert.equal(geometry.xTicks.at(-1).day, 'day-19');
  assert.ok(geometry.xTicks.every((tick, index, ticks) => !index || tick.cx - ticks[index - 1].cx >= 60), 'Date labels must remain separated.');
  const slopes = geometry.pts.slice(1).map((point, index) => (point.acuteCy - geometry.pts[index].acuteCy) / (point.cx - geometry.pts[index].cx));
  assert.ok(slopes.every((slope) => Math.abs(slope - slopes[0]) < 1e-10), 'Equal daily changes must produce equal line slopes.');
  assert.ok(!/[CQ]/.test(geometry.acutePath), 'The chart must connect actual values with straight segments.');
}
assert.equal(buildGeometry({ chartWindow: [], chartMax: 0 }), null);
const band = buildGeometry(dashboard, 920, true);
assert.ok(band.bandPath.endsWith(' Z'));
assert.ok(band.pts.every((point) => point.bandTop < point.chronicCy && point.bandBottom > point.chronicCy));
assert.ok(band.pts.every((point) => point.bandTop >= band.padT && point.bandBottom <= band.height - band.padB));
assert.equal(band.pts[0].cx, 0);
assert.equal(band.pts.at(-1).cx, 920);
console.log('[PASS] Responsive load chart preserves daily values, slopes, and readable date labels.');
