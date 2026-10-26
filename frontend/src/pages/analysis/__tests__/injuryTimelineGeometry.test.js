import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

// RED executes the real page function; GREEN executes the utility imported by that page.
const source = readFileSync(new URL('../AnalysisInsightDetail.jsx', import.meta.url), 'utf8');
const start = source.indexOf('function buildTrendGeometry(');
const end = source.indexOf('\nfunction buildLoadChartGeometry(', start);
const { buildTrendGeometry } = start >= 0
  ? { buildTrendGeometry: new Function('clamp', `${source.slice(start, end)}; return buildTrendGeometry;`)((v, min, max) => Math.max(min, Math.min(max, v))) }
  : await import('../injuryTrendGeometry.js');

const rows = (dates, values = {}) => dates.map((trainingDate, index) => ({
  id: index + 1, trainingDate, dateLabel: trainingDate, title: `Run ${index + 1}`,
  loadScore: 40 + index * 10, cadence: 170 + index, ...values,
})).reverse();
const build = data => buildTrendGeometry(data, data.length);

test('Oct 1/2/14 have date-proportional x=18/92.153846/982', () => {
  const geometry = build(rows(['2026-10-01', '2026-10-02', '2026-10-14']));
  const expected = [18, 92.15384615384616, 982];
  geometry.points.forEach((point, index) => assert.ok(Math.abs(point.x - expected[index]) < 1e-8, `expected ${expected[index]}, received ${point.x}`));
});

test('DST calendar days remain equally spaced across spring and fall changes', () => {
  for (const dates of [['2026-03-07', '2026-03-08', '2026-03-09'], ['2026-10-31', '2026-11-01', '2026-11-02']]) {
    assert.deepEqual(build(rows(dates)).points.map(p => p.x), [18, 500, 982]);
  }
});

test('same-day doubles share x and retain distinct stable activity identities', () => {
  const data = rows(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-14']);
  const geometry = build(data);
  const doubles = geometry.points.filter(p => p.dateKey === '2026-10-02');
  assert.equal(doubles.length, 2);
  assert.equal(doubles[0].x, doubles[1].x);
  assert.notEqual(doubles[0].key, doubles[1].key);
  const reordered = build([...data].reverse());
  for (const point of doubles) assert.equal(reordered.points.find(p => p.id === point.id).key, point.key);
});

test('one day and single observations use a finite centered coordinate', () => {
  for (const dates of [['2026-10-02'], ['2026-10-02', '2026-10-02']]) {
    assert.ok(build(rows(dates)).points.every(p => p.x === 500));
  }
});

test('sparse dates contain only real observations and unique axis ticks', () => {
  const geometry = build(rows(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-14']));
  assert.equal(geometry.points.length, 4);
  assert.deepEqual(geometry.ticks.map(t => t.dateKey), ['2026-10-01', '2026-10-02', '2026-10-14']);
  assert.equal(geometry.primaryPath.match(/[ML]/g).length, 4);
});

test('missing and impossible dates are omitted instead of inventing epoch values', () => {
  const geometry = build(rows(['2026-02-30', '', 'unknown', '2026-10-14']));
  assert.equal(geometry.points.length, 1);
  assert.equal(geometry.points[0].dateKey, '2026-10-14');
  assert.ok(!geometry.primaryPath.includes('NaN'));
});

test('calendar order works with unsorted rows and crosses month/year boundaries', () => {
  const geometry = build(rows(['2027-01-03', '2026-12-31', '2027-01-01']));
  assert.deepEqual(geometry.points.map(p => p.dateKey), ['2026-12-31', '2027-01-01', '2027-01-03']);
  assert.deepEqual(geometry.points.map(p => p.x), [18, 18 + 964 / 3, 982]);
});

test('cadence gaps break the comparison path without adding measured zeros', () => {
  const data = rows(['2026-10-01', '2026-10-02', '2026-10-14']);
  data[1].cadence = null;
  const geometry = build(data);
  assert.equal(geometry.points[1].comparisonY, null);
  assert.equal(geometry.comparisonPath.match(/M/g).length, 2);
  assert.ok(!geometry.comparisonPath.includes('L'));
});

test('empty input has no data, paths or date ticks', () => {
  const geometry = build([]);
  assert.deepEqual(geometry.points, []);
  assert.equal(geometry.primaryPath, '');
  assert.equal(geometry.comparisonPath, '');
  assert.equal(geometry.areaPath, '');
});
