#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-open-route-proof.jpg"));
const sharedEmail = readArg("--email", process.env.APP_LOCAL_SHARED_RUNNER_EMAIL || "strava+140971747@hermes.local");
const sharedPassword = readArg("--password", process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "HermesDev2026!");
const center = parseCenter(readArg("--center", "40.781,-73.966"));
const zoom = Number(readArg("--zoom", "14"));
const maxThicknessRatio = Number(readArg("--max-thickness-ratio", "2.7"));
const minSamples = Number(readArg("--min-samples", "5"));

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function parseCenter(value) {
  const [latitude, longitude] = String(value).split(",").map((part) => Number(part.trim()));
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(`Invalid --center value: ${value}`);
  }
  return [latitude, longitude];
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function distanceMeters(left, right) {
  const leftLat = Number(left?.latitude);
  const leftLng = Number(left?.longitude);
  const rightLat = Number(right?.latitude);
  const rightLng = Number(right?.longitude);
  if (![leftLat, leftLng, rightLat, rightLng].every(Number.isFinite)) {
    return Number.POSITIVE_INFINITY;
  }
  const metersPerDegLat = 111_320;
  const cosLat = Math.cos((((leftLat + rightLat) * 0.5) * Math.PI) / 180);
  const dx = (rightLng - leftLng) * cosLat * metersPerDegLat;
  const dy = (rightLat - leftLat) * metersPerDegLat;
  return Math.hypot(dx, dy);
}

function routeTracePoints(trace) {
  return (Array.isArray(trace?.points) ? trace.points : [])
    .map((point) => ({ latitude: Number(point?.latitude), longitude: Number(point?.longitude) }))
    .filter((point) => Number.isFinite(point.latitude) && Number.isFinite(point.longitude));
}

function traceDistanceToCenter(points, targetCenter) {
  if (!Array.isArray(points) || !points.length) {
    return Number.POSITIVE_INFINITY;
  }
  const target = { latitude: targetCenter[0], longitude: targetCenter[1] };
  return points.reduce((nearest, point) => Math.min(nearest, distanceMeters(point, target)), Number.POSITIVE_INFINITY);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is not installed or not resolvable: ${error?.message || error}`);
  }
}

async function login() {
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sharedEmail, password: sharedPassword }),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok && data?.token, `Login failed for ${sharedEmail}: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data;
}

async function fetchBackendPolygons(token) {
  const response = await fetch(new URL("/api/territory/polygons", baseUrl), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  assert(response.ok && Array.isArray(data?.polygons), `Polygon API failed: HTTP ${response.status} ${JSON.stringify(data)}`);
  return data.polygons;
}

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const loginData = await login();
const polygons = await fetchBackendPolygons(loginData.token);
const activeTraceCandidates = polygons
  .filter((polygon) => polygon?.active === true)
  .flatMap((polygon) => (Array.isArray(polygon.routeTraces) ? polygon.routeTraces : [])
    .map((trace) => ({
      activityId: polygon.activityId ?? trace?.activityId ?? null,
      points: routeTracePoints(trace),
    })))
  .filter((candidate) => candidate.points.length > 0)
  .map((candidate) => ({
    ...candidate,
    distanceMeters: traceDistanceToCenter(candidate.points, center),
  }))
  .sort((left, right) => left.distanceMeters - right.distanceMeters || right.points.length - left.points.length);
const selectedTrace = activeTraceCandidates[0] || null;
assert(selectedTrace, "No active route trace points returned by /api/territory/polygons.");
assert(
  selectedTrace.distanceMeters <= 2_500,
  `No active route trace near requested center ${center.join(",")}; nearest=${Math.round(selectedTrace.distanceMeters)}m activity=${selectedTrace.activityId}`,
);
const routePoints = selectedTrace.points;
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const consoleErrors = [];
  const httpErrors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  page.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));
  page.on("response", (response) => {
    if (response.status() >= 400) {
      httpErrors.push({ status: response.status(), url: response.url() });
    }
  });

  await page.addInitScript(({ token, email }) => {
    Object.keys(localStorage).forEach((key) => {
      if (key.toLowerCase().includes("territory")) localStorage.removeItem(key);
    });
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: loginData.token, email: loginData.email || sharedEmail });

  await page.goto(new URL("/territory?proof=open-route", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await page.waitForFunction(() => (
    document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap
    && document.querySelectorAll(".terr-land-mask-concrete-land--active").length > 0
  ), { timeout: 45_000 });
  await page.waitForTimeout(1_600);
  await page.evaluate(({ center: viewCenter, zoom: viewZoom }) => {
    const map = document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap;
    map.setView(viewCenter, viewZoom, { animate: false });
    map.invalidateSize({ pan: false });
  }, { center, zoom });
  await page.waitForTimeout(1_000);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const proof = await page.evaluate(({ maxThicknessRatio: allowedRatio, minSamples: requiredSamples, routePoints }) => {
    const map = document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap;
    const activePaths = Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--active"));
    const activeContours = Array.from(document.querySelectorAll(".terr-land-mask-contour--active"));

    const activePath = activePaths.find((path) => {
      const rect = path.getBoundingClientRect();
      return rect.width > 40 && rect.height > 40;
    }) || activePaths[0];
    const matrix = activePath?.getScreenCTM?.();
    const inverseMatrix = matrix?.inverse?.();
    const bounds = activePath?.getBoundingClientRect();
    const samples = [];
    let routeFillHitCount = 0;

    function pointInFill(x, y) {
      if (!activePath || !inverseMatrix || typeof activePath.isPointInFill !== "function") {
        return false;
      }
      try {
        return activePath.isPointInFill(new DOMPoint(x, y).matrixTransform(inverseMatrix));
      } catch {
        return false;
      }
    }

    function thicknessAtScreenPoint(point, previousPoint, nextPoint) {
      const vx = (nextPoint?.x ?? point.x) - (previousPoint?.x ?? point.x);
      const vy = (nextPoint?.y ?? point.y) - (previousPoint?.y ?? point.y);
      const length = Math.hypot(vx, vy);
      if (length < 0.5) return null;
      const nx = -vy / length;
      const ny = vx / length;
      let left = 0;
      let right = 0;
      for (let distance = 0; distance <= 90; distance += 2) {
        if (pointInFill(point.x + nx * distance, point.y + ny * distance)) left = distance;
        else if (distance > 2) break;
      }
      for (let distance = 0; distance <= 90; distance += 2) {
        if (pointInFill(point.x - nx * distance, point.y - ny * distance)) right = distance;
        else if (distance > 2) break;
      }
      const thickness = left + right;
      if (thickness <= 0) return null;
      return thickness;
    }

    const routeScreenPoints = routePoints
      .map((point) => {
        const projected = map.latLngToContainerPoint([point.latitude, point.longitude]);
        const rect = map.getContainer().getBoundingClientRect();
        return { x: rect.left + projected.x, y: rect.top + projected.y };
      })
      .filter((point) => (
        bounds
        && point.x >= bounds.left - 8
        && point.x <= bounds.right + 8
        && point.y >= bounds.top - 8
        && point.y <= bounds.bottom + 8
      ));

    const stride = Math.max(1, Math.floor(routeScreenPoints.length / 80));
    for (let index = stride; index < routeScreenPoints.length - stride; index += stride) {
      const point = routeScreenPoints[index];
      if (!pointInFill(point.x, point.y)) continue;
      routeFillHitCount += 1;
      const thickness = thicknessAtScreenPoint(point, routeScreenPoints[index - stride], routeScreenPoints[index + stride]);
      if (Number.isFinite(thickness)) {
        samples.push(thickness);
      }
    }

    samples.sort((left, right) => left - right);
    const percentile = (p) => {
      if (!samples.length) return null;
      return samples[Math.max(0, Math.min(samples.length - 1, Math.floor((samples.length - 1) * p)))];
    };
    const p10 = percentile(0.1);
    const p50 = percentile(0.5);
    const p90 = percentile(0.9);
    const thicknessRatio = p10 && p90 ? p90 / p10 : null;

    return {
      activeConcrete: activePaths.length,
      activeContour: activeContours.length,
      routePointCount: routePoints.length,
      routeScreenPointCount: routeScreenPoints.length,
      routeFillHitCount,
      sampleCount: samples.length,
      p10,
      p50,
      p90,
      thicknessRatio,
      maxThicknessRatio: allowedRatio,
      minSamples: requiredSamples,
      activeBounds: bounds ? {
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        width: Math.round(bounds.width),
        height: Math.round(bounds.height),
      } : null,
    };
  }, { maxThicknessRatio, minSamples, routePoints });

  assert(consoleErrors.length === 0, `Console errors during Territory open-route proof: ${consoleErrors.join(" | ")}; httpErrors=${JSON.stringify(httpErrors)}`);
  assert(proof.activeConcrete > 0, `No active concrete rendered: ${JSON.stringify(proof)}`);
  assert(proof.activeContour > 0, `No active contour rendered: ${JSON.stringify(proof)}`);
  assert(proof.routePointCount > 0, `No route trace points exposed for proof: ${JSON.stringify(proof)}`);
  assert(proof.sampleCount >= minSamples, `Too few open-route thickness samples: ${JSON.stringify(proof)}`);
  assert(
    Number.isFinite(proof.thicknessRatio) && proof.thicknessRatio <= maxThicknessRatio,
    `Open-route corridor thickness is inconsistent: ${JSON.stringify(proof)}`,
  );

  console.log(JSON.stringify({
    ok: true,
    screenshot: path.relative(root, screenshotPath).replaceAll("\\", "/"),
    proof,
  }, null, 2));
} finally {
  await browser.close();
}
