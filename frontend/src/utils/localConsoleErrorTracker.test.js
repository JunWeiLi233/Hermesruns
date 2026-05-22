import assert from 'node:assert/strict';

import { buildConsoleFingerprint, shouldTrackLocalConsoleErrors } from './localConsoleErrorTracker.js';

assert.equal(
  shouldTrackLocalConsoleErrors({ hostname: 'localhost', port: '8080' }),
  true,
);

assert.equal(
  shouldTrackLocalConsoleErrors({ hostname: 'localhost', port: '5173' }),
  false,
);

assert.equal(
  shouldTrackLocalConsoleErrors({ hostname: 'hermes.app', port: '' }),
  false,
);

assert.equal(
  buildConsoleFingerprint({
    kind: 'console.error',
    severity: 'error',
    route: '/heatmap',
    message: 'Failed to load heatmap',
    stack: 'TypeError: boom\nat Heatmap.jsx:10',
    sourceUrl: 'http://localhost:8080/assets/Heatmap.js',
    assetUrl: '',
  }),
  'console.error||error||/heatmap||Failed to load heatmap||TypeError: boom||http://localhost:8080/assets/Heatmap.js||',
);

console.log('[PASS] Local console error tracker guardrails passed.');
