import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(currentDir, "../RacesDetail.jsx"), 'utf8');
const coachHeading = source.match(/<div className="rd-v2-coach">[\s\S]*?<\/div>/)?.[0] || '';

assert.ok(coachHeading, 'Race detail should keep the coach insight heading.');
assert.doesNotMatch(coachHeading, /name="psychology"/, 'Race detail coach insight should not render the psychology icon.');
assert.match(coachHeading, /<CoachIdentityBadge coach=\{assignedCoach\} lang=\{lang\}/, 'Race detail should identify the assigned coach in the compact race card.');
assert.match(coachHeading, /<p>\{coachInsight\}<\/p>/, 'Race detail should preserve its data-driven coach insight.');

console.log('[PASS] Race detail coach icon removal guardrails passed.');
