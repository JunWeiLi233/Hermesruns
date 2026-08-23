import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => readFileSync(path.join(here, '..', relativePath), 'utf8');
const navSource = read('components/AnalysisSubpageNav.jsx');
const iconSource = read('components/AppIcon.jsx');

assert.match(
  navSource,
  /key: 'coach-insight', route: '\/analysis\/coach-insight', labelKey: 'analysis\.coach_detail_title', icon: 'coach'/,
  'The Coach Insight rail item should use the dedicated coach glyph.',
);

const coachCase = iconSource.match(/case 'coach':[\s\S]*?case '([^']+)':/);
assert.ok(coachCase, 'AppIcon should define a dedicated coach glyph before the next icon case.');
const coachGlyph = coachCase[0];

assert.match(coachGlyph, /<path d="M9\.55 7\.25h5\.5" \/>/, 'Coach glyph should include the reference horizontal visor line.');
assert.match(
  coachGlyph,
  /className="app-icon-coach-silhouette"[\s\S]*strokeWidth="0\.6"/,
  'Coach glyph should use a dedicated reference silhouette with the correct light line weight.',
);
assert.match(
  coachGlyph,
  /<path d="M12\.3 4\.65[\s\S]*?V7\.77c0-1\.72-1\.4-3\.12-3\.12-3\.12Z" \/>/,
  'Coach glyph should include the reference rounded head silhouette.',
);
assert.match(
  coachGlyph,
  /<path d="m9\.6 7\.55\.7 1\.2h4l\.7-1\.2" \/>/,
  'Coach glyph should include the reference visor band beneath the horizontal line.',
);
assert.match(
  coachGlyph,
  /<path d="M10\.7 12\.7v1\.3l1\.55 2" \/>[\s\S]*<path d="M13\.9 12\.7v1\.3l-1\.55 2" \/>/,
  'Coach glyph should include the reference collar and tie lines.',
);
assert.match(
  coachGlyph,
  /<path d="M8\.8 15\.6v3\.75" \/>[\s\S]*<path d="M15\.8 15\.6v3\.75" \/>/,
  'Coach glyph should include the reference jacket front seams.',
);
assert.match(
  coachGlyph,
  /<path d="M5\.2 18\.55h3\.6" \/>[\s\S]*<path d="M15\.8 18\.55h3\.5" \/>/,
  'Coach glyph should include the reference jacket hem details.',
);

console.log('[PASS] Coach Insight uses a dedicated, legible coach glyph.');
