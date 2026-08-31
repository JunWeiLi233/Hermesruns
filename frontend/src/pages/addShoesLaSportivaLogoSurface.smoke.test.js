import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const pageSource = readFileSync(path.join(here, 'AddShoes.jsx'), 'utf8');
const logoSource = readFileSync(path.join(here, '../components/ShoeBrandLogo.jsx'), 'utf8');
const styleSource = readFileSync(path.join(here, '../styles/add-shoes-profile-alignment.css'), 'utf8');

assert.match(
  logoSource,
  /import removeBackground, \{ bgRemovedCache \} from ['"]\.\.\/utils\/removeBackground['"];[\s\S]*?\['lasportiva', 'skechers', 'kiprun'\]\.includes\(getShoeBrandAssetKey\(brand\)\)[\s\S]*?removeBackground\(src\)/,
  'La Sportiva, Skechers, and KIPRUN should use the project background-removal algorithm on the logo image itself.',
);
assert.match(
  pageSource,
  /className="add-shoes-brand-tile"/,
  'The featured brand card should keep its existing tile surface.',
);
assert.match(
  pageSource,
  /className="add-shoes-model-art"/,
  'The model card should keep its existing artwork surface.',
);
assert.match(
  styleSource,
  /#root \.add-shoes-profile-redesign \.add-shoes-brand-tile,[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.74\) !important;/,
  'The La Sportiva card should retain the normal tile background.',
);
assert.doesNotMatch(pageSource, /brandLogoSurfaceClassName|is-backgroundless/);
assert.doesNotMatch(styleSource, /is-backgroundless/);

console.log('[PASS] La Sportiva, Skechers, and KIPRUN logo background removal guard passed.');
