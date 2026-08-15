#!/usr/bin/env node
/**
 * check-translations.mjs
 *
 * Translation parity checker for Hermes.
 * Run before any commit that touches frontend UI copy.
 *
 * Usage:
 *   node .tools/check-translations.mjs             — summary + missing keys
 *   node .tools/check-translations.mjs --full      — include all missing key names
 *   node .tools/check-translations.mjs --hardcoded — also scan for locale bypasses in JSX
 *   node .tools/check-translations.mjs --all       — all checks
 *
 * Exit codes:
 *   0  — clean (no gaps, no bypasses)
 *   1  — gaps or bypasses found
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname, relative } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const TRANSLATIONS_PATH = join(ROOT, 'frontend/src/i18n/translations.js');
const LOCALE_REGISTRY_PATH = join(ROOT, 'frontend/src/i18n/localeRegistry.js');
const PAGES_DIR = join(ROOT, 'frontend/src/pages');
const COMPONENTS_DIR = join(ROOT, 'frontend/src/components');
const CONTEXTS_DIR = join(ROOT, 'frontend/src/contexts');

const args = process.argv.slice(2);
const FULL = args.includes('--full') || args.includes('--all');
const HARDCODED = args.includes('--hardcoded') || args.includes('--all');

// ─── Load translations ────────────────────────────────────────────────────────

const { default: t } = await import(pathToFileURL(TRANSLATIONS_PATH).href);
const { DEFAULT_LOCALE, SUPPORTED_LOCALES } = await import(pathToFileURL(LOCALE_REGISTRY_PATH).href);

const translationLocaleIds = Object.keys(t);
const missingBundles = SUPPORTED_LOCALES.filter(locale => !translationLocaleIds.includes(locale));
const extraBundles = translationLocaleIds.filter(locale => !SUPPORTED_LOCALES.includes(locale));

// ─── Key analysis ─────────────────────────────────────────────────────────────

function flatKeys(obj, prefix = '') {
  const out = [];
  for (const k of Object.keys(obj)) {
    const full = prefix ? `${prefix}.${k}` : k;
    if (typeof obj[k] === 'object' && obj[k] !== null) {
      out.push(...flatKeys(obj[k], full));
    } else {
      out.push(full);
    }
  }
  return out;
}

const zhKeys = new Set(flatKeys(t['zh-CN']));
const enKeys = new Set(flatKeys(t['en']));

const missingInEn = [...zhKeys].filter(k => !enKeys.has(k));
const missingInZh = [...enKeys].filter(k => !zhKeys.has(k));

// Section-level structural check
const zhSections = Object.keys(t['zh-CN']);
const enSections = Object.keys(t['en']);
const sectionsMissingInEn = zhSections.filter(s => !enSections.includes(s));
const sectionsMissingInZh = enSections.filter(s => !zhSections.includes(s));

function getValue(obj, dottedKey) {
  return dottedKey.split('.').reduce((current, part) => current && current[part], obj);
}

// ─── Hardcoded bypass scan ────────────────────────────────────────────────────

/**
 * Collects frontend source files recursively under dir.
 */
function collectFiles(dir) {
  const files = [];
  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules') {
        files.push(...collectFiles(full));
      } else if (
        entry.isFile()
        && ['.jsx', '.js', '.tsx', '.ts'].includes(extname(entry.name))
        && !/\.(?:smoke\.)?test\.[jt]sx?$/.test(entry.name)
      ) {
        files.push(full);
      }
    }
  } catch { /* dir missing */ }
  return files;
}

const bypassResults = [];
const missingUsageResults = [];

const TRANSLATION_CALL_PATTERNS = [
  /\bt\(\s*['"]([^'"]+)['"]/g,
  /\bi18n\.t\(\s*['"]([^'"]+)['"]/g,
];

function collectTranslationUsages(content) {
  const usages = [];
  for (const pattern of TRANSLATION_CALL_PATTERNS) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      usages.push({
        key: match[1],
        index: match.index,
      });
    }
  }
  return usages;
}

const sourceFilesForUsageScan = [
  ...collectFiles(PAGES_DIR),
  ...collectFiles(COMPONENTS_DIR),
  ...collectFiles(CONTEXTS_DIR),
];

for (const file of sourceFilesForUsageScan) {
  const content = readFileSync(file, 'utf8');
  const relPath = relative(ROOT, file).replace(/\\/g, '/');
  const lines = content.split('\n');
  const missingHits = [];

  for (const usage of collectTranslationUsages(content)) {
    const missingIn = SUPPORTED_LOCALES.filter(
      locale => typeof getValue(t[locale], usage.key) !== 'string',
    );
    if (missingIn.length === 0) continue;

    const line = content.slice(0, usage.index).split(/\r?\n/).length;
    missingHits.push({
      line,
      key: usage.key,
      missingIn,
      excerpt: (lines[line - 1] || '').trim().slice(0, 140),
    });
  }

  if (missingHits.length) {
    const deduped = [];
    const seen = new Set();
    for (const hit of missingHits) {
      const id = `${hit.line}|${hit.key}|${hit.missingIn.join(',')}`;
      if (seen.has(id)) continue;
      seen.add(id);
      deduped.push(hit);
    }
    missingUsageResults.push({ file: relPath, hits: deduped });
  }
}

if (HARDCODED) {
  const jsxFiles = [
    ...collectFiles(PAGES_DIR),
    ...collectFiles(COMPONENTS_DIR),
  ];

  for (const file of jsxFiles) {
    const content = readFileSync(file, 'utf8');
    const relPath = file.replace(ROOT + '/', '').replace(ROOT + '\\', '');
    const lines = content.split('\n');
    const hits = [];

    lines.forEach((line, i) => {
      const lineNo = i + 1;
      const stripped = line.trim();

      // Skip comments and imports
      if (stripped.startsWith('//') || stripped.startsWith('*') || stripped.startsWith('/*')) return;
      if (stripped.startsWith('import ')) return;

      // Skip static data-object patterns: labelZh, zh:, labelEn, en:, etc.
      // These are legitimate pre-translation data structures, not UI copy bypasses.
      if (/(?:labelZh|labelEn|zh:|en:)\s*['"]/.test(line)) return;
      // Skip Intl locale format specifier lines (e.g. 'zh-CN' vs 'en-US' for formatting)
      if (/['"]zh-CN['"]\s*:\s*['"]en-US['"]|['"]en-US['"]|toLocaleDateString|Intl\./.test(line)) return;
      // Skip className/active-class conditions that use lang but no copy strings
      if (/className=\{.*lang.*\}/.test(line) && !/['"]\s*[^\s'"\d][^\s'"]{3,}['"]/.test(line)) return;

      // Pattern 1: inline locale ternary with real copy strings (> 3 chars, not a format specifier)
      // e.g.  lang === 'zh-CN' ? '当前没有失败任务' : 'No failed jobs right now'
      const ternaryMatch = /lang\s*===\s*['"]zh-CN['"]\s*\?\s*['"]([^'"]{3,})['"]\s*:\s*['"]([^'"]{3,})['"]/.exec(line);
      if (ternaryMatch) {
        // Skip if either branch looks like a locale tag or format specifier
        const left = ternaryMatch[1], right = ternaryMatch[2];
        if (!/^[a-z]{2}-[A-Z]{2}$/.test(left) && !/^[a-z]{2}-[A-Z]{2}$/.test(right)) {
          hits.push({ line: lineNo, type: 'BYPASS', pattern: 'inline-locale-ternary', excerpt: stripped.slice(0, 100) });
        }
      }

      // Pattern 2: Chinese characters in a JSX return or JSX expression context
      // (not inside a t() call, not in a data object, not a comment)
      // Only flag lines that look like they are rendering text, not defining data.
      if (/[\u4e00-\u9fff]/.test(line) && !/\bt\(/.test(line)) {
        // Skip data-definition lines: lines with key: value patterns (JSON-like)
        const isDataLine = /^\s*(?:\w+:|['"]\w+['"]\s*:)/.test(stripped);
        // Skip lines inside a data array or object (heuristic: line has { ... } with zh/en sibling)
        const isArrayDataEntry = /\{[^}]*(?:zh|en|label|name)[^}]*\}/.test(line);
        if (!isDataLine && !isArrayDataEntry) {
          hits.push({ line: lineNo, type: 'WARN', pattern: 'hardcoded-chinese-in-jsx', excerpt: stripped.slice(0, 100) });
        }
      }
    });

    if (hits.length) {
      bypassResults.push({ file: relPath, hits });
    }
  }
}

// ─── Report ───────────────────────────────────────────────────────────────────

let exitCode = 0;
const sep = '─'.repeat(60);

console.log('\n' + sep);
console.log('  Hermes Translation Parity Check');
console.log(sep);

if (missingBundles.length || extraBundles.length) {
  exitCode = 1;
  console.log('\n  ✗ Locale registry and translation bundles differ:');
  if (missingBundles.length) console.log(`    Missing bundles: ${missingBundles.join(', ')}`);
  if (extraBundles.length) console.log(`    Unregistered bundles: ${extraBundles.join(', ')}`);
} else {
  console.log(`\n  ✓ Registry bundles: ${SUPPORTED_LOCALES.join(', ')} (fallback: ${DEFAULT_LOCALE})`);
}

// Key counts
console.log(`\n  zh-CN leaf keys : ${zhKeys.size}`);
console.log(`  en    leaf keys : ${enKeys.size}`);
console.log(`  gap             : ${Math.abs(zhKeys.size - enKeys.size)}`);

// Section structure
if (sectionsMissingInEn.length || sectionsMissingInZh.length) {
  exitCode = 1;
  console.log('\n  ⚠ Section structure mismatch:');
  if (sectionsMissingInEn.length) console.log(`    Sections in zh-CN missing from en: ${sectionsMissingInEn.join(', ')}`);
  if (sectionsMissingInZh.length) console.log(`    Sections in en missing from zh-CN: ${sectionsMissingInZh.join(', ')}`);
} else {
  console.log('\n  ✓ Both locales share the same section structure');
}

// Missing keys
if (missingInEn.length === 0 && missingInZh.length === 0) {
  console.log('  ✓ No missing keys — zh-CN and en are in parity');
} else {
  exitCode = 1;
  if (missingInEn.length) {
    console.log(`\n  ✗ ${missingInEn.length} key(s) present in zh-CN but missing from en:`);
    const show = FULL ? missingInEn : missingInEn.slice(0, 10);
    for (const k of show) console.log(`      ${k}`);
    if (!FULL && missingInEn.length > 10) console.log(`      ... and ${missingInEn.length - 10} more (run --full to see all)`);
  }
  if (missingInZh.length) {
    console.log(`\n  ✗ ${missingInZh.length} key(s) present in en but missing from zh-CN:`);
    const show = FULL ? missingInZh : missingInZh.slice(0, 10);
    for (const k of show) console.log(`      ${k}`);
    if (!FULL && missingInZh.length > 10) console.log(`      ... and ${missingInZh.length - 10} more (run --full to see all)`);
  }
}

if (missingUsageResults.length) {
  exitCode = 1;
  console.log(`\n  ✗ MISSING USAGE — ${missingUsageResults.length} file(s) call t() with undefined translation keys:`);
  for (const result of missingUsageResults) {
    console.log(`\n    ${result.file}`);
    for (const hit of result.hits.slice(0, 6)) {
      console.log(`      line ${hit.line}: ${hit.key} (missing in ${hit.missingIn.join(', ')})`);
      if (hit.excerpt) console.log(`        ${hit.excerpt}`);
    }
    if (result.hits.length > 6) console.log(`      ... and ${result.hits.length - 6} more`);
  }
} else {
  console.log('  ✓ No undefined translation-key usages found in JSX');
}

// Hardcoded bypass results
if (HARDCODED) {
  const bypassFiles = bypassResults.filter(r => r.hits.some(h => h.type === 'BYPASS'));
  const warnFiles   = bypassResults.filter(r => r.hits.every(h => h.type === 'WARN') && !bypassFiles.includes(r));

  if (bypassResults.length === 0) {
    console.log('  ✓ No locale bypasses found in JSX');
  } else {
    if (bypassFiles.length) {
      exitCode = 1;
      console.log(`\n  ✗ BYPASS — ${bypassFiles.length} file(s) use inline locale ternaries instead of t() — should be moved to translations.js:`);
      for (const r of bypassFiles) {
        const bypasses = r.hits.filter(h => h.type === 'BYPASS');
        console.log(`\n    ${r.file}`);
        for (const h of bypasses.slice(0, 4)) {
          console.log(`      line ${h.line}: ${h.excerpt}`);
        }
        if (bypasses.length > 4) console.log(`      ... and ${bypasses.length - 4} more`);
      }
    }
    if (warnFiles.length) {
      console.log(`\n  ⚠ ADVISORY — ${warnFiles.length} file(s) contain Chinese in non-data JSX context (review manually):`);
      for (const r of warnFiles) {
        console.log(`    ${r.file} — ${r.hits.length} occurrence(s)`);
      }
      console.log('    (These may be legitimate data arrays or temporarily acceptable — agent should review)');
    }
  }
}

// Determine exit code
// Exit 0 = all clean
// Exit 1 = key parity gap (BLOCKER — must fix before commit)
// Exit 2 = bypass ternaries found but parity is clean (DEBT — track as follow-up, do not block commit)
let finalExit = 0;
if (missingBundles.length || extraBundles.length || missingInEn.length || missingInZh.length || sectionsMissingInEn.length || sectionsMissingInZh.length) {
  finalExit = 1;
} else if (missingUsageResults.length) {
  finalExit = 1;
} else if (HARDCODED && bypassResults.some(r => r.hits.some(h => h.type === 'BYPASS'))) {
  finalExit = 2;
}

console.log('\n' + sep);
if (finalExit === 0) {
  console.log('  ✓ PASS — translations are in parity\n');
} else if (finalExit === 1) {
  console.log('  ✗ FAIL (exit 1) — key parity gap blocks commit\n');
  console.log('  Fix:');
  console.log('    1. Open frontend/src/i18n/translations.js');
  console.log('    2. Add the missing key in the other locale block or remove the dead t() usage');
  console.log('    3. Use coach-voice copy — specific, direct, not hollow');
  console.log('    4. Re-run: node .tools/check-translations.mjs\n');
} else if (finalExit === 2) {
  console.log('  ⚠ DEBT (exit 2) — parity is clean but bypasses exist\n');
  console.log('  These inline ternaries should be moved to translations.js over time.');
  console.log('  They do NOT block the current commit — add a Tech Debt task instead.\n');
  console.log('  Fastest fix per bypass:');
  console.log('    lang === \'zh-CN\' ? \'text\' : \'text\'');
  console.log('    → add keys to translations.js, replace with t(\'section.key\')\n');
}
console.log(sep + '\n');

process.exit(finalExit);
