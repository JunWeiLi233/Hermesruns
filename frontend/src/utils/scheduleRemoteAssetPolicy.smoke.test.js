import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const scheduleStyles = fs.readFileSync(path.join(root, 'styles', 'style.css'), 'utf8');
const coachIdentity = fs.readFileSync(path.join(root, 'utils', 'coachIdentity.js'), 'utf8');
const coachBadge = fs.readFileSync(path.join(root, 'components', 'CoachIdentityBadge.jsx'), 'utf8');

assert.equal(
  scheduleStyles.includes('images.unsplash.com/photo-1476480862126-209bfaa8edc8'),
  false,
  'Schedule page should not depend on the remote Unsplash next-session background.',
);

assert.equal(
  scheduleStyles.includes('images.unsplash.com/photo-1486218119243-13883505764c'),
  false,
  'Schedule page should not depend on the remote Unsplash peak-day background.',
);

assert.equal(
  coachIdentity.includes('i.pravatar.cc'),
  false,
  'Coach roster should not depend on remote pravatar avatars.',
);

assert.equal(
  coachBadge.includes('coach-identity-avatar--fallback'),
  true,
  'Coach badge should keep a local fallback avatar rendering path.',
);

console.log('[PASS] Schedule remote asset policy smoke test passed.');
