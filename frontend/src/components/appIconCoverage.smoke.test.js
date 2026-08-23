// Drift guardrail for AppIcon: every icon name referenced anywhere in the
// frontend (static `name="..."` or dynamic `item.icon`-style data) must have
// a matching `case '<name>':` in AppIcon.jsx. The previous regression had ~29
// names falling through to the default fallback so the runner saw a row of
// "?" glyphs next to every side-link.
//
// This is a SOURCE-LEVEL test (no React renderer required) so it stays fast
// and works in Node without jsdom. It catches the breakage at PR time.

import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      if (entry === 'node_modules' || entry.startsWith('.')) continue;
      yield* walk(full);
    } else if (/\.(jsx|js|tsx|ts)$/i.test(entry) && !/\.test\.[jt]sx?$/i.test(entry)) {
      yield full;
    }
  }
}

const appIconSource = readFileSync(path.join(here, 'AppIcon.jsx'), 'utf8');
const definedCases = new Set(
  Array.from(appIconSource.matchAll(/case\s+'([^']+)'\s*:/g)).map((m) => m[1])
);

// Used icon names: static `name="..."`, conditional literals inside
// `name={ ... ? 'x' : 'y' }`, and `icon:` data-side definitions that get
// piped into AppIcon via `name={item.icon}`.
const used = new Set();
const NAME_STATIC = /\bAppIcon[^/>]*?name=(["'])([a-z_][a-z0-9_]*)\1/gi;
const NAME_TERNARY = /\bAppIcon[^/>]*?name=\{([^}]*)\}/gi;
// Lowercase-anchored: AppIcon names are always lowercase. Some unrelated data
// objects use `icon: 'E'` / `'R'` / etc. as zone-tag text labels — drop the
// `i` flag so those don't get mis-classified as AppIcon names.
const ICON_ASSIGN = /\bicon:\s*['"]([a-z_][a-z0-9_]*)['"]/g;

// Inside a ternary like `cond === 'up' ? 'trending_up' : 'trending_flat'`,
// only the strings that appear immediately after `?` or `:` (the branch
// values) are icon names. The strings on the comparison side (`'up'`,
// `'E'`, etc.) are NOT icons and would create false positives.
const TERNARY_BRANCH = /[?:]\s*['"]([a-z_][a-z0-9_]+)['"]/g;

for (const file of walk(srcRoot)) {
  const content = readFileSync(file, 'utf8');
  for (const match of content.matchAll(NAME_STATIC)) {
    used.add(match[2]);
  }
  for (const match of content.matchAll(NAME_TERNARY)) {
    const expression = match[1];
    for (const branch of expression.matchAll(TERNARY_BRANCH)) {
      used.add(branch[1]);
    }
  }
  for (const match of content.matchAll(ICON_ASSIGN)) {
    used.add(match[1]);
  }
}

const missing = [...used].filter((name) => !definedCases.has(name)).sort();
assert.deepEqual(
  missing,
  [],
  `AppIcon is missing case definitions for: ${missing.join(', ')}. ` +
    `Each used icon name should map to a real SVG glyph instead of falling ` +
    `through to the default fallback.`,
);

// The default fallback should be neutral — never the alarming "?" glyph it
// used to render (circle + question dot). A defensive runtime placeholder
// is fine; a literal "?" alarm is not.
assert.doesNotMatch(
  appIconSource,
  /default:\s*[\s\S]*?<path d="M12 8\.5v4\.5" \/>\s*<path d="M12 16\.5h\.01" \/>/,
  'AppIcon default fallback should not render the harsh "?" glyph (circle + bar + dot).',
);

const translateIconSource = appIconSource.match(/case 'translate':[\s\S]*?case 'trending_up':/)?.[0] || '';
assert.match(
  translateIconSource,
  /<text[^>]*>文<\/text>/,
  'The Settings language icon should visibly use the Chinese 文 character.',
);
assert.match(
  translateIconSource,
  /<text[^>]*>A<\/text>/,
  'The Settings language icon should visibly use the Latin A character.',
);
assert.match(
  translateIconSource,
  /<text x="2" y="12"[^>]*fontSize="11"[^>]*>文<\/text>/,
  'The Chinese 文 glyph should be large enough to read at the Settings icon size.',
);
assert.match(
  translateIconSource,
  /<text x="14" y="20"[^>]*fontSize="8"[^>]*>A<\/text>/,
  'The A glyph should sit beside 文 while remaining visibly below it.',
);

console.log(
  `[PASS] AppIcon icon-name drift guardrail: ${used.size} names used, ${definedCases.size} defined.`
);
