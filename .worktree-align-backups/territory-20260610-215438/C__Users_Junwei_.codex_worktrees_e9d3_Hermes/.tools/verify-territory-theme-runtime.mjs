#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-scope-inspector-proof.jpg"));
const sharedEmail = readArg("--email", process.env.APP_LOCAL_SHARED_RUNNER_EMAIL || "strava+140971747@hermes.local");

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

function ownerKey(source, index) {
  if (source?.ownerId !== null && source?.ownerId !== undefined) {
    return `owner:${source.ownerId}`;
  }
  const ownerName = String(source?.ownerName || "").trim().toLowerCase();
  if (ownerName) {
    return `owner-name:${ownerName}`;
  }
  const color = /^#[0-9a-f]{6}$/i.test(String(source?.color || "")) ? source.color : "#f07561";
  return `owner-color:${color}:${source?.active ? "active" : "rival"}:${index}`;
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

async function fetchPolygons(token) {
  const response = await fetch(new URL("/api/territory/polygons", baseUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `Polygon endpoint failed: ${response.status} ${JSON.stringify(data)}`);
  return Array.isArray(data?.polygons) ? data.polygons : [];
}

fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const auth = await login();
const polygons = await fetchPolygons(auth.token);
const ownerMap = new Map();
polygons.forEach((polygon, index) => {
  const key = ownerKey(polygon, index);
  if (!ownerMap.has(key)) {
    ownerMap.set(key, {
      key,
      name: String(polygon?.ownerName || "").trim(),
      active: Boolean(polygon?.active),
    });
  }
});
const expectedOwners = Array.from(ownerMap.values());
const activeOwnerCount = expectedOwners.filter((owner) => owner.active).length;
assert(expectedOwners.length >= 1, "Scope proof needs at least one owner polygon.");
assert(activeOwnerCount >= 1, `Scope proof needs an active owner, got ${activeOwnerCount}.`);

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

try {
  await page.goto(new URL("/login", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.evaluate(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_role", "USER");
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: auth.token, email: auth.email || sharedEmail });

  await page.goto(new URL("/territory", baseUrl).toString(), { waitUntil: "domcontentloaded", timeout: 20_000 });
  await page.waitForFunction((ownerCount) => {
    const scopeButtons = document.querySelectorAll(".terr-scope-button");
    return scopeButtons.length === 2
      && document.querySelector(".terr-scope-switcher")
      && document.querySelectorAll(".terr-land-mask-concrete-land").length > 0
      && document.querySelectorAll(".terr-land-mask-contour").length > 0
      && document.querySelectorAll("[data-hermes-owner-key]").length >= ownerCount;
  }, expectedOwners.length, { timeout: 30_000 });
  await page.waitForTimeout(650);

  const initialProof = await page.evaluate(() => {
    const ownerKeys = Array.from(new Set(Array.from(document.querySelectorAll(".terr-land-mask-concrete-land, .terr-land-mask-contour"))
      .map((node) => node.dataset.hermesOwnerKey)
      .filter(Boolean)));
    const scopeButtons = Array.from(document.querySelectorAll(".terr-scope-button")).map((button) => {
      const rect = button.getBoundingClientRect();
      const swatch = button.querySelector(".terr-scope-swatch");
      const swatchRect = swatch?.getBoundingClientRect();
      return {
        className: button.className,
        text: button.textContent.trim(),
        ariaPressed: button.getAttribute("aria-pressed"),
        disabled: button.hasAttribute("disabled"),
        visible: rect.width > 0 && rect.height > 0,
        swatchVisible: Boolean(swatchRect && swatchRect.width >= 16 && swatchRect.height >= 16),
      };
    });
    return {
      switcherVisible: Boolean(document.querySelector(".terr-scope-switcher")),
      scopeButtonCount: scopeButtons.length,
      ownPressed: document.querySelector(".terr-scope-button--own")?.getAttribute("aria-pressed") || "",
      ownDisabled: document.querySelector(".terr-scope-button--own")?.hasAttribute("disabled") || false,
      globalPressed: document.querySelector(".terr-scope-button--global")?.getAttribute("aria-pressed") || "",
      selectedPaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected").length,
      dimmedPaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-dimmed, .terr-land-mask-contour--theme-dimmed").length,
      allThemePaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-all, .terr-land-mask-contour--theme-all").length,
      activeConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--active").length,
      activeContour: document.querySelectorAll(".terr-land-mask-contour--active").length,
      rivalConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--rival").length,
      ownerPathKeys: ownerKeys,
      scopeButtons,
    };
  });

  assert(initialProof.switcherVisible, "Territory scope switcher is not visible.");
  assert(initialProof.scopeButtonCount === 2, `Territory should expose exactly Own and Global scope buttons: ${JSON.stringify(initialProof)}`);
  assert(initialProof.ownPressed === "true", `Own scope should be selected initially for the active account: ${JSON.stringify(initialProof)}`);
  assert(initialProof.ownDisabled === false, `Own scope should be available when active owner polygons exist: ${JSON.stringify(initialProof)}`);
  assert(initialProof.globalPressed === "false", `Global scope should not be selected initially: ${JSON.stringify(initialProof)}`);
  assert(initialProof.selectedPaths > 0, `Own scope should focus the active owner layers: ${JSON.stringify(initialProof)}`);
  assert(initialProof.activeConcrete > 0 && initialProof.activeContour > 0, `Active owner land and contour layers should render: ${JSON.stringify(initialProof)}`);
  assert(initialProof.ownerPathKeys.length >= 1, `Map paths should carry stable owner keys: ${JSON.stringify(initialProof.ownerPathKeys)}`);
  assert(initialProof.scopeButtons.every((button) => button.visible && button.swatchVisible), `Every scope button should be visible with a swatch: ${JSON.stringify(initialProof.scopeButtons)}`);

  await page.locator(".terr-scope-button--global").click();
  await page.waitForFunction(() => {
    return document.querySelector(".terr-scope-button--global")?.getAttribute("aria-pressed") === "true"
      && document.querySelector(".terr-scope-button--own")?.getAttribute("aria-pressed") === "false"
      && document.querySelectorAll(".terr-land-mask-concrete-land--theme-all, .terr-land-mask-contour--theme-all").length > 0
      && document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected").length === 0;
  }, { timeout: 10_000 });

  const globalProof = await page.evaluate(() => ({
    ownPressed: document.querySelector(".terr-scope-button--own")?.getAttribute("aria-pressed") || "",
    globalPressed: document.querySelector(".terr-scope-button--global")?.getAttribute("aria-pressed") || "",
    allThemePaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-all, .terr-land-mask-contour--theme-all").length,
    selectedPaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected").length,
    dimmedPaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-dimmed, .terr-land-mask-contour--theme-dimmed").length,
    activeConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--active").length,
    rivalConcrete: document.querySelectorAll(".terr-land-mask-concrete-land--rival").length,
  }));

  assert(globalProof.globalPressed === "true" && globalProof.ownPressed === "false", `Global scope button state did not update: ${JSON.stringify(globalProof)}`);
  assert(globalProof.allThemePaths > 0, `Global scope should mark rendered owner layers as theme-all: ${JSON.stringify(globalProof)}`);
  assert(globalProof.selectedPaths === 0, `Global scope should clear owner-specific selected classes: ${JSON.stringify(globalProof)}`);
  assert(globalProof.activeConcrete > 0, `Global scope should preserve active land rendering: ${JSON.stringify(globalProof)}`);

  await page.locator(".terr-scope-button--own").click();
  await page.waitForFunction(() => {
    return document.querySelector(".terr-scope-button--own")?.getAttribute("aria-pressed") === "true"
      && document.querySelector(".terr-scope-button--global")?.getAttribute("aria-pressed") === "false"
      && document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected").length > 0;
  }, { timeout: 10_000 });

  const clickedOwnerPathProof = await page.evaluate(() => {
    const path = document.querySelector(".terr-land-mask-concrete-land--active")
      || document.querySelector(".terr-land-mask-concrete-land");
    if (!path) {
      return { clicked: false };
    }
    const rect = path.getBoundingClientRect();
    path.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      clientX: rect.left + Math.max(2, rect.width / 2),
      clientY: rect.top + Math.max(2, rect.height / 2),
      view: window,
    }));
    return {
      clicked: true,
      ownerKey: path.dataset.hermesOwnerKey || "",
      ownerLabel: path.dataset.hermesOwnerLabel || "",
      role: path.getAttribute("role") || "",
      tabIndex: path.getAttribute("tabindex") || "",
      ariaLabel: path.getAttribute("aria-label") || "",
    };
  });
  assert(clickedOwnerPathProof.clicked, "No rendered territory path was available to click.");
  assert(clickedOwnerPathProof.ownerKey, `Clicked territory path did not expose an owner key: ${JSON.stringify(clickedOwnerPathProof)}`);
  assert(clickedOwnerPathProof.role === "button", `Clicked territory path should expose button semantics: ${JSON.stringify(clickedOwnerPathProof)}`);
  assert(clickedOwnerPathProof.tabIndex === "0", `Clicked territory path should be keyboard-focusable: ${JSON.stringify(clickedOwnerPathProof)}`);
  assert(clickedOwnerPathProof.ariaLabel, `Clicked territory path should expose an owner aria label: ${JSON.stringify(clickedOwnerPathProof)}`);

  await page.waitForSelector(".terr-owner-inspector", { state: "visible", timeout: 10_000 });
  await page.waitForFunction((ownerKey) => {
    const panel = document.querySelector(".terr-owner-inspector");
    const selectedPath = Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected"))
      .some((node) => node.dataset.hermesOwnerKey === ownerKey);
    return Boolean(panel && selectedPath);
  }, clickedOwnerPathProof.ownerKey, { timeout: 10_000 });

  const ownerInspectorProof = await page.evaluate((ownerKey) => {
    const panel = document.querySelector(".terr-owner-inspector");
    const rowEntries = Array.from(panel?.querySelectorAll(".terr-owner-inspector-grid div") || []).map((row) => ({
      label: row.querySelector("dt")?.textContent?.trim() || "",
      value: row.querySelector("dd")?.textContent?.trim() || "",
    }));
    return {
      visible: Boolean(panel),
      ariaLabel: panel?.getAttribute("aria-label") || "",
      title: panel?.querySelector(".terr-owner-inspector-title strong")?.textContent?.trim() || "",
      kicker: panel?.querySelector(".terr-owner-inspector-title small")?.textContent?.trim() || "",
      selectedPaths: Array.from(document.querySelectorAll(".terr-land-mask-concrete-land--theme-selected, .terr-land-mask-contour--theme-selected"))
        .filter((node) => node.dataset.hermesOwnerKey === ownerKey).length,
      dimmedPaths: document.querySelectorAll(".terr-land-mask-concrete-land--theme-dimmed, .terr-land-mask-contour--theme-dimmed").length,
      rows: rowEntries,
      closeLabel: panel?.querySelector(".terr-owner-inspector-close")?.getAttribute("aria-label") || "",
    };
  }, clickedOwnerPathProof.ownerKey);

  assert(ownerInspectorProof.visible, `Owner inspector did not render after territory click: ${JSON.stringify(ownerInspectorProof)}`);
  assert(ownerInspectorProof.title, `Owner inspector should show the clicked owner username: ${JSON.stringify(ownerInspectorProof)}`);
  assert(ownerInspectorProof.ariaLabel.includes(ownerInspectorProof.title), `Owner inspector aria label should include the owner title: ${JSON.stringify(ownerInspectorProof)}`);
  assert(ownerInspectorProof.selectedPaths > 0, `Territory click should focus the clicked owner's rendered paths: ${JSON.stringify(ownerInspectorProof)}`);
  assert(ownerInspectorProof.closeLabel, `Owner inspector close button should be labelled: ${JSON.stringify(ownerInspectorProof)}`);
  assert(ownerInspectorProof.rows.length >= 4, `Owner inspector should include ownership detail rows: ${JSON.stringify(ownerInspectorProof.rows)}`);
  assert(ownerInspectorProof.rows.every((entry) => entry.label && entry.value), `Owner inspector rows should have labels and values: ${JSON.stringify(ownerInspectorProof.rows)}`);

  await page.screenshot({ path: screenshotPath, fullPage: false });
  await page.locator(".terr-owner-inspector-close").click();
  await page.waitForFunction(() => !document.querySelector(".terr-owner-inspector"), { timeout: 10_000 });

  assert(consoleErrors.length === 0, `Console errors during scope/inspector proof: ${consoleErrors.join(" | ")}`);

  console.log(JSON.stringify({
    ok: true,
    screenshot: screenshotPath,
    expectedOwnerCount: expectedOwners.length,
    activeOwnerCount,
    initialProof,
    globalProof,
    clickedOwnerPathProof,
    ownerInspectorProof,
    consoleErrorCount: consoleErrors.length,
  }, null, 2));
} finally {
  await browser.close().catch(() => {});
}
