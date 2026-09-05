import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const assetsRoot = path.join(here, "../../assets");
const publicImagesRoot = path.join(here, "../../../public/images");
const shoeBrandLogoSource = readFileSync(path.join(here, "../../components/ShoeBrandLogo.jsx"), 'utf8');
const insightSource = readFileSync(path.join(here, "../../pages/analysis/AnalysisInsightDetail.jsx"), 'utf8');
const landingSource = readFileSync(path.join(here, "../../pages/landing/Landing.jsx"), 'utf8');
const predictionSource = readFileSync(path.join(here, "../../pages/prediction/PredictionDetail.jsx"), 'utf8');
const racesSource = readFileSync(path.join(here, "../../pages/races/Races.jsx"), 'utf8');
const profileDashboardSource = readFileSync(path.join(here, "../../pages/profile/ProfileDashboard.jsx"), 'utf8');
const racesDetailSource = readFileSync(path.join(here, "../../pages/races/RacesDetail.jsx"), 'utf8');
const worldRaceCatalogSource = readFileSync(path.join(here, "../../data/worldRaceCatalog.json"), 'utf8');

function collectFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? collectFiles(entryPath) : [entryPath];
  });
}

const localRasterFiles = collectFiles(assetsRoot).filter((filePath) => /\.(?:png|jpe?g)$/i.test(filePath));
assert.deepEqual(
  localRasterFiles,
  [],
  'Displayed local raster assets should use WebP; legacy PNG/JPEG files must not remain in frontend/src/assets.',
);
const publicRasterFiles = collectFiles(publicImagesRoot).filter((filePath) => /\.(?:png|jpe?g)$/i.test(filePath));
assert.deepEqual(
  publicRasterFiles,
  [],
  'Displayed public raster assets should use WebP; legacy PNG/JPEG files must not remain in frontend/public/images.',
);

for (const [source, label] of [
  [shoeBrandLogoSource, 'shoe brand logos'],
  [insightSource, 'analysis insight media'],
  [landingSource, 'landing media'],
  [predictionSource, 'prediction hero media'],
  [racesSource, 'races media'],
  [profileDashboardSource, 'profile dashboard media'],
  [worldRaceCatalogSource, 'world race catalog media'],
]) {
  assert.doesNotMatch(source, /\.(?:png|jpe?g)(?:['"`]|\b)/i, `${label} should not import a legacy PNG/JPEG asset.`);
}
assert.match(
  racesDetailSource,
  /const DEFAULT_HERO_IMAGE = ['"]\/images\/races\/race-detail-default-hero\.webp['"];/,
  'Race detail should use the compressed default hero image.',
);

for (const assetPath of [
  "../../assets/generated/injury-knee-anatomy.webp",
  "../../assets/generated/load-balance-track.webp",
  "../../assets/generated/landing-world-map-political-dotted.webp",
  "../../assets/generated/prediction-5k-hero.webp",
  "../../assets/generated/prediction-10k-hero.webp",
  "../../../public/images/races/boston-marathon-hero.webp",
  "../../../public/images/races/dashboard-hero.webp",
  "../../../public/images/races/discovery-offroad.webp",
  "../../../public/images/races/race-center-hero.webp",
  "../../../public/images/races/race-detail-default-hero.webp",
]) {
  assert.ok(existsSync(path.join(here, assetPath)), `Optimized WebP asset is missing: ${assetPath}`);
}

for (const removedAsset of [
  'generated/recent-runs-hero-overlay.jpg',
  'generated/run-gait-v2/evo-sl-side-master.png',
  'generated/prediction-5k-hero-1200.webp',
  'generated/prediction-10k-hero-1600.webp',
  'muscle-training/anatomy-neon-selector.png',
  'brand-logos/puma.png',
  'brand-logos/altra.svg',
  'brand-logos/anta.svg',
  'brand-logos/bmai.svg',
  'brand-logos/brooks.svg',
  'brand-logos/dayan.svg',
  'brand-logos/do-win.svg',
  'brand-logos/inov-8.svg',
  'brand-logos/kiprun-reference.webp',
  'brand-logos/lining.svg',
  'brand-logos/macondo.svg',
  'brand-logos/merrell.svg',
  'brand-logos/mizuno.svg',
  'brand-logos/norda.svg',
  'brand-logos/peak.svg',
  'brand-logos/qiaodan.svg',
  'brand-logos/reebok.svg',
  'brand-logos/salomon.svg',
  'brand-logos/skechers.svg',
  'brand-logos/topo-athletic.svg',
  'brand-logos/under-armour.svg',
  'brand-logos/volanti.svg',
  'brand-logos/on.svg',
]) {
  assert.equal(existsSync(path.join(assetsRoot, removedAsset)), false, `Unused legacy image should stay removed: ${removedAsset}`);
}

console.log('[PASS] Static image optimization contract passed.');
