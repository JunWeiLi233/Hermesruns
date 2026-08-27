import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const dashboardSource = readFileSync(path.join(here, './Dashboard.jsx'), 'utf8');
const monitoringCss = readFileSync(path.join(here, '../styles/admin-monitoring-dashboard.css'), 'utf8');
const modalStart = dashboardSource.indexOf('isOpen={catalogImagePickerOpen}');
const modalEnd = dashboardSource.indexOf('</Modal>', modalStart);
assert.ok(modalStart >= 0 && modalEnd > modalStart, 'Catalog image modal should remain mounted.');

const catalogImageModal = dashboardSource.slice(modalStart, modalEnd);

assert.match(catalogImageModal, /catalog-image-picker/);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.catalog-image-picker \.img-picker-current-actions\s*\{[\s\S]*?display:\s*none\s*!important/,
  'Catalog image preview should hide publish and clear-preview actions.',
);
assert.doesNotMatch(
  catalogImageModal,
  /img-picker-url-input|catalog_image_stage/,
  'The admin catalog image modal should not render the manual URL input or its orphaned staging action.',
);
assert.match(catalogImageModal, /catalog_image_upload/);
assert.match(catalogImageModal, /catalog_image_search/);
assert.match(catalogImageModal, /catalogImageCandidates\.map/);

assert.match(
  catalogImageModal,
  /className="btn-secondary img-picker-search-btn"/,
  'Catalog image search should use the same outlined button language as upload.',
);
assert.match(
  monitoringCss,
  /\.admin-dashboard-modal-card \.catalog-image-picker \.img-picker-search-btn\s*\{[\s\S]*?border:\s*1px solid #e1e3e3 !important[\s\S]*?border-radius:\s*10px !important[\s\S]*?clip-path:\s*none !important/,
  'Catalog image search should keep the upload-style neutral rounded border.',
);

console.log('[PASS] Catalog image modal keeps preview controls and outlined search styling.');
