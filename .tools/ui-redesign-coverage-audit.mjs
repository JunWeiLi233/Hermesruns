#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..');

function readArg(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  if (index === -1 || index + 1 >= process.argv.length) return fallback;
  return process.argv[index + 1];
}

function resolveInputPath(value) {
  if (!value) return '';
  return path.isAbsolute(value) ? value : path.join(repoRoot, value);
}

function readMaybe(relativePath) {
  const fullPath = path.join(repoRoot, relativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

function readMaybeInput(value, fallbackRelativePath) {
  const fullPath = resolveInputPath(value) || path.join(repoRoot, fallbackRelativePath);
  return existsSync(fullPath) ? readFileSync(fullPath, 'utf8') : '';
}

function readMatchingFiles(relativeDir, pattern) {
  const dir = path.join(repoRoot, relativeDir);
  if (!existsSync(dir)) return '';

  return readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}

function readMatchingInputFiles(value, fallbackRelativeDir, pattern) {
  const dir = resolveInputPath(value) || path.join(repoRoot, fallbackRelativeDir);
  if (!existsSync(dir)) return '';

  return readdirSync(dir)
    .filter((name) => pattern.test(name))
    .map((name) => readFileSync(path.join(dir, name), 'utf8'))
    .join('\n');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function routePatternSource(route) {
  const segments = route
    .split('/')
    .map((segment) => {
      if (!segment) return '';
      if (segment === '*') return '[^\\s`"|)]*';
      if (segment.startsWith(':')) return '[^/\\s`"|)]+';
      return escapeRegExp(segment);
    });

  return segments.join('/');
}

function buildRoutePatterns(route) {
  const routes = [route];
  if (route.endsWith('/*')) routes.push(route.slice(0, -2));

  return routes.flatMap((candidate) => {
    const pattern = routePatternSource(candidate);
    const exactBacktick = new RegExp(`\`${pattern}\``);
    const fullUrl = new RegExp(`https?:\\/\\/[^\\s\`"'|)]*${pattern}(?=$|[?#\\s\`"'|)])`);

    if (candidate === '/') {
      return [
        exactBacktick,
        fullUrl,
      ];
    }

    return [
      exactBacktick,
      fullUrl,
      new RegExp(`(^|[\\s|([])${pattern}($|[\\s|),.;\\]])`),
    ];
  });
}

function hasEvidence(source, route, component, options = {}) {
  if (!source) return false;

  const routePatterns = buildRoutePatterns(route);
  const routeMatches = routePatterns.some((pattern) => pattern.test(source));
  if (routeMatches) return true;

  return options.allowComponentFallback === true && component
    ? new RegExp(`\\b${escapeRegExp(component)}\\b`).test(source)
    : false;
}

function status(value) {
  return value ? 'Yes' : 'No';
}

function extractRoutes(appSource) {
  const routes = [];
  const routeRegex = /<Route\s+path="([^"]+)"\s+element=\{([\s\S]*?)\}\s*\/>/g;
  let match;

  while ((match = routeRegex.exec(appSource)) !== null) {
    const route = match[1];
    const element = match[2];
    const isRedirect = /<Navigate\b/.test(element);
    const tagNames = [...element.matchAll(/<([A-Z][A-Za-z0-9]*)\b/g)]
      .map((tagMatch) => tagMatch[1])
      .filter((tag) => !['UserOnlyRoute', 'AdminOnlyRoute', 'Navigate'].includes(tag));
    const component = tagNames.at(-1) || (isRedirect ? 'Navigate' : 'Unknown');

    routes.push({
      route,
      component,
      isRedirect,
    });
  }

  return routes;
}

const outPath = path.resolve(readArg('out', '.ai-sync/UI_REDESIGN_COVERAGE.md'));
const appSource = readMaybeInput(readArg('app'), 'frontend/src/App.jsx');
const designVersions = readMaybeInput(readArg('design'), 'DESIGN_VERSIONS.md');
const contextLedger = readMaybeInput(readArg('context'), '.ai-sync/CONTEXT_LEDGER.md');
const customerGate = readMatchingInputFiles(readArg('customer-gate-dir'), '.ai-sync', /^CUSTOMER_PLAYTEST_GATE.*\.md$/);
const customerGateJson = readMatchingInputFiles(readArg('customer-gate-json-dir'), '.ai-sync', /customer-gate.*\.json$/);
const routeRows = extractRoutes(appSource)
  .filter(({ route }) => route !== '*')
  .map((entry) => {
    const evidenceSource = `${designVersions}\n${contextLedger}`;
    const browserSource = `${customerGate}\n${customerGateJson}`;
    const designEvidence = !entry.isRedirect && hasEvidence(evidenceSource, entry.route, entry.component, { allowComponentFallback: true });
    const customerGateEvidence = !entry.isRedirect && hasEvidence(customerGate, entry.route, entry.component);
    const browserEvidence = !entry.isRedirect && hasEvidence(browserSource, entry.route, entry.component);

    return {
      ...entry,
      designEvidence,
      customerGateEvidence,
      browserEvidence,
    };
  });

const evidenceGaps = routeRows.filter((entry) => (
  !entry.isRedirect && (!entry.designEvidence || !entry.customerGateEvidence || !entry.browserEvidence)
));

const nextRoute = evidenceGaps.find((entry) => !entry.customerGateEvidence)
  || evidenceGaps.find((entry) => !entry.browserEvidence)
  || evidenceGaps[0]
  || null;

const table = routeRows
  .map((entry) => [
    `\`${entry.route}\``,
    entry.component,
    entry.isRedirect ? 'Redirect' : status(entry.designEvidence),
    entry.isRedirect ? 'Redirect' : status(entry.customerGateEvidence),
    entry.isRedirect ? 'Redirect' : status(entry.browserEvidence),
  ])
  .map((cells) => `| ${cells.join(' | ')} |`)
  .join('\n');

const gapList = evidenceGaps.length === 0
  ? '- none'
  : evidenceGaps
    .map((entry) => {
      const missing = [
        !entry.designEvidence ? 'design evidence' : null,
        !entry.customerGateEvidence ? 'customer gate' : null,
        !entry.browserEvidence ? 'browser evidence' : null,
      ].filter(Boolean).join(', ');
      return `- \`${entry.route}\` (${entry.component}): missing ${missing}`;
    })
    .join('\n');

const checklist = [
  ['Use `design-taste-frontend`', designVersions.includes('design-taste') || contextLedger.includes('design-taste')],
  ['Use `imagegen-frontend-web`', `${designVersions}\n${contextLedger}`.includes('imagegen-frontend-web')],
  ['Use `browser:browser` or record verified fallback', customerGate.includes('Browser plugin') || customerGate.includes('Browser evidence') || customerGate.includes('browser:browser')],
  ['Redesign all pages', evidenceGaps.length === 0],
  ['Simple navigation for amateur and elite runners', customerGate.includes('Amateur runner') && customerGate.includes('Elite runner')],
  ['Entertaining daily-use quality', customerGate.includes('Daily-use enjoyment')],
  ['Customer gate at round end', existsSync(path.join(repoRoot, '.tools/customer-playtest-gate.mjs')) && customerGate.includes('Customer Playtest Gate')],
];

const checklistRows = checklist
  .map(([requirement, covered]) => `| ${requirement} | ${covered ? 'Covered' : 'Gap'} |`)
  .join('\n');

const content = `# UI Redesign Coverage Audit

Generated: ${new Date().toISOString()}
Status: ${evidenceGaps.length === 0 ? 'Complete candidate' : 'Not complete'}

This audit maps the broad all-pages redesign objective to concrete route evidence. It is intentionally conservative: a route is not counted as fully covered until it has design evidence, Customer gate evidence, and browser evidence or an explicitly recorded browser fallback.

## Prompt-to-artifact checklist

| Requirement | Evidence status |
| --- | --- |
${checklistRows}

Named skill requirements tracked here: \`design-taste-frontend\`, \`imagegen-frontend-web\`, and \`browser:browser\`.

## Route inventory

| Route | Component | Design evidence | Customer gate evidence | Browser evidence |
| --- | --- | --- | --- | --- |
${table}

## Evidence gaps

${gapList}

## Next concrete route

${nextRoute
    ? `Next route should be \`${nextRoute.route}\` (${nextRoute.component}) because it is missing ${[
      !nextRoute.designEvidence ? 'design evidence' : null,
      !nextRoute.customerGateEvidence ? 'customer gate evidence' : null,
      !nextRoute.browserEvidence ? 'browser evidence' : null,
    ].filter(Boolean).join(', ')}.`
    : 'No route gaps detected by this audit.'}

## Customer gate

Use \`.tools/customer-playtest-gate.mjs\` at each round end. Fill the artifact with real customer feedback from an amateur-runner and elite-runner pass. If the Browser plugin is unavailable, record the exact \`browser:browser\` blockage and the verified fallback used.
`;

mkdirSync(path.dirname(outPath), { recursive: true });
writeFileSync(outPath, content, 'utf8');
console.log(`Wrote ${outPath}`);
