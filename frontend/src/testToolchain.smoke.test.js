import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(path.join(here, '../package.json'), 'utf8'));
const vitestConfig = readFileSync(path.join(here, '../vitest.config.js'), 'utf8');
const setupSource = readFileSync(path.join(here, 'test/setup.js'), 'utf8');
assert.equal(packageJson.scripts.codex, undefined, 'Do not advertise an npm command for the absent machine-local Codex generator.');
assert.equal(existsSync(path.join(here, 'components/ui/SectionCard.jsx')), false, 'The unused SectionCard wrapper should not return without a runtime consumer.');

for (const removedDependency of ['@xyflow/react', 'leaflet.heat', 'react-leaflet', 'zustand']) {
  assert.equal(
    packageJson.dependencies?.[removedDependency],
    undefined,
    `${removedDependency} should not return without a verified production import.`,
  );
}

for (const developmentDependency of [
  'typescript',
  'vitest',
  '@testing-library/react',
  '@testing-library/jest-dom',
  '@testing-library/user-event',
  'jsdom',
]) {
  assert.ok(
    packageJson.devDependencies?.[developmentDependency],
    `${developmentDependency} should remain development-only.`,
  );
}

assert.match(packageJson.scripts.typecheck, /tsc --noEmit/);
assert.match(packageJson.scripts['test:unit'], /vitest run/);
assert.match(packageJson.scripts.test, /typecheck.*test:unit.*test:contracts/);
assert.match(vitestConfig, /environment:\s*'jsdom'/);
assert.match(vitestConfig, /src\/\*\*\/\*\.vitest\.\{js,jsx,ts,tsx\}/);
assert.match(setupSource, /@testing-library\/jest-dom\/vitest/);

console.log('[PASS] TypeScript and Vitest toolchain policy passed.');
