#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(toolDir, '..');
const styleEntryPoints = [
  resolve(root, 'frontend/src/index.css'),
  resolve(root, 'frontend/src/styles/app.css'),
];
const outputPath = resolve(root, 'frontend/src/styles/style.generated.css');
const localImportPattern = /@import\s+(['"])(\.\/[^'"]+\.css)\1\s*;/g;
const legacyManifestPattern = /\/\* HERMES_LEGACY_STYLE_MANIFEST_START[\s\S]*?HERMES_LEGACY_STYLE_MANIFEST_END \*\//g;

export function buildActiveStyleBundle() {
  const entries = styleEntryPoints.map((entryPath) => ({
    entryPath,
    source: readFileSync(entryPath, 'utf8'),
  }));
  const imports = entries.flatMap(({ entryPath, source }) => [...source.matchAll(localImportPattern)].map((match) => ({
    entryPath,
    importPath: match[2],
  })));

  if (imports.length === 0) {
    throw new Error('The active CSS entry points do not contain local CSS imports.');
  }

  const sections = [
    '/*',
    ' * GENERATED FILE - DO NOT EDIT.',
    ' * Source order: frontend/src/index.css, app.css, landing.css, and their local CSS imports.',
    ' * Regenerate with: node .tools/generate-legacy-style-bundle.mjs',
    ' */',
  ];

  const seenImports = new Set();
  for (const { entryPath, importPath } of imports) {
    const absolutePath = resolve(dirname(entryPath), importPath);
    const relativePath = relative(root, absolutePath).split(sep).join('/');
    if (seenImports.has(relativePath)) continue;
    seenImports.add(relativePath);
    if (!existsSync(absolutePath)) {
      throw new Error(`Missing CSS import: ${relativePath}`);
    }
    sections.push(`/* Source: ${relativePath} */`, readFileSync(absolutePath, 'utf8').trimEnd());
  }

  for (const { entryPath, source } of entries) {
    const ownedCss = source
      .replace(legacyManifestPattern, '')
      .replace(/^@import\s+[^;]+;\s*$/gm, '')
      .replace(/^@config\s+[^;]+;\s*$/gm, '')
      .trim();
    const relativeEntryPath = relative(root, entryPath).split(sep).join('/');
    if (ownedCss) {
      sections.push(`/* Source: ${relativeEntryPath} (non-import rules) */`, ownedCss);
    }
  }

  return {
    css: `${sections.join('\n\n')}\n`,
    importCount: seenImports.size,
  };
}

export function writeActiveStyleBundle({ checkOnly = false } = {}) {
  const { css, importCount } = buildActiveStyleBundle();
  const current = existsSync(outputPath) ? readFileSync(outputPath, 'utf8') : '';

  if (checkOnly) {
    if (current !== css) {
      throw new Error('frontend/src/styles/style.generated.css is stale. Run: node .tools/generate-legacy-style-bundle.mjs');
    }
    console.log('[styles] Compatibility bundle is current.');
    return;
  }

  writeFileSync(outputPath, css, 'utf8');
  console.log(`[styles] Generated ${relative(root, outputPath)} from ${importCount} active CSS sources.`);
}

const invokedAsScript = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;

if (invokedAsScript) {
  try {
    writeActiveStyleBundle({ checkOnly: process.argv.includes('--check') });
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}
