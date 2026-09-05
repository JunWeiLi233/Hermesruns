import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const profileSource = readFileSync(path.join(here, "../ProfileDashboard.jsx"), 'utf8');
const comebackSource = readFileSync(path.join(here, "../../../components/ComebackMessage.jsx"), 'utf8');
const styleSource = readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8');
const liquidGlassSource = readFileSync(path.join(here, "../../../styles/all-pages-liquid-glass.css"), 'utf8');
const translationsSource = [
  readFileSync(path.join(here, "../../../i18n/locales/en/pages.js"), 'utf8'),
  readFileSync(path.join(here, "../../../i18n/locales/zh-CN/pages.js"), 'utf8'),
].join('\n');

assert.match(
  profileSource,
  /const \[comebackGateStatus, setComebackGateStatus\] = useState\('pending'\)/,
  'Profile dashboard should track comeback gate as pending until coach enrichment settles.',
);

assert.match(
  profileSource,
  /const shouldShowComebackCard =[\s\S]*comebackGateStatus === 'settled'[\s\S]*todayBundle\.recommendation\?\.intent === 'comeback'[\s\S]*runs\.length > 0/,
  'True comeback still shows: only render after enrichment settles and settled intent is comeback.',
);

assert.match(
  profileSource,
  /setComebackGateStatus\('pending'\)[\s\S]*settleComebackGate[\s\S]*setComebackGateStatus\('settled'\)/,
  'Comeback gate resets pending on each load and settles only after coach enrichment applies.',
);

assert.match(
  profileSource,
  /status === 'pending' \? 'timed_out'/,
  'Enrichment timeout must force timed_out so a slow path never flashes a transient comeback.',
);

assert.doesNotMatch(
  profileSource,
  /shouldShowComebackCard =[\s\S]{0,280}daysOff >= 2/,
  'Do not latch first-paint comeback via daysOff �� wait for settled intent instead.',
);

assert.match(
  profileSource,
  /shouldShowComebackCard && \(\s*<ComebackMessage[\s\S]*primaryLabel=\{t\('profile\.comeback_action_primary'\)\}[\s\S]*secondaryLabel=\{t\('profile\.comeback_action_secondary'\)\}[\s\S]*onPrimaryAction=\{\(\) => navigate\('\/today-run'\)\}[\s\S]*onSecondaryAction=\{\(\) => navigate\('\/runs'\)\}/,
  'Profile dashboard should wire the comeback card to real Today Run and Runs actions.',
);

assert.match(
  comebackSource,
  /const ComebackMessage = \(\{[\s\S]*primaryLabel,[\s\S]*secondaryLabel,[\s\S]*onPrimaryAction,[\s\S]*onSecondaryAction[\s\S]*\}\) =>/,
  'ComebackMessage should accept explicit action labels and handlers.',
);

assert.match(
  comebackSource,
  /<button[\s\S]*className="runner-comeback-card__tip runner-comeback-card__tip--primary"[\s\S]*onClick=\{onPrimaryAction\}[\s\S]*>\s*\{primaryLabel\}\s*<\/button>/,
  'ComebackMessage should turn the primary pill into a real button.',
);

assert.match(
  comebackSource,
  /<button[\s\S]*className="runner-comeback-card__tip runner-comeback-card__tip--secondary"[\s\S]*onClick=\{onSecondaryAction\}[\s\S]*>\s*\{secondaryLabel\}\s*<\/button>/,
  'ComebackMessage should turn the secondary pill into a real button.',
);

assert.match(
  styleSource,
  /\.runner-comeback-card__tip\s*\{[\s\S]*cursor:\s*pointer[\s\S]*\.runner-comeback-card__tip--primary[\s\S]*\.runner-comeback-card__tip--secondary/s,
  'Comeback action pills should have explicit interactive styling instead of passive hint styling.',
);

assert.match(
  styleSource,
  /\.runner-comeback-card__close\s*\{[\s\S]*z-index:\s*2;/,
  'Comeback dismiss control should sit above the card body so it can actually receive clicks.',
);

assert.match(
  liquidGlassSource,
  /\.runner-comeback-card__body,[\s\S]*\.runner-comeback-card__tips[\s\S]*background:\s*transparent\s*!important[\s\S]*background-image:\s*none\s*!important/,
  'Liquid-glass card sweeping must not paint paper strips behind comeback text.',
);

assert.match(
  liquidGlassSource,
  /\.runner-shell-page \.hd-content :is\(\s*\.hd-card-head,\s*\.hd-card-head > div,[\s\S]*\.hd-card-title\s*\)\s*\{[\s\S]*background:\s*transparent\s*!important[\s\S]*background-image:\s*none\s*!important/,
  'Liquid-glass card sweeping must not paint paper strips behind profile card headings.',
);

assert.match(
  translationsSource,
  /"comeback_action_primary":/,
  'Both locales should define the primary comeback action label.',
);

assert.match(
  translationsSource,
  /"comeback_action_secondary":/,
  'Both locales should define the secondary comeback action label.',
);

console.log('[PASS] Profile comeback card action guardrails passed.');
