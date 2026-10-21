import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const source=fs.readFileSync(new URL('../RunDetail.jsx',import.meta.url),'utf8');
test('run detail mounts separate interval and condition comparison views without replacing original laps',()=>{
  assert.match(source,/import RunIntervalAnalysis from '\.\/RunIntervalAnalysis'/);
  assert.match(source,/import ConditionSessionComparison from '\.\/ConditionSessionComparison'/);
  assert.match(source,/<RunIntervalAnalysis[^>]*activityId=\{run\.id\}/);
  assert.match(source,/<ConditionSessionComparison[^>]*activityId=\{run\.id\}/);
  assert.match(source,/id="run-detail-splits"/);
  assert.match(source,/id="run-detail-telemetry"/);
});
