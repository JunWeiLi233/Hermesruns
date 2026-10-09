import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const style = readFileSync(new URL('../../../styles/race-form-modal-v2.css', import.meta.url), 'utf8');
const page = readFileSync(new URL('../Races.jsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../../styles/app.css', import.meta.url), 'utf8');
function rule(selector) {
  const start = style.indexOf(`${selector} {`);
  assert.notEqual(start, -1, `Missing scoped rule: ${selector}`);
  return style.slice(start, style.indexOf('}', start));
}

assert.match(rule('#root .race-form-v2-section h4'), /font-style:\s*normal/, 'Section captions should not inherit the old italic heading treatment.');
assert.match(rule('#root .race-form-v2 :is(input[type="text"], input[type="number"], input[type="date"], textarea)'), /font-weight:\s*400/, 'Regular fields should not inherit bold label typography.');
assert.match(rule('#root .race-form-v2-card .modal-form'), /min-height:\s*0/);
assert.match(rule('#root .race-form-v2-card .modal-form'), /overflow:\s*hidden/);
assert.match(rule('#root .race-form-v2-body'), /overflow:\s*auto/);
assert.match(rule('#root .race-form-v2-footer'), /flex:\s*0 0 auto/);
assert.match(style, /100dvh - 32px/);
assert.match(style, /@media \(max-width: 480px\)/);
assert.match(style, /prefers-reduced-motion/);
assert.match(app.trimEnd(), /@import '\.\/race-form-modal-v2\.css';$/);
assert.match(page, /type="radio" name="race-registration-status"/);
assert.match(page, /inputMode="text" placeholder="3:25:00"/);
assert.match(page, /goalTimeSeconds: goal\.seconds \? Number\(goal\.seconds\) : null/);

for (const locale of ['en', 'zh-CN']) {
  const copy = readFileSync(new URL(`../../../i18n/locales/${locale}/pages.js`, import.meta.url), 'utf8');
  for (const key of ['add_sub', 'section_race', 'section_distance', 'days_to_go', 'preset_5k', 'preset_10k', 'preset_half', 'preset_full', 'preset_custom', 'goal', 'goal_hint', 'goal_invalid', 'pace', 'nyrr_hint', 'notes_placeholder']) {
    assert.match(copy, new RegExp(`"form_v2_${key}"\\s*:`));
  }
}
console.log('[PASS] Race form handoff keeps a scoped scrolling body, fixed actions, native controls, and matching translations.');
