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
  /t\('races\.detail_count_seconds'\)/,
  'Race detail countdown should render the localized seconds label.',
);

assert.match(
  racesDetailSource,
  /key=\{`seconds-\$\{countdown\.seconds\}`\}/,
  'Race detail countdown should remount the seconds value so the tick animation can replay.',
);

assert.match(
  styleSource,
  /@keyframes race-detail-count-tick/,
  'Race detail styles should define a countdown tick animation.',
);

assert.match(
  styleSource,
  /\.race-detail-count-card\.is-seconds\s+strong\s*\{[\s\S]*animation:\s*race-detail-count-tick/m,
  'Race detail seconds card should animate the changing value.',
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
