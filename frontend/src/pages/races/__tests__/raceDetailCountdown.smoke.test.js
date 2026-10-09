import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const racesDetailSource = readFileSync(path.join(here, "../RacesDetail.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');
const enPagesSource = readFileSync(path.join(here, "../../../i18n/locales/en/pages.js"), 'utf8');
const zhPagesSource = readFileSync(path.join(here, "../../../i18n/locales/zh-CN/pages.js"), 'utf8');

assert.match(
  racesDetailSource,
  /const seconds = totalSeconds % 60;/,
  'Race detail countdown should compute a seconds value.',
);

assert.match(
  racesDetailSource,
  /setInterval\(\(\) => setCountdownNow\(Date\.now\(\)\), 1000\)/,
  'Race detail countdown should tick every second while the page is mounted.',
);

assert.match(
  racesDetailSource,
  /\['seconds', countdown\.seconds\][\s\S]*t\(`races\.detail_count_\$\{unitKey\}`\)/,
  'Race detail countdown should render the localized seconds label.',
);

assert.match(
  racesDetailSource,
  /key=\{unitKey === 'seconds' \? `s-\$\{value\}` : unitKey\}/,
  'Race detail countdown should remount the changing seconds value.',
);

assert.match(
  styleSource,
  /\.rd-v2-countdown\s*\{[^}]*grid-template-columns:\s*repeat\(4, minmax\(0, 1fr\)\)/,
  'Race detail styles should keep all four countdown units in a compact row.',
);

assert.match(
  styleSource,
  /\.rd-v2-count\.is-primary\s*\{[^}]*background:\s*#a0392a/,
  'Race detail should emphasize the days tile with the reference accent.',
);

assert.match(
  enPagesSource,
  /"detail_count_seconds":\s*"Secs"/,
  'English race detail copy should include a seconds countdown label.',
);

assert.match(
  zhPagesSource,
  /"detail_count_seconds":\s*"秒"/,
  'Chinese race detail copy should include a seconds countdown label.',
);

console.log('[PASS] Race detail countdown seconds guardrails passed.');
