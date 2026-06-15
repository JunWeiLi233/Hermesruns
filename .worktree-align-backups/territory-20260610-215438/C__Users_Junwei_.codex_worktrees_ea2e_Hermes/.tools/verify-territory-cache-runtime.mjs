import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-cache-proof.jpg"));
const cacheVersion = readArg("--cache-version", "global-owner-territory-cache-v82-mask-v21-response-16m");
const maxCachedPaintMs = Number(readArg("--max-cached-paint-ms", "2000"));
const sharedEmail = readArg("--email", process.env.APP_LOCAL_SHARED_RUNNER_EMAIL || "strava+140971747@hermes.local");
const sharedPassword = readArg("--password", process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "HermesDev2026!");
const stravaAutoSyncSessionKey = "hermes_strava_auto_sync_at";

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForCondition(predicate, timeoutMs, label) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await sleep(25);
  }
  throw new Error(`Timed out waiting for ${label}.`);
}

async function readMapTileCoverage(page) {
  return page.evaluate(() => {
    const mapElement = document.querySelector(".terr-leaflet-map");
    if (!mapElement) {
      return { mapPresent: false, tileCount: 0, loadedTileCount: 0, sampleCoverage: 0 };
    }

    const mapRect = mapElement.getBoundingClientRect();
    const loadedTileRects = Array.from(mapElement.querySelectorAll(".leaflet-tile"))
      .filter((tile) => {
        const rect = tile.getBoundingClientRect();
        const style = getComputedStyle(tile);
        return rect.width > 0
          && rect.height > 0
          && style.display !== "none"
          && style.visibility !== "hidden"
          && Number(style.opacity || 1) > 0
          && tile.complete !== false
          && (tile.naturalWidth || 0) > 0;
      })
      .map((tile) => {
        const rect = tile.getBoundingClientRect();
        return {
          left: Math.max(rect.left, mapRect.left),
          right: Math.min(rect.right, mapRect.right),
          top: Math.max(rect.top, mapRect.top),
          bottom: Math.min(rect.bottom, mapRect.bottom),
        };
      })
      .filter((rect) => rect.left < rect.right && rect.top < rect.bottom);

    const columns = 8;
    const rows = 6;
    let coveredSamples = 0;
    const totalSamples = columns * rows;
    for (let row = 0; row < rows; row += 1) {
      const y = mapRect.top + (mapRect.height * (row + 0.5)) / rows;
      for (let column = 0; column < columns; column += 1) {
        const x = mapRect.left + (mapRect.width * (column + 0.5)) / columns;
        if (loadedTileRects.some((rect) => (
          x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom
        ))) {
          coveredSamples += 1;
        }
      }
    }

    return {
      mapPresent: true,
      tileCount: mapElement.querySelectorAll(".leaflet-tile").length,
      loadedTileCount: loadedTileRects.length,
      sampleCoverage: totalSamples > 0 ? coveredSamples / totalSamples : 0,
      width: Math.round(mapRect.width),
      height: Math.round(mapRect.height),
    };
  });
}

async function waitForMapTileCoverage(page) {
  let latestTileProof = null;
  await waitForCondition(async () => {
    latestTileProof = await readMapTileCoverage(page);
    return Boolean(
      latestTileProof.mapPresent
      && latestTileProof.loadedTileCount >= 12
      && latestTileProof.sampleCoverage >= 0.85,
    );
  }, 5_000, "cached map tile coverage before screenshot");
  return latestTileProof;
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

async function waitForCacheReady(page) {
  await waitForCondition(async () => {
    const state = await readCacheState(page);
    const shellReady = state.shellEntries.some((entry) => entry.current && entry.hasData);
    return Boolean(
      shellReady
      && state.renderIndex?.current
      && state.indexedState?.render?.current,
    );
  }, 60_000, "current territory shell and render cache");
}

async function readTerritoryPaintProof(page) {
  return page.evaluate(() => {
    const q = (selector) => Array.from(document.querySelectorAll(selector));
    const activeConcretePathData = q(".terr-land-mask-concrete-land--active")[0]?.getAttribute("d") || "";
    return {
      activeConcrete: q(".terr-land-mask-concrete-land--active").length,
      activeContour: q(".terr-land-mask-contour--active").length,
      activeConcreteMoveCommandCount: (activeConcretePathData.match(/M/g) || []).length,
      rivalConcrete: q(".terr-land-mask-concrete-land--rival").length,
      rivalContour: q(".terr-land-mask-contour--rival").length,
    };
  });
}

async function deleteCachedPolygonPayload(page) {
  return page.evaluate(async () => {
    const accountEmail = String(localStorage.getItem("hermes_email") || "").trim().toLowerCase();
    const accountKey = accountEmail ? encodeURIComponent(accountEmail) : "";
    if (!accountKey) return { deleted: false, error: "missing-account-key" };

    return new Promise((resolve) => {
      const request = indexedDB.open("hermes-territory-cache", 2);
      request.onerror = () => resolve({ deleted: false, error: "open-error" });
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("territory-polygons")) {
          db.close();
          resolve({ deleted: false, error: "missing-polygon-store" });
          return;
        }
        const key = `polygons:${accountKey}`;
        const transaction = db.transaction("territory-polygons", "readwrite");
        transaction.objectStore("territory-polygons").delete(key);
        transaction.oncomplete = () => {
          db.close();
          resolve({ deleted: true, key });
        };
        transaction.onerror = () => {
          db.close();
          resolve({ deleted: false, key, error: "delete-error" });
        };
      };
    });
  });
}

async function readCacheState(page) {
  return page.evaluate(async (expectedCacheVersion) => {
    const accountEmail = String(localStorage.getItem("hermes_email") || "").trim().toLowerCase();
    const accountKey = accountEmail ? encodeURIComponent(accountEmail) : "";
    let renderIndex = null;
    try {
      const entry = JSON.parse(localStorage.getItem(`hermes_territory_render_index_${accountKey}`) || "null");
      renderIndex = {
        version: entry?.version ?? null,
        current: entry?.version === expectedCacheVersion,
        signature: entry?.signature ?? null,
      };
    } catch {
      renderIndex = { version: "parse-error", current: false, signature: null };
    }
    const shellEntries = Object.keys(localStorage)
      .filter((key) => key.startsWith("hermes_territory_shell_"))
      .map((key) => {
        try {
          const entry = JSON.parse(localStorage.getItem(key) || "null");
          return {
            key,
            version: entry?.version ?? null,
            current: entry?.version === expectedCacheVersion,
            hasData: Boolean(entry?.data),
          };
        } catch {
          return { key, version: "parse-error", current: false, hasData: false };
        }
      });

    const indexedState = await new Promise((resolve) => {
      if (!accountKey) {
        resolve({ open: false, error: "missing-account-key" });
        return;
      }
      const request = indexedDB.open("hermes-territory-cache", 2);
      request.onerror = () => resolve({ open: false, error: "open-error" });
      request.onsuccess = () => {
        const db = request.result;
        const storeNames = Array.from(db.objectStoreNames);
        if (!storeNames.includes("territory-polygons") || !storeNames.includes("territory-render")) {
          db.close();
          resolve({ open: true, storeNames });
          return;
        }

        const countRegions = (entries, key) => (
          Array.isArray(entries)
            ? entries.reduce((sum, renderEntry) => sum + (Array.isArray(renderEntry?.[key]) ? renderEntry[key].length : 0), 0)
            : undefined
        );
        const summarizeEntry = (entry) => ({
          key: entry?.key ?? null,
          version: entry?.version ?? null,
          current: entry?.version === expectedCacheVersion,
          signature: entry?.signature ?? null,
          polygonCount: Array.isArray(entry?.data?.polygons) ? entry.data.polygons.length : undefined,
          allCoordCount: Array.isArray(entry?.data?.allCoords) ? entry.data.allCoords.length : undefined,
          contourEntryCount: Array.isArray(entry?.data?.contourRenderEntries) ? entry.data.contourRenderEntries.length : undefined,
          previewEntryCount: Array.isArray(entry?.data?.previewContourRenderEntries) ? entry.data.previewContourRenderEntries.length : undefined,
          fullLandRegionCount: countRegions(entry?.data?.contourRenderEntries, "landRegions"),
          previewLandRegionCount: countRegions(entry?.data?.previewContourRenderEntries, "landRegions"),
          fullContourRegionCount: countRegions(entry?.data?.contourRenderEntries, "contourRegions"),
          previewContourRegionCount: countRegions(entry?.data?.previewContourRenderEntries, "contourRegions"),
        });

        const transaction = db.transaction(["territory-polygons", "territory-render"], "readonly");
        const polygonRequest = transaction.objectStore("territory-polygons").get(`polygons:${accountKey}`);
        polygonRequest.onsuccess = () => {
          const polygonEntry = polygonRequest.result;
          const renderSignature = polygonEntry?.signature || renderIndex?.signature || "";
          const renderKey = renderSignature ? `render:${accountKey}:${renderSignature}` : "";
          if (!renderKey) {
            resolve({
              open: true,
              storeNames,
              polygon: summarizeEntry(polygonEntry),
              render: null,
            });
            return;
          }
          const renderRequest = transaction.objectStore("territory-render").get(renderKey);
          renderRequest.onsuccess = () => {
            resolve({
              open: true,
              storeNames,
              polygon: summarizeEntry(polygonEntry),
              render: summarizeEntry(renderRequest.result),
            });
          };
          renderRequest.onerror = () => resolve({ open: true, storeNames, error: "render-getall-error" });
        };
        polygonRequest.onerror = () => resolve({ open: true, storeNames, error: "polygon-getall-error" });
        transaction.oncomplete = () => db.close();
      };
    });

    return { shellEntries, renderIndex, indexedState };
  }, cacheVersion);
}

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const loginData = await login();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const consoleErrors = [];
const authSeed = { token: loginData.token, email: loginData.email || sharedEmail, stravaAutoSyncSessionKey };

async function seedPageAuth(page) {
  await page.addInitScript(({ token, email, stravaAutoSyncSessionKey }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem(stravaAutoSyncSessionKey, String(Date.now()));
  }, authSeed);
}

try {
  await context.addInitScript(({ token, email, stravaAutoSyncSessionKey }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem(stravaAutoSyncSessionKey, String(Date.now()));
  }, authSeed);

  const primePage = await context.newPage();
  await seedPageAuth(primePage);
  primePage.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  primePage.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));
  await primePage.goto(new URL("/territory?proof=cache-prime", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  try {
    await primePage.waitForFunction(() => (
      document.querySelectorAll(".terr-land-mask-concrete-land").length > 0
    ), { timeout: 30_000 });
  } catch (error) {
    const debug = await primePage.evaluate(async () => {
      const token = localStorage.getItem("hermes_jwt");
      const summarizeApiPayload = (pathname, data) => {
        if (pathname.endsWith("/polygons")) {
          return {
            polygonCount: Array.isArray(data?.polygons) ? data.polygons.length : 0,
            warming: Boolean(data?.warming),
            version: data?.version ?? null,
          };
        }
        if (pathname.endsWith("/territory")) {
          return {
            hasSummary: Boolean(data?.summary),
            hasCenter: Boolean(data?.center),
            ownerCount: Array.isArray(data?.owners) ? data.owners.length : 0,
          };
        }
        if (pathname.endsWith("/profile/me")) {
          return {
            email: data?.email ?? null,
            displayName: data?.displayName ?? data?.name ?? null,
          };
        }
        return null;
      };
      const api = async (pathname) => {
        const response = await fetch(pathname, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        }).catch((fetchError) => ({ ok: false, status: "fetch-error", error: String(fetchError) }));
        if (!response?.json) return response;
        const data = await response.json().catch(() => null);
        return { ok: response.ok, status: response.status, summary: summarizeApiPayload(pathname, data) };
      };
      return {
        url: window.location.href,
        tokenPresent: Boolean(token),
        email: localStorage.getItem("hermes_email"),
        bodyText: document.body?.innerText?.slice(0, 500) || "",
        loadingPage: Boolean(document.querySelector(".territory-loading-page")),
        mapPresent: Boolean(document.querySelector(".terr-leaflet-map")),
        activeConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--active").length,
        rivalConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--rival").length,
        profile: await api("/api/profile/me"),
        territory: await api("/api/territory"),
        polygons: await api("/api/territory/polygons"),
      };
    });
    console.log(JSON.stringify({ primeFailureDebug: debug }, null, 2));
    throw error;
  }
  const primedPaintProof = await readTerritoryPaintProof(primePage);
  const expectsActivePaint = primedPaintProof.activeConcrete > 0;
  const expectsRivalPaint = primedPaintProof.rivalConcrete > 0;
  assert(
    expectsActivePaint || expectsRivalPaint,
    `Prime visit rendered no concrete territory paths: ${JSON.stringify(primedPaintProof)}`,
  );
  try {
    await waitForCacheReady(primePage);
  } catch (error) {
    console.log(JSON.stringify({ cacheReadyFailureDebug: await readCacheState(primePage) }, null, 2));
    throw error;
  }
  const primedCacheState = await readCacheState(primePage);
  assert(
    primedCacheState.indexedState?.render?.fullLandRegionCount >= primedCacheState.indexedState?.render?.previewLandRegionCount,
    `Full cached render should preserve at least as much land geometry as preview: ${JSON.stringify(primedCacheState.indexedState?.render)}`,
  );
  const polygonDeletion = await deleteCachedPolygonPayload(primePage);
  assert(
    polygonDeletion.deleted,
    `Failed to remove raw polygon cache before cached render replay: ${JSON.stringify(polygonDeletion)}`,
  );
  await primePage.close();

  const cachedPage = await context.newPage();
  await seedPageAuth(cachedPage);
  cachedPage.on("console", (msg) => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
  });
  cachedPage.on("pageerror", (error) => consoleErrors.push(error?.message || String(error)));

  let shellBlocked = false;
  let polygonConditionalRevalidation = false;
  let polygonFullDownloadAttempted = false;
  let polygonRevalidationSignature = "";
  let releaseShell = null;
  await cachedPage.route("**/api/territory**", async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname === "/api/territory") {
      shellBlocked = true;
      await new Promise((resolve) => { releaseShell = resolve; });
    } else if (pathname === "/api/territory/polygons") {
      const headers = route.request().headers();
      const ifNoneMatch = String(headers["if-none-match"] || "").trim();
      if (ifNoneMatch) {
        polygonConditionalRevalidation = true;
        polygonRevalidationSignature = ifNoneMatch;
        await route.fulfill({
          status: 304,
          headers: {
            ETag: ifNoneMatch,
            "X-Hermes-Territory-Polygon-Signature": ifNoneMatch.replace(/^W\//, "").replace(/^"|"$/g, ""),
          },
          body: "",
        });
        return;
      }
      polygonFullDownloadAttempted = true;
    }
    await route.continue();
  });

  const cachedVisitStartedAt = Date.now();
  await cachedPage.goto(new URL("/territory?proof=cache-revisit", baseUrl).toString(), {
    waitUntil: "domcontentloaded",
    timeout: 20_000,
  });
  await waitForCondition(() => shellBlocked, 5_000, "blocked /api/territory shell request");
  await cachedPage.waitForFunction(() => (
    document.querySelectorAll(".terr-land-mask-concrete-land").length > 0
  ), { timeout: 5_000 });
  const cachedPaintMs = Date.now() - cachedVisitStartedAt;

  const cachedProof = await cachedPage.evaluate(async (expectedCacheVersion) => {
    const q = (selector) => Array.from(document.querySelectorAll(selector));
    const accountEmail = String(localStorage.getItem("hermes_email") || "").trim().toLowerCase();
    const accountKey = accountEmail ? encodeURIComponent(accountEmail) : "";
    let renderIndexCurrent = false;
    let rawPolygonCachePresent = null;
    try {
      const renderIndex = JSON.parse(localStorage.getItem(`hermes_territory_render_index_${accountKey}`) || "null");
      renderIndexCurrent = renderIndex?.version === expectedCacheVersion && Boolean(renderIndex?.signature);
    } catch {
      renderIndexCurrent = false;
    }
    rawPolygonCachePresent = await new Promise((resolve) => {
      if (!accountKey) {
        resolve(null);
        return;
      }
      const request = indexedDB.open("hermes-territory-cache", 2);
      request.onerror = () => resolve(null);
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("territory-polygons")) {
          db.close();
          resolve(null);
          return;
        }
        const transaction = db.transaction("territory-polygons", "readonly");
        const polygonRequest = transaction.objectStore("territory-polygons").get(`polygons:${accountKey}`);
        polygonRequest.onsuccess = () => resolve(Boolean(polygonRequest.result));
        polygonRequest.onerror = () => resolve(null);
        transaction.oncomplete = () => db.close();
      };
    });
    const activeConcretePathData = q(".terr-land-mask-concrete-land--active")[0]?.getAttribute("d") || "";
    return {
      activeConcrete: q(".terr-land-mask-concrete-land--active").length,
      activeContour: q(".terr-land-mask-contour--active").length,
      activeConcreteMoveCommandCount: (activeConcretePathData.match(/M/g) || []).length,
      rivalConcrete: q(".terr-land-mask-concrete-land--rival").length,
      rivalContour: q(".terr-land-mask-contour--rival").length,
      rivalOwnerNames: [...new Set(q(".terr-land-mask-concrete-land--rival")
        .map((element) => element.dataset.hermesOwnerName)
        .filter(Boolean))].sort(),
      shellCacheKeys: Object.keys(localStorage).filter((key) => key.startsWith("hermes_territory_shell_")).length,
      versionedShellCacheKeys: Object.keys(localStorage).filter((key) => {
        if (!key.startsWith("hermes_territory_shell_")) return false;
        try {
          return JSON.parse(localStorage.getItem(key) || "null")?.version === expectedCacheVersion;
        } catch {
          return false;
        }
      }).length,
      renderIndexCurrent,
      rawPolygonCachePresent,
      mapZoom: document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap?.getZoom?.() ?? null,
      tileFilter: getComputedStyle(document.querySelector(".territory-real-world-tile") || document.querySelector(".leaflet-tile"))?.filter || null,
    };
  }, cacheVersion);

  assert(
    cachedProof.activeConcrete + cachedProof.rivalConcrete > 0,
    "Cached revisit rendered no concrete land before shell API release.",
  );
  assert(
    cachedProof.activeContour + cachedProof.rivalContour > 0,
    "Cached revisit rendered no contour before shell API release.",
  );
  if (expectsActivePaint) {
    assert(cachedProof.activeConcrete > 0, "Cached revisit rendered no active concrete land before shell API release.");
    assert(cachedProof.activeContour > 0, "Cached revisit rendered no active contour before shell API release.");
    assert(
      cachedProof.activeConcrete <= 4,
      `Cached revisit rendered active territory as broken pieces: ${cachedProof.activeConcrete} active concrete paths.`,
    );
    assert(
      cachedProof.activeContour <= 4,
      `Cached revisit rendered active territory contours as broken pieces: ${cachedProof.activeContour} active contour paths.`,
    );
    assert(
      cachedProof.activeConcreteMoveCommandCount <= 160,
      `Cached revisit rendered active territory as too many subpath crumbs: M commands=${cachedProof.activeConcreteMoveCommandCount}.`,
    );
  }
  if (expectsRivalPaint) {
    assert(cachedProof.rivalConcrete > 0, "Cached revisit rendered no rival concrete before shell API release.");
    assert(cachedProof.rivalContour > 0, "Cached revisit rendered no rival contour before shell API release.");
  }
  assert(cachedProof.versionedShellCacheKeys > 0, "No current-version cached territory shell key was present on revisit.");
  assert(cachedProof.renderIndexCurrent === true, "Cached revisit did not use a current latest-render index.");
  assert(cachedProof.rawPolygonCachePresent === false, "Cached revisit still had the bulky raw polygon cache; compact render replay was not isolated.");
  assert(cachedProof.tileFilter === "none", `Cached revisit map tiles are filtered/blurred: ${cachedProof.tileFilter}`);
  assert(
    !Number.isFinite(maxCachedPaintMs) || cachedPaintMs <= maxCachedPaintMs,
    `Cached revisit painted in ${cachedPaintMs}ms, above the ${maxCachedPaintMs}ms budget.`,
  );

  const cachedTileProof = await waitForMapTileCoverage(cachedPage);
  await cachedPage.screenshot({ path: screenshotPath, fullPage: false });

  releaseShell?.();
  await waitForCondition(
    () => polygonConditionalRevalidation || polygonFullDownloadAttempted,
    8_000,
    "background conditional /api/territory/polygons revalidation request",
  );
  assert(
    polygonFullDownloadAttempted,
    "Cached revisit did not request the bounded initial polygon payload after render-only cached paint.",
  );
  assert(
    polygonConditionalRevalidation === false,
    "Cached revisit used render-only cache to authorize a conditional polygon 304 after the raw polygon cache was deleted.",
  );
  await cachedPage.waitForTimeout(750);
  assert(consoleErrors.length === 0, `Console errors during Territory cache proof: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    email: sharedEmail,
    shellBlockedBeforePaint: shellBlocked,
    polygonConditionalRevalidationAfterPaint: polygonConditionalRevalidation,
    polygonRevalidationSignature,
    polygonFullDownloadAttempted,
    rawPolygonCacheDeletedBeforeRevisit: polygonDeletion.deleted,
    cachedPaintMs,
    primedCacheState,
    primedPaintProof,
    proof: cachedProof,
    tileProof: cachedTileProof,
    screenshot: path.relative(root, screenshotPath).replaceAll("\\", "/"),
  }, null, 2));
} finally {
  await browser.close();
}
