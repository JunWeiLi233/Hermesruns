import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { readDashboardSources } from '../readDashboardSources.mjs';

// The dedicated admin console owns these controls after the reference redesign.
const source = readDashboardSources();
const styles = readFileSync(new URL('../../../styles/admin-reference.css', import.meta.url), 'utf8');
assert.ok(styles.includes('.admin-reference'), 'Admin console styling remains scoped to its route.');
for (const marker of [
  "admin-ref-review-rail",
  "ConsoleSearch",
  "ConsoleSegments",
  "setCourseMapQuery",
  "page: 0"
]) assert.ok(source.includes(marker), `Admin console must retain ${marker}`);
