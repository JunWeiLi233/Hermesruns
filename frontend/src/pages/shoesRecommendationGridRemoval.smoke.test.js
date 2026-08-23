import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = fs.readFileSync(path.join(here, 'Shoes.jsx'), 'utf8').replace(/\r\n/g, '\n');

if (/shoe-rotation-signal/.test(source)) {
  throw new Error('The Shoes page should not render the removed performance insight grid.');
}

if (/renderRotationSignal|isRotationSignalCollapsed/.test(source)) {
  throw new Error('The removed performance insight grid should not leave behind render or collapse state.');
}

if (/performanceFallback|recentRotationEmpty|rotationSignal/.test(source)) {
  throw new Error('The removed performance insight grid should not retain grid-only derived state.');
}

console.log('shoesRecommendationGridRemoval smoke test passed');
