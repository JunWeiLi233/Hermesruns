import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(currentDir, "../RacesDetail.jsx"), 'utf8');
const coachHeading = source.match(/<div className="race-detail-card-head">[\s\S]*?<\/div>/)?.[0] || '';

assert.ok(coachHeading, 'Race detail should keep the coach insight heading.');
assert.doesNotMatch(coachHeading, /name="psychology"/, 'Race detail coach insight should not render the psychology icon.');
assert.match(coachHeading, /detail_coach_title/, 'Race detail coach insight should keep its localized heading text.');

console.log('[PASS] Race detail coach icon removal guardrails passed.');
