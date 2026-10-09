import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, '../../../components/SettingsAtlasLayout.jsx'), 'utf8');
const pageSource = readFileSync(path.join(here, '../Settings.jsx'), 'utf8');
const styles = readFileSync(path.join(here, '../../../styles/settings-v2.css'), 'utf8');
const appStyles = readFileSync(path.join(here, '../../../styles/app.css'), 'utf8');
assert.match(layoutSource, /settings-control-canvas settings-atlas-canvas st-v2/, 'Settings should mount the grouped layout within its existing shell.');
for (const group of ['profile', 'preferences', 'connections', 'notifications', 'activity', 'account']) {
  assert.match(layoutSource, new RegExp(`id="st-v2-${group}"`), `Settings should retain its ${group} group.`);
  assert.ok(layoutSource.includes(`hidden={activeSection !== '${group}'}`), `Settings should hide the inactive ${group} group.`);
}
for (const handler of ['saveProfile', 'setUnit', 'setLang', 'setTheme', 'connectStrava', 'disconnectStrava', 'toggleDigest', 'logout']) {
  assert.match(layoutSource, new RegExp(handler), `Settings must preserve ${handler}.`);
}
assert.match(styles, /\.st-v2-layout\s*\{[^}]*grid-template-columns:\s*260px minmax\(0, 1fr\)/, 'Desktop should pair the section index with a settings column that fills the available width.');
assert.match(styles, /\.st-v2-index\s*\{[^}]*position:\s*sticky/, 'Desktop section index should stay visible while scrolling.');
assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?\.st-v2-layout\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)/, 'Settings should fit smaller screens in one column.');
assert.match(layoutSource, /role="tablist"[\s\S]*?role="tab"[\s\S]*?aria-selected=\{activeSection === id\}/, 'The section selector should expose the selected tab.');
assert.match(styles, /\.st-v2-group\[hidden\]\s*\{\s*display:\s*none\s*!important/, 'Inactive sections must stay hidden despite the group flex layout.');
assert.match(styles, /@media \(max-width: 1100px\)[\s\S]*?\.st-v2-nav\s*\{[^}]*overflow-x:\s*auto/, 'Mobile users should still be able to select every settings section.');
assert.match(layoutSource, /id="st-profile-avatar-input"[\s\S]*?accept="image\/png,image\/jpeg"[\s\S]*?onChange=\{handleAvatarSelection\}/, 'The profile group should retain the image-only picker.');
assert.match(layoutSource, /onAvatarUpload\?\.\(file\)/, 'Avatar selections should reach the authenticated upload handler.');
assert.match(layoutSource, /avatarInputRef\.current\?\.click\(\)/, 'The visible upload button should open the file picker.');
assert.ok(appStyles.indexOf("@import './settings-v2.css';") > appStyles.indexOf("@import './dark-mode-final-fixes.css';"), 'The settings design should load after existing theme and surface rules.');
assert.match(
  pageSource,
  /settings-load-error[\s\S]*?components\.retry[\s\S]*?stitch_back_to_profile/,
  'Settings failures must expose a retry and a route back to the profile instead of a dead-end message.',
);

assert.match(
  pageSource,
  /const \{ isAuthenticated, authHydrated, logout \} = useAuth\(\);[\s\S]*?if \(!authHydrated\) return undefined;/,
  'Settings must wait for the authenticated session to hydrate before redirecting or requesting profile data.',
);

assert.match(
  pageSource,
  /SETTINGS_REQUEST_TIMEOUT_MS[\s\S]*?new AbortController\(\)[\s\S]*?settingsController\.abort\(\)/,
  'Settings profile loading must abort after a bounded timeout and on unmount instead of hanging forever.',
);

assert.match(
  pageSource,
  /\/api\/profile\/me\/name[\s\S]*?method:\s*'PATCH'/,
  'Profile names must use the backend display-name route and HTTP method.',
);

assert.match(
  pageSource,
  /new FormData\(\)[\s\S]*?\/api\/profile\/me\/avatar[\s\S]*?method:\s*'PUT'/,
  'Settings must upload profile photos through the authenticated avatar endpoint.',
);


console.log('[PASS] Settings grouped layout and data contracts passed.');
