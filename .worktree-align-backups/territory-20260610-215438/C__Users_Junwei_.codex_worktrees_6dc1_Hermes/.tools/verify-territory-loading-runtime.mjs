#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-heatmap-startup-loading-proof.jpg"));
const sharedEmail = readArg("--email", "strava+140971747@hermes.local");

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

function readConfiguredSharedPassword() {
  if (process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD) {
    return process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD;
  }
  const candidates = ["Hermes.local.env.ps1", "Hermes.local.env.example.ps1", ".env.example"];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) {
      continue;
    }
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

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch (error) {
    throw new Error(`Playwright is not installed or not resolvable: ${error?.message || error}`);
  }
}

async function login() {
  const password = readConfiguredSharedPassword();
  assert(password, "No local shared-runner password is configured in env or example files.");

  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: sharedEmail, password }),
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `Shared-account login failed: ${response.status} ${JSON.stringify(data)}`);
  assert(data?.token, `Shared-account login did not return a token: ${JSON.stringify(data)}`);
  return data;
}

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const auth = await login();
const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
const consoleErrors = [];

page.on("console", (msg) => {
  if (msg.type() === "error") {
    consoleErrors.push(msg.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(error?.message || String(error));
});

let releaseTerritoryShell;
let delayedShellRequest = false;
const shellRequestReleased = new Promise((resolve) => {
  releaseTerritoryShell = resolve;
});

try {
  await page.route("**/api/territory**", async (route) => {
    const requestUrl = new URL(route.request().url());
    if (requestUrl.pathname === "/api/territory" && !delayedShellRequest) {
      delayedShellRequest = true;
      await shellRequestReleased;
    }
    await route.continue();
  });

  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.evaluate(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_role", "USER");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: auth.token, email: auth.email || sharedEmail });

  await page.goto(new URL("/territory", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForSelector(".territory-loading-page .heatmap-page-empty", { timeout: 10_000 });
  await page.waitForTimeout(250);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const proof = await page.evaluate(() => {
    const q = (selector) => document.querySelector(selector);
    const box = (selector) => {
      const element = q(selector);
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const textOf = (selector) => q(selector)?.textContent?.trim() || "";
    const root = q(".territory-loading-page");
    const search = q(".territory-loading-page .heatmap-page-search-pill");
    return {
      url: window.location.href,
      loadingPage: Boolean(root),
      ariaBusy: root?.getAttribute("aria-busy") || null,
      heatmapShell: Boolean(q(".territory-loading-page .heatmap-page-map-shell")),
      heatmapCanvas: Boolean(q(".territory-loading-page .heatmap-page-map-canvas")),
      heatmapVignette: Boolean(q(".territory-loading-page .heatmap-page-map-vignette")),
      heatmapTopbar: Boolean(q(".territory-loading-page .heatmap-page-topbar")),
      heatmapBrand: Boolean(q(".territory-loading-page .heatmap-page-brand-pill")),
      heatmapSearch: Boolean(search),
      heatmapSearchDisabled: Boolean(search?.hasAttribute("disabled")),
      heatmapActions: Boolean(q(".territory-loading-page .heatmap-page-action-strip")),
      heatmapEmpty: Boolean(q(".territory-loading-page .heatmap-page-empty")),
      loadingTitle: textOf(".territory-loading-page .heatmap-page-empty-copy h3"),
      loadingKicker: textOf(".territory-loading-page .heatmap-page-card-kicker"),
      customRouteLoading: Boolean(q(".territory-route-loading, .territory-loading-stage, .territory-page--loading")),
      territoryMapMounted: Boolean(q(".territory-page.territory-heatmap-outline")),
      canvasBox: box(".territory-loading-page .heatmap-page-map-canvas"),
      emptyBox: box(".territory-loading-page .heatmap-page-empty"),
      topbarBox: box(".territory-loading-page .heatmap-page-topbar"),
    };
  });

  assert(delayedShellRequest, "The verifier did not intercept and delay /api/territory.");
  assert(proof.loadingPage, "Territory startup did not render the loading page.");
  assert(proof.ariaBusy === "true", `Territory loading page should be aria-busy=true: ${proof.ariaBusy}`);
  assert(proof.heatmapShell, "Territory loading page is missing Heatmap map shell.");
  assert(proof.heatmapCanvas, "Territory loading page is missing Heatmap map canvas.");
  assert(proof.heatmapVignette, "Territory loading page is missing Heatmap vignette node.");
  assert(proof.heatmapTopbar, "Territory loading page is missing Heatmap topbar.");
  assert(proof.heatmapBrand, "Territory loading page is missing Heatmap brand pill.");
  assert(proof.heatmapSearch, "Territory loading page is missing Heatmap search/recenter pill.");
  assert(proof.heatmapSearchDisabled, "Territory loading search/recenter pill should be disabled during startup.");
  assert(proof.heatmapActions, "Territory loading page is missing Heatmap action strip.");
  assert(proof.heatmapEmpty, "Territory loading page is missing Heatmap empty/loading card.");
  assert(/loading|载入|加载/i.test(proof.loadingTitle), `Unexpected loading title: ${proof.loadingTitle}`);
  assert(!proof.customRouteLoading, "Territory rendered a custom loading shell instead of the Heatmap loading page.");
  assert(!proof.territoryMapMounted, "Territory map shell mounted before initial territory data finished loading.");
  assert(proof.canvasBox?.height > 600, `Heatmap loading canvas should fill the viewport: ${JSON.stringify(proof.canvasBox)}`);
  assert(proof.emptyBox?.width > 600 && proof.emptyBox?.height > 600, `Heatmap loading card should occupy the page shell: ${JSON.stringify(proof.emptyBox)}`);
  assert(proof.topbarBox?.width > 600, `Heatmap loading topbar should span the page shell: ${JSON.stringify(proof.topbarBox)}`);
  assert(consoleErrors.length === 0, `Console errors during loading proof: ${consoleErrors.join(" | ")}`);

  releaseTerritoryShell();
  await page.waitForSelector(".territory-page.territory-heatmap-outline", { timeout: 20_000 }).catch(() => {});

  console.log(JSON.stringify({
    ok: true,
    screenshot: screenshotPath,
    consoleErrorCount: consoleErrors.length,
    proof,
  }, null, 2));
} finally {
  releaseTerritoryShell?.();
  await browser.close().catch(() => {});
}
