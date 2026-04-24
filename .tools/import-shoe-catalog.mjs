#!/usr/bin/env node

import fs from 'node:fs/promises';
import path from 'node:path';

const COMMON_BRANDS = [
  'Nike',
  'Adidas',
  'ASICS',
  'New Balance',
  'Saucony',
  'HOKA',
  'Brooks',
  'PUMA',
  'On',
  'Mizuno',
  'Li-Ning',
  '361',
  'Xtep',
  'Anta',
];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const part = argv[i];
    if (!part.startsWith('--')) continue;
    const key = part.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
      continue;
    }
    args[key] = next;
    i += 1;
  }
  return args;
}

function normalizeWhitespace(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

function decodeHtml(value) {
  return normalizeWhitespace(
    (value || '')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
  );
}

function extractOfficialName(html) {
  const patterns = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']twitter:title["'][^>]+content=["']([^"']+)["']/i,
    /"name"\s*:\s*"([^"]+)"/i,
    /<title>([^<]+)<\/title>/i,
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return '';
}

function inferBrand(explicitBrand, officialName) {
  if (explicitBrand) return normalizeWhitespace(explicitBrand);
  const lowerName = officialName.toLowerCase();
  return COMMON_BRANDS.find((brand) => lowerName.startsWith(brand.toLowerCase())) || '';
}

function extractModelName(brand, officialName) {
  const genericSuffixes = [
    /\broad running shoes\b/i,
    /\brunning shoes\b/i,
    /\bmen'?s shoes\b/i,
    /\bwomen'?s shoes\b/i,
    /\bshoe\b/i,
  ];
  let value = officialName;
  if (brand) {
    const pattern = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
    value = value.replace(pattern, '');
  }
  for (const suffix of genericSuffixes) {
    value = value.replace(suffix, '');
  }
  value = value.replace(/\s+[|.-]\s+.*/g, '');
  value = normalizeWhitespace(value);
  if (!value) return officialName;
  const pattern = new RegExp(`^${brand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  return normalizeWhitespace(value.replace(pattern, ''));
}

async function readSource(url) {
  if (/^https?:\/\//i.test(url)) {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch ${url}: ${response.status}`);
    }
    return response.text();
  }
  const resolved = path.resolve(url);
  return fs.readFile(resolved, 'utf8');
}

async function createCatalogItem(apiBase, authToken, payload) {
  const response = await fetch(`${apiBase.replace(/\/$/, '')}/api/shoe-catalog/admin/models`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authToken,
    },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Catalog import failed for ${payload.brand} ${payload.model}: ${response.status} ${detail}`);
  }
  return response.json();
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const configPath = args.config;
  if (!configPath) {
    throw new Error('Usage: node .tools/import-shoe-catalog.mjs --config .tools/shoe-catalog-sources.example.json [--api-base http://localhost:8080] [--auth-token Bearer ...] [--dry-run]');
  }

  const rawConfig = await fs.readFile(path.resolve(configPath), 'utf8');
  const parsed = JSON.parse(rawConfig);
  const entries = Array.isArray(parsed) ? parsed : parsed.entries;
  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error('Config must contain a non-empty array or { "entries": [...] }.');
  }

  const apiBase = args['api-base'] || process.env.HERMES_API_BASE || 'http://localhost:8080';
  const authToken = args['auth-token'] || process.env.HERMES_ADMIN_TOKEN || '';
  const dryRun = Boolean(args['dry-run']);

  if (!dryRun && !authToken) {
    throw new Error('Missing admin auth token. Pass --auth-token or set HERMES_ADMIN_TOKEN, or use --dry-run.');
  }

  for (const entry of entries) {
    const html = await readSource(entry.url);
    const officialName = normalizeWhitespace(entry.officialName || extractOfficialName(html));
    if (!officialName) {
      throw new Error(`Could not extract shoe name from ${entry.url}`);
    }

    const brand = inferBrand(entry.brand, officialName);
    const model = normalizeWhitespace(entry.model || extractModelName(brand, officialName));
    if (!brand || !model) {
      throw new Error(`Could not infer brand/model for ${entry.url}. Add "brand" or "model" in the config entry.`);
    }

    const payload = {
      brand,
      model,
      modelZh: normalizeWhitespace(entry.modelZh || ''),
      modelEn: normalizeWhitespace(entry.modelEn || model),
      type: normalizeWhitespace(entry.type || 'daily').toLowerCase(),
    };

    if (dryRun) {
      console.log(JSON.stringify({ url: entry.url, officialName, payload }, null, 2));
      continue;
    }

    const result = await createCatalogItem(apiBase, authToken, payload);
    console.log(`Imported ${result.brand} ${result.model}`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
