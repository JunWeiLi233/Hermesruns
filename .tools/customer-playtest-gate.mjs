#!/usr/bin/env node
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function splitRoutes(value) {
  return value
    .split(',')
    .map((route) => route.trim())
    .filter(Boolean);
}

const surface = readArg('surface', 'Hermes UI round');
const round = readArg('round', 'manual-redesign-round');
const routes = splitRoutes(readArg('routes', '/profile'));
const outPath = path.resolve(readArg('out', '.ai-sync/CUSTOMER_PLAYTEST_GATE.md'));
const generatedAt = new Date().toISOString();

const routeRows = routes
  .map((route) => `| \`${route}\` | Not run | Add Browser URL, viewport, screenshot/DOM note, console summary |`)
  .join('\n');

const taskRows = routes
  .flatMap((route) => [
    `| Amateur runner | \`${route}\` | Find the main decision, understand the next action, and recover if the page is empty or loading. | Pending | |`,
    `| Elite runner | \`${route}\` | Locate deeper evidence, verify the page preserves trust signals, and move to the next training/race action. | Pending | |`,
  ])
  .join('\n');

const content = `# Customer Playtest Gate

Generated: ${generatedAt}
Round: ${round}
Surface: ${surface}

Use this gate at the end of a meaningful Hermes UI/design round before claiming the page is complete. Run it as a customer, not as the implementer.

## Browser evidence

| Route | Status | Evidence |
| --- | --- | --- |
${routeRows}

## Customer Tasks

| Persona | Route | Playtest task | Result | Customer feedback |
| --- | --- | --- | --- | --- |
${taskRows}

## Scoring

Rate each route from 1-5.

| Criterion | Score | Notes |
| --- | --- | --- |
| Navigation clarity | Pending | Can the runner tell where they are and where to go next? |
| Decision clarity | Pending | Is the primary training/race/shoe/weather decision obvious within the first screen? |
| Amateur-runner confidence | Pending | Does the page explain enough without jargon or dead ends? |
| Elite-runner trust | Pending | Are proof, data basis, and controls reachable without clutter? |
| Daily-use enjoyment | Pending | Does the page feel rewarding enough to revisit without being noisy? |
| Accessibility basics | Pending | Keyboard focus, labels, contrast, and state feedback are acceptable. |

## Round verdict

- Verdict: Pending
- Must-fix before pass:
- Customer feedback summary:
- Evidence owner:

Pass only when both personas can complete the route tasks, navigation clarity is at least 4/5, daily-use enjoyment is at least 4/5, and no must-fix accessibility or runtime issue remains.
`;

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath}`);
