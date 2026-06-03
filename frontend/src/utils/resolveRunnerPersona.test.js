import assert from 'node:assert/strict';

import { resolveRunnerPersona } from './resolveRunnerPersona.js';

const recentRun = {
  startTime: new Date(Date.now() - 2 * 86400000).toISOString(),
};

assert.equal(
  resolveRunnerPersona({
    runs: [],
    runnerState: 'comeback',
  }),
  'comeback',
  'backend runnerState should win when the dashboard payload has no recent runs',
);

assert.equal(
  resolveRunnerPersona({
    runs: [],
    runnerState: 'active',
  }),
  'active',
  'backend runnerState should preserve active runners even when runs are omitted',
);

assert.equal(
  resolveRunnerPersona({
    runs: [recentRun],
    runnerState: null,
    now: new Date().toISOString(),
  }),
  'active',
  'recent activity without a backend override should stay active',
);

assert.equal(
  resolveRunnerPersona({
    runs: [],
    runnerState: null,
  }),
  'new',
  'missing runs and missing backend state should default to new',
);

console.log('[PASS] resolveRunnerPersona coverage passed.');
