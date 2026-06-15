import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const srcRoot = path.resolve(here, '..');

function read(relativePath) {
  return readFileSync(path.join(srcRoot, relativePath), 'utf8');
}

const profileSource = read('pages/ProfileDashboard.jsx');
const enSource = read('i18n/locales/en/pages.js');
const zhSource = read('i18n/locales/zh-CN/pages.js');
const profileStyle = read('styles/_split/profile.css');
const lightStyle = read('styles/_split/light-theme-overrides.css');
const bundledStyle = read('styles/style.css');

for (const key of [
  'dashboard_empty_title',
  'dashboard_empty_copy',
  'dashboard_empty_steps_label',
  'dashboard_empty_step_sync',
  'dashboard_empty_step_measure',
  'dashboard_empty_step_unlock',
  'dashboard_empty_trust',
  'dashboard_empty_cta_strava',
  'dashboard_empty_cta_files',
]) {
  const profileTranslationCall = ['t', "('", 'profile.', key, "')"].join('');
  assert(
    profileSource.includes(profileTranslationCall),
    `Profile empty state should render ${key}.`,
  );
  assert(enSource.includes(`"${key}"`), `English locale should define ${key}.`);
  assert(zhSource.includes(`"${key}"`), `Chinese locale should define ${key}.`);
}

assert(
  profileSource.includes('aria-labelledby="profile-empty-title"')
    && profileSource.includes('id="profile-empty-title"'),
  'Profile empty state should expose an accessible title relationship.',
);

assert(
  profileSource.includes("navigate('/profile?linking=strava')")
    && profileSource.includes("navigate('/settings/import-data')")
    && profileSource.includes('upload_file')
    && !profileSource.includes("t('profile.dashboard_empty_cta_today')"),
  'Profile empty state should offer Strava and file import actions, not a Today Run CTA before data exists.',
);

assert(
  profileSource.includes('<ol className="runner-dashboard-empty-steps"')
    && profileSource.includes('<p className="runner-dashboard-empty-trust">'),
  'Profile empty state should explain the data-unlock flow and avoid sample-data ambiguity.',
);

assert(
  /\.runner-dashboard-empty-steps\s*\{[\s\S]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/.test(profileStyle)
    && /\.runner-dashboard-empty-trust\s*\{[\s\S]*font-size:\s*0\.88rem/.test(profileStyle)
    && /@media \(max-width:\s*700px\)\s*\{[\s\S]*\.runner-dashboard-empty-steps\s*\{[\s\S]*grid-template-columns:\s*1fr/.test(profileStyle),
  'Profile split CSS should style the empty-state unlock steps and collapse them on mobile.',
);

assert(
  /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) \.runner-dashboard-empty-steps li\s*\{/.test(lightStyle)
    && /body:is\(\.theme-light,\s*\.theme-high-contrast-light\) \.runner-dashboard-empty-trust\s*\{/.test(lightStyle),
  'Profile light-theme overrides should cover the new empty-state step and trust elements.',
);

assert(
  bundledStyle.includes('.runner-dashboard-empty-steps')
    && bundledStyle.includes('.runner-dashboard-empty-trust')
    && bundledStyle.includes("navigate('/settings/import-data')") === false,
  'Bundled CSS should include the new empty-state styles without leaking route strings into CSS.',
);

console.log('[PASS] Profile empty-state actions guard passed.');
