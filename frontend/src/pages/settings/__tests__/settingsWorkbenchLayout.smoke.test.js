import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const layoutSource = readFileSync(path.join(here, "../../../components/SettingsAtlasLayout.jsx"), 'utf8');
const styleSource = [
  readFileSync(path.join(here, "../../../styles/style.generated.css"), 'utf8'),
  readFileSync(path.join(here, "../../../styles/_split/settings.css"), 'utf8'),
].join('\n');
const liquidGlassStyleSource = readFileSync(
  path.join(here, "../../../styles/all-pages-liquid-glass.css"),
  'utf8',
);
const pageSource = readFileSync(path.join(here, "../Settings.jsx"), 'utf8');

assert.match(
  layoutSource,
  /settings-control-canvas settings-atlas-canvas/,
  'Settings should mount inside the full-bleed atlas canvas instead of the old constrained shell.',
);

assert.match(
  layoutSource,
  /st-hero[\s\S]*st-main-grid[\s\S]*st-main-grid[\s\S]*st-services[\s\S]*st-bottom-grid/,
  'Settings atlas should group profile, preferences, setup, services, and wellness sections explicitly.',
);

assert.doesNotMatch(
  layoutSource,
  /settings\.danger_title/,
  'The right rail should not be introduced as a danger zone when it contains safe setup and digest controls.',
);

for (const handlerName of [
  'saveProfile',
  'setUnit',
  'setLang',
  'setTheme',
  'connectStrava',
  'disconnectStrava',
  'toggleDigest',
  'logout',
]) {
  assert.match(layoutSource, new RegExp(handlerName), `Settings redesign must preserve ${handlerName}.`);
}

assert.match(
  styleSource,
  /\.st-main-grid\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Desktop settings atlas should use balanced two-column cards instead of a loose three-column layout.',
);

assert.match(
  styleSource,
  /\.st-main-grid\s*{[\s\S]*?align-items:\s*stretch/,
  'Settings workbench rows should stretch both cards to a shared height for aligned edges.',
);

assert.match(
  styleSource,
  /\.st-main-grid\s*>\s*\.st-card\s*{[\s\S]*?height:\s*100%[\s\S]*?box-sizing:\s*border-box/,
  'Settings cards should fill their grid row without changing their content sizing.',
);

assert.match(
  styleSource,
  /\.settings-control-page \.runner-shell-canvas\.settings-control-canvas,[\s\S]*?\.settings-control-page \.settings-atlas-canvas\s*{[\s\S]*?width:\s*calc\(100% - clamp\(28px,\s*3\.2vw,\s*64px\)\)[\s\S]*?max-width:\s*none !important/,
  'Settings canvas should override the runner-shell max-width and use the available screen width.',
);

assert.match(
  styleSource,
  /\.st-services-grid\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Connected services should use a two-column desktop grid instead of leaving empty right-side space.',
);

assert.ok(
  styleSource.lastIndexOf('Settings full-bleed control room pass') > styleSource.lastIndexOf('Runner shell navigation redesign'),
  'The Settings full-bleed override should come after broad runner-shell navigation overrides.',
);

assert.match(
  styleSource,
  /\.st-bottom-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  'The lower Settings area should avoid an empty right rail when only wellness content is present.',
);

assert.match(
  styleSource,
  /@media \(max-width:\s*960px\)\s*{[\s\S]*?\.st-main-grid,[\s\S]*?\.st-services-grid,[\s\S]*?\.st-bottom-grid\s*{[\s\S]*?grid-template-columns:\s*1fr/,
  'The Settings atlas should collapse cleanly before desktop columns become cramped.',
);

assert.match(
  styleSource,
  /\.st-service-meta\s*{[\s\S]*?grid-template-columns:\s*1fr\s+1fr/,
  'Service metadata must stay in readable cards for localized labels.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.settings-control-page \.st-card :is\(\s*\.st-card-head,\s*\.st-card-head > div,\s*\.st-kicker,\s*\.st-card-title\s*\)\s*{[\s\S]*?background:\s*transparent\s*!important[\s\S]*?background-image:\s*none\s*!important/,
  'Settings card headings should stay on the parent card surface instead of showing glass-paper strips behind the words.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page\.settings-control-page \.st-services :is\(\s*\.st-card-head,\s*\.st-card-head > div,\s*\.st-kicker,\s*\.st-card-title\s*\)\s*{[\s\S]*?background:\s*transparent\s*!important[\s\S]*?background-image:\s*none\s*!important/,
  'The connected-services heading should stay on the outer surface instead of showing a panel strip behind 数据服务.',
);

const settingsCardSweepIndex = liquidGlassStyleSource.lastIndexOf('[class*="-card"]');
const settingsHeadingResetIndex = liquidGlassStyleSource.lastIndexOf(
  '.runner-shell-page.settings-control-page .st-card :is(',
);
assert.ok(
  settingsHeadingResetIndex > settingsCardSweepIndex,
  'The Settings heading reset must remain after the shared liquid-glass card sweep.',
);

const settingsServicesHeadingResetIndex = liquidGlassStyleSource.lastIndexOf(
  '.runner-shell-page.settings-control-page .st-services :is(',
);
assert.ok(
  settingsServicesHeadingResetIndex > settingsCardSweepIndex,
  'The connected-services heading reset must remain after the shared liquid-glass card sweep.',
);

assert.match(
  liquidGlassStyleSource,
  /\.runner-shell-page \.runner-shell-canvas::before\s*\{[\s\S]*?pointer-events:\s*none;/,
  'The runner canvas grid must stay decorative and never intercept control clicks.',
);

assert.match(
  styleSource,
  /\.settings-control-page \.settings-atlas-canvas > \*\s*\{[\s\S]*?position:\s*relative;[\s\S]*?z-index:\s*1;/,
  'Settings controls must remain above decorative glass layers so the workbench stays usable.',
);

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

assert.match(
  layoutSource,
  /id="st-profile-avatar-input"[\s\S]*?accept="image\/png,image\/jpeg"[\s\S]*?onChange=\{handleAvatarSelection\}/,
  'The Settings hero must expose an image-only profile-photo picker.',
);

assert.match(
  layoutSource,
  /function handleAvatarSelection[\s\S]*?onAvatarUpload\?\.\(file\)[\s\S]*?htmlFor="st-profile-avatar-input"/,
  'The visible avatar control must forward the selected file to the upload handler.',
);

console.log('[PASS] Settings workbench layout guardrails passed.');
