#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeBin = process.execPath;
const proofPort = String(process.env.TERRITORY_PROOF_PORT || '8092');
const browserProofMode = process.env.TERRITORY_PROOF_BROWSER === 'playwright' ? 'playwright' : 'browser';
const browserProofTool = browserProofMode === 'playwright'
  ? '.tools/auto-hermes-playwright.mjs'
  : '.tools/auto-hermes-browser.mjs';

function argValue(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function markersForUrl(url) {
  try {
    const parsed = new URL(url);
    const host = parsed.host;
    const markers = new Set([host]);
    if (parsed.hostname === '127.0.0.1') markers.add(`localhost${parsed.port ? `:${parsed.port}` : ''}`);
    if (parsed.hostname === 'localhost') markers.add(`127.0.0.1${parsed.port ? `:${parsed.port}` : ''}`);
    return Array.from(markers).join(',');
  } catch {
    return `127.0.0.1:${proofPort},localhost:${proofPort}`;
  }
}

const fixtureProofUrl = `http://127.0.0.1:${proofPort}/territory`;
const proofUrl = argValue('--url', fixtureProofUrl);
const proofMode = process.argv.includes('--url') ? 'real-runtime-url' : 'fixture-server';
const markers = argValue('--markers', markersForUrl(proofUrl));
const setViewArg = argValue('--set-view', proofMode === 'fixture-server' ? '40.7368,-73.8235,17' : null);
const screenshotPath = argValue('--screenshot', 'task-images/territory-runtime-border-contract-proof.jpg');
const referencePath = resolveRootPath(argValue('--reference', 'territory-reference-weight-closeup.jpg'));
const clipArg = argValue('--clip');
const authToken = argValue('--auth-token');
const authEmail = argValue('--auth-email', 'strava+140971747@hermes.local');
const authRole = argValue('--auth-role', 'USER');

const helperSelectors = [
  '.terr-land-mask-contour-glow',
  '.terr-land-mask-contour-falloff',
  '.terr-land-mask-border',
  '.terr-land-mask-border-halo',
  '.terr-land-mask-ground-shadow',
  '.terr-land-mask-highlight',
  '.terr-land-mask-region-floor',
  '.terr-land-mask-region-exact',
  '.terr-land-mask-resolved-underlay',
  '.terr-land-mask-coverage',
  '.terr-land-mask-conflict-seam',
  '.terr-land-mask-shared-boundary',
];

function waitForUrl(url, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const attempt = () => {
      const request = http.get(url, (response) => {
        response.resume();
        if (response.statusCode && response.statusCode >= 200 && response.statusCode < 500) {
          resolve();
          return;
        }
        if (Date.now() > deadline) {
          reject(new Error(`Timed out waiting for ${url}: status ${response.statusCode}`));
          return;
        }
        setTimeout(attempt, 250);
      });
      request.on('error', (error) => {
        if (Date.now() > deadline) {
          reject(error);
          return;
        }
        setTimeout(attempt, 250);
      });
    };
    attempt();
  });
}

function runBrowser(args) {
  const result = spawnSync(nodeBin, [browserProofTool, ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 45_000,
  });
  if (result.status !== 0) {
    throw new Error(`${browserProofTool} failed: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse browser output: ${result.stdout}`);
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function measureImageSubstrate(imageFile) {
  const script = `
import json
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert('RGB')
neutral = []
for r, g, b in img.getdata():
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    if sat < 0.22 or mx < 95:
        neutral.append((0.2126 * r) + (0.7152 * g) + (0.0722 * b))

if not neutral:
    raise SystemExit('no neutral substrate pixels found')

print(json.dumps({
    'neutralAverageLuma': round(sum(neutral) / len(neutral), 2),
    'neutralPixelCount': len(neutral),
    'totalPixelCount': img.width * img.height,
}))
`;
  const result = spawnSync('python', ['-c', script, imageFile], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) {
    throw new Error(`Could not measure substrate luminance for ${imageFile}: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse substrate luminance output for ${imageFile}: ${result.stdout}`);
  }
}

function compareSubstrateToReference(screenshotFile) {
  const generated = measureImageSubstrate(screenshotFile);
  const reference = measureImageSubstrate(referencePath);
  return {
    generated,
    reference,
    neutralAverageLumaDelta: Math.round((generated.neutralAverageLuma - reference.neutralAverageLuma) * 100) / 100,
  };
}

function measureImageTerritoryColor(imageFile) {
  const script = `
import json
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert('RGB')
colored = []
edge_like = []
total = img.width * img.height

for r, g, b in img.getdata():
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    if sat >= 0.18 and 35 <= luma <= 180:
        colored.append((sat, luma))
    if sat >= 0.5 and 55 <= luma <= 210:
        edge_like.append((sat, luma))

def stats(items):
    if not items:
        return {
            'pixelRatio': 0,
            'averageSat': 0,
            'averageLuma': 0,
        }
    return {
        'pixelRatio': round(len(items) / total, 4),
        'averageSat': round(sum(item[0] for item in items) / len(items), 3),
        'averageLuma': round(sum(item[1] for item in items) / len(items), 2),
    }

print(json.dumps({
    'colored': stats(colored),
    'edgeLike': stats(edge_like),
}))
`;
  const result = spawnSync('python', ['-c', script, imageFile], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) {
    throw new Error(`Could not measure territory color for ${imageFile}: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse territory color output for ${imageFile}: ${result.stdout}`);
  }
}

function compareTerritoryColorToReference(screenshotFile) {
  const generated = measureImageTerritoryColor(screenshotFile);
  const reference = measureImageTerritoryColor(referencePath);
  return {
    generated,
    reference,
    edgeLikePixelRatioDelta: Math.round((generated.edgeLike.pixelRatio - reference.edgeLike.pixelRatio) * 10000) / 10000,
    edgeLikeAverageLumaDelta: Math.round((generated.edgeLike.averageLuma - reference.edgeLike.averageLuma) * 100) / 100,
    edgeLikeAverageSatDelta: Math.round((generated.edgeLike.averageSat - reference.edgeLike.averageSat) * 1000) / 1000,
    coloredPixelRatioDelta: Math.round((generated.colored.pixelRatio - reference.colored.pixelRatio) * 10000) / 10000,
    coloredAverageLumaDelta: Math.round((generated.colored.averageLuma - reference.colored.averageLuma) * 100) / 100,
    coloredAverageSatDelta: Math.round((generated.colored.averageSat - reference.colored.averageSat) * 1000) / 1000,
  };
}

function measureImageTerritorySeams(imageFile) {
  const script = `
import json
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert('RGB')
width, height = img.size
pixels = img.load()
total = width * height
colored = 0
dark = 0
between_territory_dark = 0
radius = 8
directions = [((1, 0), (-1, 0)), ((0, 1), (0, -1)), ((1, 1), (-1, -1)), ((1, -1), (-1, 1))]

def color_stats(rgb):
    r, g, b = rgb
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    return sat, luma

def has_colored_neighbor(x, y, dx, dy):
    for step in range(1, radius + 1):
        nx = x + (dx * step)
        ny = y + (dy * step)
        if nx < 0 or ny < 0 or nx >= width or ny >= height:
            break
        sat, luma = color_stats(pixels[nx, ny])
        if sat >= 0.22 and 45 <= luma <= 190:
            return True
    return False

for y in range(height):
    for x in range(width):
        sat, luma = color_stats(pixels[x, y])
        if sat >= 0.18 and 35 <= luma <= 180:
            colored += 1
        if sat < 0.24 and luma < 70:
            dark += 1
            if any(has_colored_neighbor(x, y, *a) and has_colored_neighbor(x, y, *b) for a, b in directions):
                between_territory_dark += 1

print(json.dumps({
    'coloredRatio': round(colored / total, 4),
    'darkRatio': round(dark / total, 4),
    'betweenTerritoryDarkRatio': round(between_territory_dark / total, 5),
    'betweenTerritoryDarkPerColored': round(between_territory_dark / max(1, colored), 5),
}))
`;
  const result = spawnSync('python', ['-c', script, imageFile], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) {
    throw new Error(`Could not measure territory seam gaps for ${imageFile}: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse territory seam gap output for ${imageFile}: ${result.stdout}`);
  }
}

function compareTerritorySeamsToReference(screenshotFile) {
  const generated = measureImageTerritorySeams(screenshotFile);
  const reference = measureImageTerritorySeams(referencePath);
  return {
    generated,
    reference,
    betweenTerritoryDarkPerColoredDelta: Math.round(
      (generated.betweenTerritoryDarkPerColored - reference.betweenTerritoryDarkPerColored) * 100000,
    ) / 100000,
  };
}

function measureImageEdgeAngularity(imageFile) {
  const script = `
import json
import math
import sys
from PIL import Image

img = Image.open(sys.argv[1]).convert('RGB')
width, height = img.size
pixels = img.load()
axis = 0
diagonal = 0
edge_pixels = 0
colored_pixels = 0

def color_stats(rgb):
    r, g, b = rgb
    mx = max(r, g, b)
    mn = min(r, g, b)
    sat = 0 if mx == 0 else (mx - mn) / mx
    luma = (0.2126 * r) + (0.7152 * g) + (0.0722 * b)
    return sat, luma

def is_colored(x, y):
    sat, luma = color_stats(pixels[x, y])
    return sat >= 0.18 and 35 <= luma <= 180

def saturation_at(x, y):
    sat, _ = color_stats(pixels[x, y])
    return sat

for y in range(1, height - 1):
    for x in range(1, width - 1):
        colored = is_colored(x, y)
        if colored:
            colored_pixels += 1
        if not colored:
            continue
        if is_colored(x - 1, y) and is_colored(x + 1, y) and is_colored(x, y - 1) and is_colored(x, y + 1):
            continue

        gx = (
            saturation_at(x + 1, y - 1) + (2 * saturation_at(x + 1, y)) + saturation_at(x + 1, y + 1)
        ) - (
            saturation_at(x - 1, y - 1) + (2 * saturation_at(x - 1, y)) + saturation_at(x - 1, y + 1)
        )
        gy = (
            saturation_at(x - 1, y + 1) + (2 * saturation_at(x, y + 1)) + saturation_at(x + 1, y + 1)
        ) - (
            saturation_at(x - 1, y - 1) + (2 * saturation_at(x, y - 1)) + saturation_at(x + 1, y - 1)
        )
        if math.hypot(gx, gy) <= 0.12:
            continue

        edge_pixels += 1
        angle = abs(math.degrees(math.atan2(gy, gx))) % 180
        axis_distance = min(abs(angle), abs(angle - 90), abs(angle - 180))
        diagonal_distance = min(abs(angle - 45), abs(angle - 135))
        if axis_distance <= 10:
            axis += 1
        if diagonal_distance <= 10:
            diagonal += 1

print(json.dumps({
    'edgePixels': edge_pixels,
    'axisEdgeRatio': round(axis / max(1, edge_pixels), 4),
    'diagonalEdgeRatio': round(diagonal / max(1, edge_pixels), 4),
    'axisToDiagonal': round(axis / max(1, diagonal), 4),
    'edgePerColored': round(edge_pixels / max(1, colored_pixels), 4),
}))
`;
  const result = spawnSync('python', ['-c', script, imageFile], {
    cwd: root,
    encoding: 'utf8',
    timeout: 20_000,
  });
  if (result.status !== 0) {
    throw new Error(`Could not measure territory edge angularity for ${imageFile}: ${result.stderr || result.stdout}`);
  }
  try {
    return JSON.parse(result.stdout);
  } catch (error) {
    throw new Error(`Could not parse territory edge angularity output for ${imageFile}: ${result.stdout}`);
  }
}

function compareEdgeAngularityToReference(screenshotFile) {
  const generated = measureImageEdgeAngularity(screenshotFile);
  const reference = measureImageEdgeAngularity(referencePath);
  return {
    generated,
    reference,
    axisToDiagonalDelta: Math.round((generated.axisToDiagonal - reference.axisToDiagonal) * 10000) / 10000,
  };
}

function readTerritoryDomProof() {
  return runBrowser([
    'eval',
    '--markers',
    markers,
    '--json',
    '--js',
    `(() => {
      const q = (selector) => Array.from(document.querySelectorAll(selector));
      const contours = q('.terr-land-mask-contour');
      const surfaces = q('.terr-land-mask-region-surface');
      const concreteLands = q('.terr-land-mask-concrete-land');
      const exactUnderlays = q('.terr-land-mask-exact-underlay');
      const genericRegions = q('.terr-land-mask-region:not(.terr-land-mask-region-surface)');
      const container = document.querySelector('.territory-heatmap-outline .leaflet-container');
      const tile = document.querySelector('.territory-heatmap-outline .territory-real-world-tile, .territory-heatmap-outline img.leaflet-tile');
      const containerStyle = container ? getComputedStyle(container) : null;
      const tileStyle = tile ? getComputedStyle(tile) : null;
      const helpers = ${JSON.stringify(helperSelectors)};
      return {
        contours: contours.length,
        surfaces: surfaces.length,
        concreteLands: concreteLands.length,
        exactUnderlays: exactUnderlays.length,
        genericRegions: genericRegions.length,
        helpers: Object.fromEntries(helpers.map((selector) => [selector, q(selector).length])),
        mapStyle: {
          containerBackground: containerStyle?.backgroundColor || null,
          containerFilter: containerStyle?.filter || null,
          tileFilter: tileStyle?.filter || null,
          tileMixBlendMode: tileStyle?.mixBlendMode || null,
        },
        contourSample: contours.slice(0, 12).map((node) => ({
          stroke: node.getAttribute('stroke'),
          strokeWidth: node.getAttribute('stroke-width'),
          strokeOpacity: node.getAttribute('stroke-opacity'),
          filter: getComputedStyle(node).filter,
          mixBlendMode: getComputedStyle(node).mixBlendMode,
          strokeLinecap: getComputedStyle(node).strokeLinecap,
          strokeLinejoin: getComputedStyle(node).strokeLinejoin,
          d: node.getAttribute('d'),
          hasC: /C/.test(node.getAttribute('d') || ''),
          hasLineCommands: /[LHV]/.test(node.getAttribute('d') || ''),
        })),
        surfaceSample: surfaces.slice(0, 12).map((node) => ({
          fill: node.getAttribute('fill'),
          fillOpacity: node.getAttribute('fill-opacity'),
          stroke: node.getAttribute('stroke'),
          strokeWidth: node.getAttribute('stroke-width'),
          strokeOpacity: node.getAttribute('stroke-opacity'),
          filter: getComputedStyle(node).filter,
          d: node.getAttribute('d'),
          hasC: /C/.test(node.getAttribute('d') || ''),
          hasLineCommands: /[LHV]/.test(node.getAttribute('d') || ''),
        })),
        concreteLandSample: concreteLands.slice(0, 12).map((node) => ({
          fill: node.getAttribute('fill'),
          fillOpacity: node.getAttribute('fill-opacity'),
          fillRule: node.getAttribute('fill-rule'),
          stroke: node.getAttribute('stroke'),
          strokeWidth: node.getAttribute('stroke-width'),
          strokeOpacity: node.getAttribute('stroke-opacity'),
          filter: getComputedStyle(node).filter,
          d: node.getAttribute('d'),
          hasC: /C/.test(node.getAttribute('d') || ''),
          hasLineCommands: /[LHV]/.test(node.getAttribute('d') || ''),
        })),
        exactUnderlaySample: exactUnderlays.slice(0, 12).map((node) => ({
          fill: node.getAttribute('fill'),
          fillOpacity: node.getAttribute('fill-opacity'),
          fillRule: node.getAttribute('fill-rule'),
          stroke: node.getAttribute('stroke'),
          strokeWidth: node.getAttribute('stroke-width'),
          strokeOpacity: node.getAttribute('stroke-opacity'),
          filter: getComputedStyle(node).filter,
          d: node.getAttribute('d'),
          hasLineCommands: /[LHV]/.test(node.getAttribute('d') || ''),
        })),
      };
    })()`,
  ]).value;
}

const territoryOnlyProofStyleScript = `(() => {
      const existing = document.getElementById('territory-border-proof-style');
      if (existing) existing.remove();
      const style = document.createElement('style');
      style.id = 'territory-border-proof-style';
      style.textContent = \`
        html,
        body,
        .territory-page,
        .territory-page .runner-shell-main,
        .territory-page .runner-shell-canvas,
        .territory-page .territory-canvas,
        .territory-page .terr-map-section,
        .territory-page .territory-map-section,
        .territory-page .terr-leaflet-map,
        .territory-page .leaflet-container,
        .territory-page .leaflet-map-pane,
        .territory-page .leaflet-tile-pane {
          background: #05070a !important;
        }
        .territory-page .territory-proof-road-texture {
          position: absolute;
          inset: 0;
          z-index: 250;
          pointer-events: none;
          background:
            linear-gradient(4deg, transparent 0 41%, rgba(122, 135, 132, 0.13) 41.4% 42.1%, transparent 42.7%),
            linear-gradient(88deg, transparent 0 48%, rgba(122, 135, 132, 0.1) 48.4% 49%, transparent 49.8%),
            linear-gradient(134deg, transparent 0 57%, rgba(122, 135, 132, 0.09) 57.4% 58.1%, transparent 58.8%),
            repeating-linear-gradient(0deg, rgba(214, 220, 199, 0.045) 0 1px, transparent 1px 46px),
            repeating-linear-gradient(90deg, rgba(214, 220, 199, 0.035) 0 1px, transparent 1px 54px);
          opacity: 0.4;
        }
        .territory-page .terr-map-topbar,
        .territory-page .terr-map-utility-rail,
        .territory-page .leaflet-control-container,
        .territory-page .runner-shell-sidebar,
        .territory-page .runner-shell-topbar {
          display: none !important;
        }
        .territory-page .terr-map-section::after,
        .territory-page .territory-map-section::after {
          display: none !important;
          content: none !important;
        }
      \`;
      document.head.appendChild(style);
      const container = document.querySelector('.territory-page .leaflet-container');
      const existingTexture = document.querySelector('.territory-page .territory-proof-road-texture');
      if (existingTexture) existingTexture.remove();
      if (container) {
        const texture = document.createElement('div');
        texture.className = 'territory-proof-road-texture';
        container.appendChild(texture);
      }
      return { ok: true };
    })()`;

function applyTerritoryOnlyProofStyle() {
  return runBrowser([
    'eval',
    '--markers',
    markers,
    '--json',
    '--js',
    territoryOnlyProofStyleScript,
  ]);
}

async function waitForTerritoryDomProof(timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let proof = null;
  while (Date.now() < deadline) {
    proof = readTerritoryDomProof();
    if (proof?.contours > 0
      && proof?.surfaces === 0
      && proof?.concreteLands > 0
      && proof?.exactUnderlays > 0) {
      return proof;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return proof;
}

async function waitForTerritoryDomPresence(timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let proof = null;
  while (Date.now() < deadline) {
    proof = readTerritoryDomProof();
    if (proof?.contours > 0 && proof?.concreteLands > 0) {
      return proof;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return proof;
}

function parseSetViewArg(value) {
  if (!value) return null;
  const [latitude, longitude, zoom] = String(value).split(',').map((part) => Number(part.trim()));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || !Number.isFinite(zoom)) {
    throw new Error(`Invalid --set-view value. Expected "lat,lng,zoom", received: ${value}`);
  }
  return { latitude, longitude, zoom };
}

function parseClipArg(value) {
  if (!value) return null;
  const [x, y, width, height] = String(value).split(',').map((part) => Number(part.trim()));
  if (![x, y, width, height].every((number) => Number.isFinite(number)) || width <= 0 || height <= 0) {
    throw new Error(`Invalid --clip value. Expected "x,y,width,height", received: ${value}`);
  }
  return {
    x: Math.max(0, Math.floor(x)),
    y: Math.max(0, Math.floor(y)),
    width: Math.floor(width),
    height: Math.floor(height),
  };
}

async function waitForProofMap(setView = null, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let result = null;
  while (Date.now() < deadline) {
    const setViewScript = setView
      ? `map.setView([${setView.latitude}, ${setView.longitude}], ${setView.zoom}, { animate: false });`
      : '';
    result = runBrowser([
      'eval',
      '--markers',
      markers,
      '--json',
      '--js',
      `(() => {
        const map = document.querySelector('.terr-leaflet-map')?.__hermesTerritoryMap;
        if (!map) return { ok: false, error: 'no map' };
        ${setViewScript}
        return { ok: true, zoom: map.getZoom(), center: map.getCenter() };
      })()`,
    ]).value;
    if (result?.ok && (!setView || result?.zoom === setView.zoom)) {
      return result;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return result;
}

const server = proofMode === 'fixture-server'
  ? spawn(nodeBin, ['.tools/territory-visual-proof-server.mjs'], {
    cwd: root,
    env: { ...process.env, TERRITORY_PROOF_PORT: proofPort },
    stdio: 'ignore',
    windowsHide: true,
  })
  : null;

try {
  await waitForUrl(proofUrl);
  const gotoResult = runBrowser(['goto', '--url', proofUrl, '--wait-ms', '12000', '--markers', markers]);
  assert(gotoResult.ok, `Browser did not load proof URL: ${JSON.stringify(gotoResult)}`);
  if (authToken) {
    const authResult = runBrowser([
      'eval',
      '--markers',
      markers,
      '--json',
      '--js',
      `(() => {
        localStorage.setItem('hermes_jwt', ${JSON.stringify(authToken)});
        localStorage.setItem('hermes_email', ${JSON.stringify(authEmail)});
        localStorage.setItem('hermes_role', ${JSON.stringify(authRole)});
        return { ok: true, email: localStorage.getItem('hermes_email') };
      })()`,
    ]);
    assert(authResult.value?.ok, `Could not seed live auth localStorage: ${JSON.stringify(authResult)}`);
    const authedGotoResult = runBrowser(['goto', '--url', proofUrl, '--wait-ms', '12000', '--markers', markers]);
    assert(authedGotoResult.ok, `Browser did not reload authenticated proof URL: ${JSON.stringify(authedGotoResult)}`);
  }

  const initialProof = await waitForTerritoryDomPresence();
  assert(initialProof?.contours > 0, 'No territory contour strokes rendered before zoom proof.');
  assert(initialProof?.concreteLands > 0, 'No smooth concrete territory land fills rendered before zoom proof.');
  assert(initialProof?.surfaces === 0, `Territory land surfaces rendered before zoom proof: ${initialProof?.surfaces}`);
  assert(initialProof?.genericRegions === 0, `Generic unsmoothed territory region paths rendered before zoom proof: ${initialProof?.genericRegions}`);

  const requestedView = parseSetViewArg(setViewArg);
  const zoomResult = await waitForProofMap(requestedView);
  assert(zoomResult?.ok && (!requestedView || zoomResult?.zoom === requestedView.zoom), `Could not set proof map zoom: ${JSON.stringify(zoomResult)}`);
  await new Promise((resolve) => setTimeout(resolve, 2_000));

  const proof = await waitForTerritoryDomProof();
  assert(proof?.contours > 0, 'No territory contour strokes rendered.');
  assert(proof?.concreteLands > 0, 'No smooth concrete territory land fills rendered.');
  assert(proof?.exactUnderlays > 0, 'No exact territory coverage underlay rendered.');
  assert(proof?.surfaces === 0, `Territory land surfaces should not render because they can paint a pixelated inner band: ${proof?.surfaces}`);
  assert(proof.genericRegions === 0, `Generic unsmoothed territory region paths rendered: ${proof.genericRegions}`);
  Object.entries(proof.helpers || {}).forEach(([selector, count]) => {
    assert(count === 0, `Unexpected helper/highlight layer rendered: ${selector} count=${count}`);
  });
  assert(
    proof.mapStyle?.containerBackground === 'rgb(5, 7, 10)',
    `Unexpected map substrate background: ${proof.mapStyle?.containerBackground}`,
  );
  assert(proof.mapStyle?.containerFilter === 'none', `Map container filter should be none: ${proof.mapStyle?.containerFilter}`);
  assert(
    proof.mapStyle?.tileFilter === 'none',
    `Unexpected real-world tile filter: ${proof.mapStyle?.tileFilter}`,
  );
  assert(
    proof.mapStyle?.tileMixBlendMode === 'normal',
    `Real-world tile blend mode should be normal: ${proof.mapStyle?.tileMixBlendMode}`,
  );
  proof.contourSample.forEach((sample) => {
    assert(sample.strokeWidth === '3', `Unexpected contour width: ${sample.strokeWidth}`);
    assert(sample.strokeOpacity === '1', `Unexpected contour opacity: ${sample.strokeOpacity}`);
    assert(sample.filter === 'none', `Contour filter should be none: ${sample.filter}`);
    assert(sample.mixBlendMode === 'normal', `Contour blend mode should be normal: ${sample.mixBlendMode}`);
    assert(sample.strokeLinecap === 'round', `Contour line cap should be round: ${sample.strokeLinecap}`);
    assert(sample.strokeLinejoin === 'round', `Contour line join should be round: ${sample.strokeLinejoin}`);
    assert(sample.d && sample.d.length > 0, 'Every sampled contour should have a rendered Leaflet SVG path.');
  });
  assert(proof.surfaceSample.length === 0, 'Surface land fill should be absent so only the concrete contour can paint territory ownership.');
  proof.concreteLandSample.forEach((sample) => {
    assert(sample.stroke === 'none', `Concrete land should not paint a broad same-color edge inside the contour: ${sample.stroke}`);
    assert(sample.strokeWidth === '0' || sample.strokeWidth === null, `Unexpected concrete land stroke width: ${sample.strokeWidth}`);
    assert(sample.strokeOpacity === '0' || sample.strokeOpacity === null, `Unexpected concrete land stroke opacity: ${sample.strokeOpacity}`);
    assert(sample.filter === 'none', `Concrete land filter should be none: ${sample.filter}`);
    assert(sample.fillRule === 'nonzero', `Concrete land should use nonzero fill rule so smoothed paths cannot cut interior holes: ${sample.fillRule}`);
    assert(['0.42', '0.34'].includes(sample.fillOpacity), `Unexpected concrete land opacity: ${sample.fillOpacity}`);
    assert(sample.d && sample.d.length > 0, 'Concrete land fill should have a rendered Leaflet SVG path.');
  });
  proof.exactUnderlaySample.forEach((sample) => {
    assert(sample.stroke === 'none', `Exact coverage underlay should not paint a stroke: ${sample.stroke}`);
    assert(sample.strokeWidth === '0' || sample.strokeWidth === null, `Unexpected exact underlay stroke width: ${sample.strokeWidth}`);
    assert(sample.strokeOpacity === '0' || sample.strokeOpacity === null, `Unexpected exact underlay stroke opacity: ${sample.strokeOpacity}`);
    assert(sample.filter === 'none', `Exact coverage underlay filter should be none: ${sample.filter}`);
    assert(sample.fillRule === 'nonzero', `Exact coverage underlay should use nonzero fill rule so ownership coverage cannot cancel itself: ${sample.fillRule}`);
    assert(['0.22', '0.18'].includes(sample.fillOpacity), `Unexpected exact coverage opacity: ${sample.fillOpacity}`);
    assert(sample.d && sample.d.length > 0, 'Exact coverage underlay should have a rendered Leaflet SVG path.');
  });

  const proofStyleResult = applyTerritoryOnlyProofStyle();
  assert(proofStyleResult.value?.ok, `Could not apply territory-only proof style: ${JSON.stringify(proofStyleResult)}`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const viewportResult = runBrowser([
    'eval',
    '--markers',
    markers,
    '--json',
    '--js',
    `(() => ({ width: window.innerWidth, height: window.innerHeight }))()`,
  ]);
  const viewport = viewportResult.value || { width: 1920, height: 945 };
  const territoryBoundsResult = runBrowser([
    'eval',
    '--markers',
    markers,
    '--json',
    '--js',
    `(() => {
      const nodes = [
        ...document.querySelectorAll('.terr-land-mask-contour'),
        ...document.querySelectorAll('.terr-land-mask-region-surface'),
      ];
      const rects = nodes
        .map((node) => node.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0);
      if (!rects.length) return null;
      const left = Math.min(...rects.map((rect) => rect.left));
      const top = Math.min(...rects.map((rect) => rect.top));
      const right = Math.max(...rects.map((rect) => rect.right));
      const bottom = Math.max(...rects.map((rect) => rect.bottom));
      return { x: left, y: top, width: right - left, height: bottom - top };
    })()`,
  ]);
  const territoryBounds = territoryBoundsResult.value;
  const requestedClip = parseClipArg(clipArg);
  const hasTerritoryBounds = territoryBounds
    && Number.isFinite(territoryBounds.x)
    && Number.isFinite(territoryBounds.y)
    && Number.isFinite(territoryBounds.width)
    && Number.isFinite(territoryBounds.height)
    && territoryBounds.width > 0
    && territoryBounds.height > 0;
  const proofMargin = 6;
  const cropWidth = requestedClip?.width ?? (hasTerritoryBounds
    ? Math.min(viewport.width, Math.max(350, Math.ceil(territoryBounds.width + (proofMargin * 2))))
    : Math.min(1280, Math.max(640, Math.floor(viewport.width * 0.72))));
  const cropHeight = requestedClip?.height ?? (hasTerritoryBounds
    ? Math.min(viewport.height, Math.max(276, Math.ceil(territoryBounds.height + (proofMargin * 2))))
    : Math.min(860, Math.max(420, Math.floor(viewport.height * 0.94))));
  const cropX = requestedClip?.x ?? (hasTerritoryBounds
    ? Math.max(0, Math.min(
      Math.floor(territoryBounds.x + (territoryBounds.width / 2) - (cropWidth / 2)),
      Math.max(0, viewport.width - cropWidth),
    ))
    : Math.max(0, Math.floor((viewport.width - cropWidth) / 2)));
  const cropY = requestedClip?.y ?? (hasTerritoryBounds
    ? Math.max(0, Math.min(
      Math.floor(territoryBounds.y + (territoryBounds.height / 2) - (cropHeight / 2)),
      Math.max(0, viewport.height - cropHeight),
    ))
    : Math.max(0, Math.floor((viewport.height - cropHeight) / 2)));
  const screenshotClip = { x: cropX, y: cropY, width: cropWidth, height: cropHeight };

  const screenshotResult = runBrowser([
    'screenshot',
    '--markers',
    markers,
    '--out',
    screenshotPath,
    '--format',
    'jpeg',
    '--quality',
    '90',
    '--clip',
    `${cropX},${cropY},${cropWidth},${cropHeight}`,
    ...(browserProofMode === 'playwright' ? ['--pre-js', territoryOnlyProofStyleScript] : []),
  ]);
  assert(screenshotResult.ok, `Screenshot failed: ${JSON.stringify(screenshotResult)}`);
  const substrateMetrics = compareSubstrateToReference(screenshotResult.path);
  assert(
    substrateMetrics.generated.neutralAverageLuma <= 60,
    `Map substrate is too light for INTVL reference styling: neutralAverageLuma=${substrateMetrics.generated.neutralAverageLuma}`,
  );
  assert(
    substrateMetrics.neutralAverageLumaDelta <= 30,
    `Map substrate is too far from reference luminance: delta=${substrateMetrics.neutralAverageLumaDelta}`,
  );
  const territoryColorMetrics = compareTerritoryColorToReference(screenshotResult.path);
  assert(
    territoryColorMetrics.generated.edgeLike.pixelRatio >= 0.005,
    `Territory border/edge color is too sparse after removing the pixelated halo: edgeLikePixelRatio=${territoryColorMetrics.generated.edgeLike.pixelRatio}`,
  );
  assert(
    Math.abs(territoryColorMetrics.edgeLikePixelRatioDelta) <= 0.62,
    `Territory border/edge coverage is too far from reference after removing halo/highlight layers: delta=${territoryColorMetrics.edgeLikePixelRatioDelta}`,
  );
  assert(
    territoryColorMetrics.generated.edgeLike.averageLuma >= 70,
    `Territory border/edge color is too dim for a visible concrete border: edgeLikeAverageLuma=${territoryColorMetrics.generated.edgeLike.averageLuma}`,
  );
  assert(
    territoryColorMetrics.generated.edgeLike.averageSat >= 0.42,
    `Territory border/edge color is too desaturated for a visible concrete border: edgeLikeAverageSat=${territoryColorMetrics.generated.edgeLike.averageSat}`,
  );
  assert(
    territoryColorMetrics.edgeLikeAverageLumaDelta <= 24,
    `Territory edge luma is brighter than the no-halo target: delta=${territoryColorMetrics.edgeLikeAverageLumaDelta}`,
  );
  assert(
    territoryColorMetrics.edgeLikeAverageSatDelta <= 0.12,
    `Territory edge saturation is brighter than the no-halo target: delta=${territoryColorMetrics.edgeLikeAverageSatDelta}`,
  );
  assert(
    territoryColorMetrics.generated.colored.averageLuma >= 62,
    `Territory land fill is too dark for INTVL reference styling: coloredAverageLuma=${territoryColorMetrics.generated.colored.averageLuma}`,
  );
  assert(
    Math.abs(territoryColorMetrics.coloredPixelRatioDelta) <= 0.42,
    `Territory filled-land coverage is too far from reference: delta=${territoryColorMetrics.coloredPixelRatioDelta}`,
  );
  assert(
    territoryColorMetrics.generated.colored.averageSat >= 0.32,
    `Territory land fill is too desaturated for INTVL reference styling: coloredAverageSat=${territoryColorMetrics.generated.colored.averageSat}`,
  );
  assert(
    Math.abs(territoryColorMetrics.coloredAverageLumaDelta) <= 38,
    `Territory land fill luma is too far from reference: delta=${territoryColorMetrics.coloredAverageLumaDelta}`,
  );
  assert(
    Math.abs(territoryColorMetrics.coloredAverageSatDelta) <= 0.28,
    `Territory land fill saturation is too far from reference: delta=${territoryColorMetrics.coloredAverageSatDelta}`,
  );
  const territorySeamMetrics = compareTerritorySeamsToReference(screenshotResult.path);
  assert(
    territorySeamMetrics.generated.betweenTerritoryDarkPerColored <= 0.14,
    `Territory concrete seams leave too much dark gap between claimed lands: generated=${territorySeamMetrics.generated.betweenTerritoryDarkPerColored}, reference=${territorySeamMetrics.reference.betweenTerritoryDarkPerColored}`,
  );
  const edgeAngularityMetrics = compareEdgeAngularityToReference(screenshotResult.path);
  assert(
    edgeAngularityMetrics.axisToDiagonalDelta <= 0.25,
    `Territory border is too axis-aligned/pixel-like versus reference: delta=${edgeAngularityMetrics.axisToDiagonalDelta}`,
  );

  const printableContourSample = proof.contourSample.slice(0, 4).map(({ d, ...sample }) => sample);
  const printableSurfaceSample = proof.surfaceSample.slice(0, 4).map(({ d, ...sample }) => sample);
  const printableConcreteLandSample = proof.concreteLandSample.slice(0, 4).map(({ d, ...sample }) => sample);
  const printableExactUnderlaySample = proof.exactUnderlaySample.slice(0, 4).map(({ d, ...sample }) => sample);

  console.log(JSON.stringify({
    ok: true,
    proofMode,
    proofUrl,
    markers,
    requestedView,
    referencePath,
    screenshotClip,
    screenshot: screenshotResult.path,
    contours: proof.contours,
    surfaces: proof.surfaces,
    concreteLands: proof.concreteLands,
    exactUnderlays: proof.exactUnderlays,
    genericRegions: proof.genericRegions,
    helpers: proof.helpers,
    mapStyle: proof.mapStyle,
    contourSample: printableContourSample,
    surfaceSample: printableSurfaceSample,
    concreteLandSample: printableConcreteLandSample,
    exactUnderlaySample: printableExactUnderlaySample,
    substrateMetrics,
    territoryColorMetrics,
    territorySeamMetrics,
    edgeAngularityMetrics,
  }, null, 2));
} finally {
  if (server) server.kill();
}
