#!/usr/bin/env node

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(toolDir, '..');
const indexCssPath = resolve(root, 'frontend/src/index.css');
const outputPath = resolve(root, 'frontend/src/styles/style.generated.css');
const localImportPattern = /@import\s+(['"])(\.\/[^'"]+\.css)\1\s*;/g;

export function buildActiveStyleBundle() {
  const indexCss = readFileSync(indexCssPath, 'utf8');
  const imports = [...indexCss.matchAll(localImportPattern)].map((match) => match[2]);

  if (imports.length === 0) {
    throw new Error('frontend/src/index.css does not contain local CSS imports.');
  }

  const sections = [
    '/*',
    ' * GENERATED FILE - DO NOT EDIT.',
    ' * Source order: frontend/src/index.css and its local CSS imports.',
    ' * Regenerate with: node .tools/generate-legacy-style-bundle.mjs',
    ' */',
  ];

  for (const importPath of imports) {
    const absolutePath = resolve(dirname(indexCssPath), importPath);
    const relativePath = relative(root, absolutePath).split(sep).join('/');
    if (!existsSync(absolutePath)) {
      throw new Error(`Missing CSS import: ${relativePath}`);
    }
    sections.push(`/* Source: ${relativePath} */`, readFileSync(absolutePath, 'utf8').trimEnd());
  }

  const indexOwnedCss = indexCss
    .replace(/^@import\s+[^;]+;\s*$/gm, '')
    .replace(/^@config\s+[^;]+;\s*$/gm, '')
    .trim();

  if (indexOwnedCss) {
    sections.push('/* Source: frontend/src/index.css (non-import rules) */', indexOwnedCss);
  }

  return {
    css: `${sections.join('\n\n')}\n`,
    importCount: imports.length,
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
