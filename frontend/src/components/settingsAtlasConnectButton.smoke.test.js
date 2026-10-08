import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, 'SettingsAtlasLayout.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/_split/settings.css'), 'utf8');

assert.match(
  layoutSource,
  /className=\{`settings-atlas-service-action\$\{stravaConnected \? '' : ' is-connect'\}`\}/,
  'The Strava service action should keep the scoped is-connect variant hook so the compact button styling stays isolated.',
);

const actionRows = [...layoutSource.matchAll(/<div className="st-service-actions">\s*(<button[\s\S]*?<\/button>)\s*<\/div>/g)];
assert.equal(actionRows.length, 2, 'Both providers must have a dedicated action row outside the summary column.');
assert.match(actionRows[0][1], /onClick=\{stravaConnected \? disconnectStrava : connectStrava\}/);
assert.match(actionRows[0][1], /disabled=\{stravaLinking\}/);
assert.match(actionRows[1][1], /className="st-service-btn is-connect"[\s\S]*onClick=\{onOpenGarminImport\}/);

const stylesheet = postcss.parse(styleSource);
function assertRule(selector, expected, media) {
  const rules = [];
  stylesheet.walkRules(selector, (rule) => {
    if ((rule.parent.type === 'atrule' ? rule.parent.params : undefined) === media) rules.push(rule);
  });
  const rule = rules.at(-1);
  assert.ok(rule, `Missing ${selector}${media ? ` inside ${media}` : ''}.`);
  const declarations = Object.fromEntries(rule.nodes.filter((node) => node.type === 'decl').map(({ prop, value }) => [prop, value]));
  for (const [property, value] of Object.entries(expected)) {
    assert.equal(declarations[property], value, `${selector} must keep ${property}: ${value}${media ? ` inside ${media}` : ''}.`);
  }
}

assertRule('.st-service-card', { display: 'flex', 'flex-direction': 'column' });
assertRule('.settings-atlas-canvas .st-service-actions', {
  display: 'flex', 'justify-content': 'flex-end', 'margin-top': 'auto',
});
const actionsSelector = '.settings-atlas-canvas .st-service-actions :is(.settings-atlas-service-action, .st-service-btn)';
assertRule(actionsSelector, {
  display: 'inline-flex', width: 'auto', 'min-width': '0', 'min-height': '44px',
  flex: '0 1 auto', 'align-self': 'center', 'white-space': 'normal', 'overflow-wrap': 'anywhere',
});
assertRule('.st-service-head', { display: 'flex', 'align-items': 'flex-start' });
assertRule('.settings-atlas-canvas .st-service-head .st-service-info', { 'min-width': '0' });
assertRule('.settings-atlas-canvas .st-service-info > span', {
  display: 'block', 'overflow-wrap': 'anywhere', 'line-height': '1.45',
});
assertRule('.settings-atlas-canvas .st-services-grid', {
  width: 'min(100%, 960px)', 'grid-template-columns': 'repeat(2, minmax(0, 1fr))', margin: '20px auto 0',
});
assertRule('.settings-atlas-canvas .st-services-grid', { 'grid-template-columns': 'minmax(0, 1fr)' }, '(max-width: 960px)');

// At phone widths the separate action row fills the card, including long
// translated labels, while the icon and summary retain their own grid columns.
const mobile = '(max-width: 640px)';
assertRule('.settings-atlas-canvas .st-service-card', { 'min-width': '0', 'max-width': '100%' }, mobile);
assertRule('.settings-atlas-canvas .st-service-head', {
  display: 'grid', 'grid-template-columns': '40px minmax(0, 1fr)', 'min-width': '0', 'max-width': '100%',
}, mobile);
assertRule(actionsSelector, {
  width: '100%', 'min-width': '0', 'min-height': '44px', 'max-width': '100%',
  'align-self': 'stretch', 'box-sizing': 'border-box', 'white-space': 'normal',
  'overflow-wrap': 'anywhere', 'word-break': 'normal',
}, mobile);
assertRule('.settings-atlas-canvas .st-service-info :is(strong, span)', {
  'max-width': '100%', 'white-space': 'normal', 'overflow-wrap': 'anywhere', 'word-break': 'normal',
}, mobile);

console.log('[PASS] Settings atlas connect button compact sizing guard passed.');
