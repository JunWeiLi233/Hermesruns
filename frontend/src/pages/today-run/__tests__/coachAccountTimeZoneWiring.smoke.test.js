import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

for (const relative of ['../TodayRun.jsx', '../../schedule/Schedule.jsx']) {
  const source=readFileSync(new URL(relative, import.meta.url),'utf8');
  const call=source.match(/getTodayRunRecommendation\(\{[^}]+\}\)/)?.[0] || '';
  assert.match(call,/timeZone:[^}]*profile\?\.timeZone/,relative+' must pass the account zone while honoring a selected plan calendar.');
  const memo=source.slice(source.indexOf(call),source.indexOf(call)+450);
  assert.match(memo,/\[[^\]]*profile\?\.timeZone[^\]]*\]/,relative+' must recompute coaching when the account zone changes.');
}
console.log('Coaching account-calendar callsite contract passes.');
