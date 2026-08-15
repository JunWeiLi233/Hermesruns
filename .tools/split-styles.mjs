#!/usr/bin/env node

console.warn('[styles] split-styles.mjs is deprecated; split CSS files are now authoritative.');
await import('./generate-legacy-style-bundle.mjs');
