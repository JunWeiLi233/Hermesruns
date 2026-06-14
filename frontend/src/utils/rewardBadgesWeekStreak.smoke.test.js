import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'rewardBadges.jsx'), 'utf8');

function extractFunction(name) {
  const marker = name === 'startOfWeek'
    ? `function ${name}`
    : `export function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Expected ${name} in rewardBadges.jsx.`);

  let braceDepth = 0;
  let bodyStart = -1;
  let end = -1;

  for (let index = start; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      braceDepth += 1;
      if (bodyStart === -1) bodyStart = index;
    } else if (char === '}') {
      braceDepth -= 1;
      if (bodyStart !== -1 && braceDepth === 0) {
        end = index + 1;
        break;
      }
    }
  }

  assert.notEqual(end, -1, `Expected complete ${name} function body.`);
  return source.slice(start, end).replace('export ', '');
}

const context = {};
vm.createContext(context);
vm.runInContext(`
${extractFunction('startOfWeek')}
${extractFunction('getConsecutiveRunWeekStreak')}
this.getConsecutiveRunWeekStreak = getConsecutiveRunWeekStreak;
`, context);

const previousWeekOnly = [
  { startTime: '2026-06-09T06:00:00.000Z', distanceKm: 8 },
  { startTime: '2026-06-11T06:00:00.000Z', distanceKm: 10 },
];

assert.equal(
  context.getConsecutiveRunWeekStreak(previousWeekOnly),
  0,
  'Weekly streaks should reset when the latest run is from last week instead of the current week.',
);

console.log('[PASS] rewardBadges weekly streak smoke test passed.');
