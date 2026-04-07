import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const infoDisclosureSource = readFileSync(path.join(here, 'InfoDisclosure.jsx'), 'utf8');
const todayRunSource = readFileSync(path.join(here, '../../pages/TodayRun.jsx'), 'utf8');

assert.match(
  infoDisclosureSource,
  /useState\(false\)/,
  'InfoDisclosure should start collapsed by default.'
);

assert.match(
  infoDisclosureSource,
  /onClick=\{\(\) => setOpen\(\(value\) => !value\)\}/,
  'InfoDisclosure should toggle open state when pressed.'
);

assert.match(
  infoDisclosureSource,
  /\{open \? \(/,
  'InfoDisclosure should only render helper copy after toggle.'
);

assert.match(
  todayRunSource,
  /today-run-overview-disclosure/,
  'TodayRun should wire the overview helper copy through InfoDisclosure.'
);

assert.match(
  todayRunSource,
  /t\('today_run\.copy'\)/,
  'TodayRun should keep its overview helper copy inside the disclosure.'
);
