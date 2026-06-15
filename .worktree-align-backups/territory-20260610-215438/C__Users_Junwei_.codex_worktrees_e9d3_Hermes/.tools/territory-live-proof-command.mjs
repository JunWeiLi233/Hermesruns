#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nodeBin = process.execPath;

function argValue(flag, fallback = null) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function markersForUrl(url) {
  try {
    const parsed = new URL(url);
    const markers = new Set([parsed.host]);
    if (parsed.hostname === 'localhost') {
      markers.add(`127.0.0.1${parsed.port ? `:${parsed.port}` : ''}`);
    }
    if (parsed.hostname === '127.0.0.1') {
      markers.add(`localhost${parsed.port ? `:${parsed.port}` : ''}`);
    }
    return Array.from(markers).join(',');
  } catch {
    return 'localhost:8080,127.0.0.1:8080';
  }
}

function runBrowser(args) {
  const result = spawnSync(nodeBin, ['.tools/auto-hermes-browser.mjs', ...args], {
    cwd: root,
    encoding: 'utf8',
    timeout: 45_000,
  });
  const stdout = String(result.stdout || '').trim();
  if (result.status !== 0) {
    throw new Error(String(result.stderr || stdout || `auto-hermes-browser exited ${result.status}`));
  }
  try {
    return JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Could not parse auto-hermes-browser output: ${error.message}\n${stdout}`);
  }
}

function quoteArg(value) {
  const text = String(value);
  return /[\s"'`,;]/.test(text) ? JSON.stringify(text) : text;
}

function verifierCommand({ url, setView, clip, reference, screenshot, markers }) {
  return verifierArgs({ url, setView, clip, reference, screenshot, markers })
    .map(quoteArg)
    .join(' ');
}

function verifierArgs({ url, setView, clip, reference, screenshot, markers }) {
  const args = [
    'node',
    '.tools/verify-territory-border-runtime.mjs',
    '--url',
    url,
    '--set-view',
    setView,
    '--reference',
    reference,
    '--clip',
    clip,
    '--screenshot',
    screenshot,
  ];
  if (markers) {
    args.push('--markers', markers);
  }
  return args;
}

function runVerifier(args) {
  const commandArgs = args[0] === 'node' ? args.slice(1) : args;
  const result = spawnSync(nodeBin, commandArgs, {
    cwd: root,
    encoding: 'utf8',
    timeout: 120_000,
  });
  let parsed = null;
  try {
    parsed = JSON.parse(String(result.stdout || '').trim());
  } catch {
    parsed = null;
  }
  return {
    ok: result.status === 0,
    exitCode: result.status,
    stdout: String(result.stdout || '').slice(-4000),
    stderr: String(result.stderr || '').slice(-4000),
    parsed,
  };
}

const url = argValue('--url', 'http://localhost:8080/territory');
const reference = argValue('--reference', 'territory-reference-weight-closeup.jpg');
const screenshot = argValue('--screenshot', 'task-images/territory-runtime-live-proof.jpg');
const markers = argValue('--markers', markersForUrl(url));
const shouldGoto = !hasFlag('--no-goto');
const shouldExecute = hasFlag('--execute');

try {
  let gotoResult = null;
  if (shouldGoto) {
    gotoResult = runBrowser(['goto', '--url', url, '--wait-ms', '12000', '--markers', markers]);
  }

  const probe = runBrowser([
    'eval',
    '--markers',
    markers,
    '--json',
    '--js',
    `(() => {
      const mapElement = document.querySelector('.terr-leaflet-map');
      const map = mapElement?.__hermesTerritoryMap;
      const viewport = { width: window.innerWidth, height: window.innerHeight };
      if (!map) {
        return {
          ok: false,
          error: 'no territory map mounted',
          currentUrl: location.href,
          title: document.title,
          hasTerritoryMapElement: Boolean(mapElement),
          viewport,
        };
      }
      const center = map.getCenter();
      return {
        ok: true,
        currentUrl: location.href,
        title: document.title,
        center: { latitude: center.lat, longitude: center.lng },
        zoom: map.getZoom(),
        viewport,
      };
    })()`,
  ]).value;

  if (!probe?.ok) {
    process.stdout.write(JSON.stringify({
      ok: false,
      url,
      markers,
      gotoResult,
      probe,
      nextStep: 'Open an authenticated /territory page, then rerun with --no-goto or the authenticated URL.',
    }, null, 2));
    process.stdout.write('\n');
    process.exit(1);
  }

  const viewport = probe.viewport || { width: 1920, height: 945 };
  const cropWidth = Math.min(1280, Math.max(640, Math.floor(viewport.width * 0.72)));
  const cropHeight = Math.min(860, Math.max(420, Math.floor(viewport.height * 0.94)));
  const cropX = Math.max(0, Math.floor((viewport.width - cropWidth) / 2));
  const cropY = Math.max(0, Math.floor((viewport.height - cropHeight) / 2));
  const setView = [
    Number(probe.center.latitude).toFixed(6),
    Number(probe.center.longitude).toFixed(6),
    probe.zoom,
  ].join(',');
  const clip = [cropX, cropY, cropWidth, cropHeight].join(',');
  const command = verifierCommand({
    url: probe.currentUrl || url,
    setView,
    clip,
    reference,
    screenshot,
    markers,
  });
  const commandArgs = verifierArgs({
    url: probe.currentUrl || url,
    setView,
    clip,
    reference,
    screenshot,
    markers,
  });
  const verifierResult = shouldExecute ? runVerifier(commandArgs) : null;

  process.stdout.write(JSON.stringify({
    ok: verifierResult ? verifierResult.ok : true,
    url: probe.currentUrl || url,
    markers,
    setView,
    clip,
    reference,
    screenshot,
    command,
    commandArgs,
    verifierResult,
    gotoResult,
    map: {
      center: probe.center,
      zoom: probe.zoom,
      viewport,
    },
  }, null, 2));
  process.stdout.write('\n');
  if (verifierResult && !verifierResult.ok) {
    process.exit(1);
  }
} catch (error) {
  process.stdout.write(JSON.stringify({
    ok: false,
    error: error.message,
    url,
    markers,
  }, null, 2));
  process.stdout.write('\n');
  process.exit(1);
}
