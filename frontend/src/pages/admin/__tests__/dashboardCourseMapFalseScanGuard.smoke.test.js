import { readDashboardSources } from '../readDashboardSources.mjs';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readDashboardSources();
const previewSource = readFileSync(path.join(here, "../../../components/AdminCourseMapPreview.jsx"), 'utf8');

assert.match(
  dashboardSource,
  /previewTab === "pending" \? pendingCourseMapPreview : liveCourseMapPreview/,
  'Dashboard should select the pending or live snapshot using the active preview tab.',
);

assert.match(
  dashboardSource,
  /preview=\{preview\}[\s\S]*allowImageFallback=\{false\}/,
  'Neither preview tab should present an unaligned source image as an aligned course map.',
);

assert.match(
  previewSource,
  /allowImageFallback\s*=\s*true/,
  'AdminCourseMapPreview should expose an explicit allowImageFallback prop so workspaces can opt out of raw-image fallback.',
);

assert.match(
  previewSource,
  /if\s*\(allowImageFallback\s*&&\s*canRenderImage\)/,
  'AdminCourseMapPreview should only render the raw image fallback when the caller explicitly allows it.',
);

assert.match(
  previewSource,
  /const previewSummary = useMemo\(\(\) => resolvePreviewSummary\(preview\), \[preview\]\);[\s\S]*const fallbackLabel = previewSummary \|\| \(preview && unalignedLabel \? unalignedLabel : emptyLabel\);/,
  'AdminCourseMapPreview should show the backend rejection summary inside the preview box before falling back to the generic unaligned label.',
);

assert.match(
  previewSource,
  /const showPreviewSummary = Boolean\(previewSummary\) && !hasAlignedRoute;/,
  'AdminCourseMapPreview should detect unaligned previews that still have a backend rejection summary.',
);

assert.match(
  previewSource,
  /showPreviewSummary \? \(\s*<div className="admin-review-preview__summary-overlay">[\s\S]*previewSummary[\s\S]*<\/div>\s*\) : null/,
  'AdminCourseMapPreview should overlay the backend rejection summary on top of fallback preview stages.',
);

assert.match(
  dashboardSource,
  /const courseMapAlignmentReady = hasAlignedCourseMapPreview\(pendingCourseMapPreview \|\| liveCourseMapPreview\) && \(\(pendingCourseMapConfidence \?\? liveCourseMapConfidence \?\? 0\) >= 90\);/,
  'Dashboard should require a real aligned preview before showing the AI alignment verified verdict.',
);

console.log('[PASS] Dashboard false-scan guardrails passed.');
