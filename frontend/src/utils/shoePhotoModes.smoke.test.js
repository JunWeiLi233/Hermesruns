import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const shoesFilePath = path.join(__dirname, '..', 'pages', 'Shoes.jsx');
const shoesContent = fs.readFileSync(shoesFilePath, 'utf8');

const expectedKeys = [
  "t('shoes.img_manual_search_note')",
  "t('shoes.img_mode_manual')",
  "t('shoes.img_mode_auto')"
];

let allPassed = true;
for (const key of expectedKeys) {
  if (!shoesContent.includes(key)) {
    console.error(`[FAIL] Smoke test failed: Shoes.jsx is missing or malformed for expected key: ${key}`);
    allPassed = false;
  }
}

if (!allPassed) {
  throw new Error('Smoke test failed');
}

console.log('[PASS] Smoke test passed: Shoes.jsx contains all localized photo-mode labels.');
