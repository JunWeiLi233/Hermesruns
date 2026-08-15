import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const settingsSource = readFileSync(path.join(here, 'Settings.jsx'), 'utf8');
const layoutSource = readFileSync(path.join(here, '..', 'components', 'SettingsAtlasLayout.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '..', 'styles', '_split', 'settings.css'), 'utf8');
const englishCopy = readFileSync(path.join(here, '..', 'i18n', 'locales', 'en', 'pages.js'), 'utf8');
const chineseCopy = readFileSync(path.join(here, '..', 'i18n', 'locales', 'zh-CN', 'pages.js'), 'utf8');

assert.match(
  settingsSource,
  /\/api\/profile\/me\/name[\s\S]*?method:\s*'PATCH'/,
  'Settings should use the backend profile-name endpoint.',
);

assert.match(
  settingsSource,
  /new FormData\(\)[\s\S]*?\/api\/profile\/me\/avatar[\s\S]*?method:\s*'PUT'/,
  'Settings should upload the selected profile image to the authenticated avatar endpoint.',
);

assert.match(
  settingsSource,
  /\/api\/profile\/me\/avatar[\s\S]*?method:\s*'DELETE'/,
  'Settings should allow a runner to remove a saved profile image.',
);

assert.match(
  layoutSource,
  /id="st-profile-avatar-input"[\s\S]*?accept="image\/png,image\/jpeg"[\s\S]*?onChange=\{handleAvatarSelection\}/,
  'The settings hero should offer an accessible PNG/JPEG profile-image picker.',
);

assert.match(
  layoutSource,
  /function handleAvatarSelection\(event\)[\s\S]*?onAvatarUpload\?\.\(file\)/,
  'The image picker should pass a selected file to the avatar upload handler.',
);

assert.match(
  layoutSource,
  /avatarUrl \? <img src=\{avatarUrl\} alt="" \/> : initials/,
  'The hero should immediately render the saved profile image and retain initials as a fallback.',
);

assert.match(
  styleSource,
  /\.st-hero-avatar--editable img\s*\{[\s\S]*?object-fit:\s*cover;/,
  'Profile images should crop safely within the round settings avatar.',
);

for (const key of [
  'avatar_title',
  'avatar_hint',
  'avatar_upload',
  'avatar_change',
  'avatar_remove',
  'avatar_uploading',
  'avatar_saved',
  'avatar_removed',
  'avatar_invalid',
  'avatar_error',
]) {
  const pattern = new RegExp(`"${key}":`);
  assert.match(englishCopy, pattern, `English settings copy should include ${key}.`);
  assert.match(chineseCopy, pattern, `Chinese settings copy should include ${key}.`);
}

console.log('[PASS] Profile image and display-name editing guardrails passed.');
