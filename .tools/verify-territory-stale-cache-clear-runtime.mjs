#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const sharedEmail = readArg("--email", process.env.APP_LOCAL_SHARED_RUNNER_EMAIL || "strava+140971747@hermes.local");
const sharedPassword = readArg("--password", process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || readConfiguredSharedPassword() || "HermesDev2026!");
const simulateEmptyPolygonResponse = readArg("--simulate-empty", "true") !== "false";
const cacheVersion = "global-owner-territory-cache-v97-concrete-boundary-sampling";
const staleSignature = "stale-v25-bad-kissena-render";

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function readConfiguredSharedPassword() {
  const candidates = ["Hermes.local.env.ps1", "Hermes.local.env.example.ps1", ".env.example"];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) continue;
    const text = fs.readFileSync(file, "utf8");
    const powershellMatch = text.match(/APP_LOCAL_SHARED_RUNNER_PASSWORD\s*=\s*"([^"]+)"/);
    if (powershellMatch?.[1] && !powershellMatch[1].includes("<set-local-password>")) {
      return powershellMatch[1];
    }
    const envMatch = text.match(/^APP_LOCAL_SHARED_RUNNER_PASSWORD=(.+)$/m);
    if (envMatch?.[1] && !envMatch[1].includes("<set-local-password>")) {
      return envMatch[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
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

async function seedStaleRenderCache(page, token, email) {
  return page.evaluate(async ({ token: jwt, email: accountEmail, version, signature }) => {
    localStorage.setItem("hermes_jwt", jwt);
    localStorage.setItem("hermes_email", accountEmail);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));

    const accountKey = encodeURIComponent(String(accountEmail || "").trim().toLowerCase());
    const renderIndexKey = `hermes_territory_render_index_${accountKey}`;
    const renderKey = `render:${accountKey}:${signature}`;
    const polygonKey = `polygons:${accountKey}`;
    const staleRegion = [
      [40.7425, -73.8240],
      [40.7428, -73.8075],
      [40.7316, -73.8068],
      [40.7309, -73.8245],
      [40.7425, -73.8240],
    ];
    const renderData = {
      allCoords: staleRegion,
      contourRenderEntries: [{
        ownerKey: "stale-owner",
        active: true,
        color: "#f07561",
        borderColor: "#f07561",
        ownerName: "Stale bad cache",
        areaSquareMeters: 100000,
        landRegions: [staleRegion],
        contourRegions: [staleRegion],
      }],
      previewContourRenderEntries: [{
        ownerKey: "stale-owner",
        active: true,
        color: "#f07561",
        borderColor: "#f07561",
        ownerName: "Stale bad cache",
        areaSquareMeters: 100000,
        landRegions: [staleRegion],
        contourRegions: [staleRegion],
      }],
    };

    return new Promise((resolve) => {
      const request = indexedDB.open("hermes-territory-cache", 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("territory-polygons")) {
          db.createObjectStore("territory-polygons", { keyPath: "key" });
        }
        if (!db.objectStoreNames.contains("territory-render")) {
          db.createObjectStore("territory-render", { keyPath: "key" });
        }
      };
      request.onerror = () => resolve({ seeded: false, error: "open-error" });
      request.onsuccess = () => {
        const db = request.result;
        const transaction = db.transaction(["territory-polygons", "territory-render"], "readwrite");
        transaction.objectStore("territory-polygons").delete(polygonKey);
        transaction.objectStore("territory-render").put({
          key: renderKey,
          version,
          savedAt: Date.now(),
          signature,
          data: renderData,
        });
        transaction.oncomplete = () => {
          db.close();
          localStorage.setItem(renderIndexKey, JSON.stringify({
            version,
            savedAt: Date.now(),
            signature,
          }));
          resolve({ seeded: true, renderIndexKey, renderKey, polygonKey });
        };
        transaction.onerror = () => {
          db.close();
          resolve({ seeded: false, error: "transaction-error" });
        };
      };
    });
  }, { token, email, version: cacheVersion, signature: staleSignature });
}

async function readStaleCacheState(page) {
  return page.evaluate(async ({ signature }) => {
    const staleElements = Array.from(document.querySelectorAll('[data-hermes-owner-key="stale-owner"]'));
    const accountEmail = String(localStorage.getItem("hermes_email") || "").trim().toLowerCase();
    const accountKey = accountEmail ? encodeURIComponent(accountEmail) : "";
    const indexKey = `hermes_territory_render_index_${accountKey}`;
    let renderIndex = null;
    try {
      renderIndex = JSON.parse(localStorage.getItem(indexKey) || "null");
    } catch {
      renderIndex = { parseError: true };
    }

    const renderEntry = await new Promise((resolve) => {
      const request = indexedDB.open("hermes-territory-cache", 2);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("territory-render")) {
          db.close();
          resolve(null);
          return;
        }
        const renderRequest = db.transaction("territory-render", "readonly")
          .objectStore("territory-render")
          .get(`render:${accountKey}:${signature}`);
        renderRequest.onsuccess = () => {
          db.close();
          resolve(renderRequest.result || null);
        };
        renderRequest.onerror = () => {
          db.close();
          resolve(null);
        };
      };
    });

    return {
      staleElementCount: staleElements.length,
      renderIndexSignature: renderIndex?.signature || "",
      renderEntryPresent: Boolean(renderEntry),
      activeConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--active").length,
      activeContour: document.querySelectorAll(".terr-land-mask-contour--active").length,
    };
  }, { signature: staleSignature });
}

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, deviceScaleFactor: 1 });
const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));

try {
  const loginData = await login();
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  const seeded = await seedStaleRenderCache(page, loginData.token, loginData.email || sharedEmail);
  assert(seeded.seeded, `Failed to seed stale render cache: ${JSON.stringify(seeded)}`);

  let polygonRequestCount = 0;
  await page.route("**/api/territory/polygons**", async (route) => {
    polygonRequestCount += 1;
    if (polygonRequestCount === 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
    if (simulateEmptyPolygonResponse) {
      await route.fulfill({
        status: 200,
        headers: {
          "Content-Type": "application/json",
          "X-Hermes-Territory-Polygon-Signature": "land-mask-union-v53-mask-v29-enclosed-run-territory|empty:0",
        },
        body: JSON.stringify({
          polygons: [],
          polygonCount: 0,
          activePolygonCount: 0,
          totalAreaSquareMeters: 0,
          activeAreaSquareMeters: 0,
          backfillInProgress: false,
          pendingActivityCount: 0,
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto(new URL("/territory?proof=stale-cache-clear", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap, { timeout: 20_000 });
  await page.waitForFunction(() => document.querySelector('[data-hermes-owner-key="stale-owner"]'), { timeout: 10_000 });
  const beforeRefresh = await readStaleCacheState(page);
  await page.waitForFunction(() => !document.querySelector('[data-hermes-owner-key="stale-owner"]'), { timeout: 10_000 });
  await page.waitForTimeout(250);
  const afterRefresh = await readStaleCacheState(page);

  assert(polygonRequestCount > 0, "Territory page did not request /api/territory/polygons after cached render hydration.");
  assert(beforeRefresh.staleElementCount > 0, `Seeded stale render did not paint before refresh: ${JSON.stringify(beforeRefresh)}`);
  assert(afterRefresh.staleElementCount === 0, `Stale render still painted after fresh polygon response: ${JSON.stringify(afterRefresh)}`);
  assert(afterRefresh.renderIndexSignature !== staleSignature, `Stale render index survived: ${JSON.stringify(afterRefresh)}`);
  assert(!afterRefresh.renderEntryPresent, `Stale IndexedDB render entry survived: ${JSON.stringify(afterRefresh)}`);
  assert(
    !consoleErrors.some((entry) => /RangeError|Maximum call stack|TypeError|ReferenceError/i.test(entry)),
    `Console/page errors during stale-cache proof: ${consoleErrors.join("\n")}`,
  );

  console.log(JSON.stringify({
    ok: true,
    simulatedEmptyPolygonResponse: simulateEmptyPolygonResponse,
    polygonRequestCount,
    beforeRefresh,
    afterRefresh,
  }, null, 2));
} finally {
  await browser.close();
}
