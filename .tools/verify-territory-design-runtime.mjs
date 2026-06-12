#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const requestedBaseUrl = readArg("--url", "http://localhost:8080");
const baseUrl = normalizeLoopbackUrl(requestedBaseUrl);
const screenshotPath = resolveRootPath(readArg("--screenshot", "task-images/territory-design-runtime-proof.jpg"));
const sharedEmail = readArg("--email", "strava+140971747@hermes.local");

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function resolveRootPath(value) {
  return path.isAbsolute(value) ? value : path.join(root, value);
}

function normalizeLoopbackUrl(value) {
  const url = new URL(value);
  if (url.hostname === "localhost") {
    url.hostname = "127.0.0.1";
  }
  return url.toString().replace(/\/$/, "");
}

function readConfiguredSharedPassword() {
  if (process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD) {
    return process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD;
  }
  if (process.env.HERMES_VERIFY_PASSWORD) {
    return process.env.HERMES_VERIFY_PASSWORD;
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
  return "HermesDev2026!";
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

const sharedPassword = readConfiguredSharedPassword();
assert(sharedPassword, "No local shared-runner password is configured in env or local example files.");
fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });

const { chromium } = await loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 960 }, deviceScaleFactor: 1 });
page.setDefaultTimeout(30_000);

const consoleErrors = [];
page.on("console", (message) => {
  if (message.type() === "error") {
    consoleErrors.push(message.text());
  }
});
page.on("pageerror", (error) => {
  consoleErrors.push(error?.message || String(error));
});

try {
  const login = await page.request.post(`${baseUrl}/api/auth/login`, {
    data: { email: sharedEmail, password: sharedPassword },
  });
  const loginBody = await login.json().catch(() => ({}));
  assert(login.ok() && loginBody.token, `login failed for design proof: HTTP ${login.status()}`);

  await page.addInitScript(({ token, email }) => {
    localStorage.setItem("hermes_jwt", token);
    localStorage.setItem("hermes_email", email);
    localStorage.setItem("hermes_role", "USER");
    localStorage.setItem("hermes_lang", "zh-CN");
    sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));
  }, { token: loginBody.token, email: loginBody.email || sharedEmail });

  await page.goto(`${baseUrl}/territory?proof=design-runtime`, { waitUntil: "domcontentloaded", timeout: 30_000 });
  await page.waitForFunction(() => (
    document.querySelector(".terr-leaflet-map")?.__hermesTerritoryMap
    && document.querySelectorAll(".terr-scope-button").length === 2
  ), { timeout: 45_000 });
  await page.waitForTimeout(750);
  await page.screenshot({ path: screenshotPath, fullPage: false });

  const proof = await page.evaluate(() => {
    const q = (selector) => Array.from(document.querySelectorAll(selector));
    const box = (element) => {
      const rect = element?.getBoundingClientRect?.();
      if (!rect) {
        return null;
      }
      return {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        right: Math.round(rect.right),
        bottom: Math.round(rect.bottom),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
    };
    const styleSummary = (element) => {
      const style = element ? getComputedStyle(element) : null;
      return style ? {
        color: style.color,
        background: style.background,
        opacity: style.opacity,
        display: style.display,
        visibility: style.visibility,
      } : null;
    };

    const switcher = document.querySelector(".terr-scope-switcher");
    const switcherBox = box(switcher);
    const buttons = q(".terr-scope-button").map((button) => ({
      text: button.textContent.replace(/\s+/g, " ").trim(),
      ariaPressed: button.getAttribute("aria-pressed"),
      disabled: button.hasAttribute("disabled"),
      className: button.className,
      box: box(button),
      style: styleSummary(button),
    }));
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    const switcherCenterDelta = switcherBox
      ? Math.abs((switcherBox.x + (switcherBox.width / 2)) - (viewport.width / 2))
      : Number.POSITIVE_INFINITY;

    return {
      url: location.href,
      viewport,
      legacyMarkup: q(".terr-game-hud, .terr-game-territory-dock, .terr-theme-navigator, .terr-game-campaign-panel").length,
      mapTileCount: q(".leaflet-tile-loaded").length,
      activeConcreteCount: q(".terr-land-mask-concrete-land--active").length,
      activeContourCount: q(".terr-land-mask-contour--active").length,
      switcher: {
        box: switcherBox,
        style: styleSummary(switcher),
        centerDelta: Math.round(switcherCenterDelta),
      },
      buttons,
    };
  });

  const blockingConsoleErrors = consoleErrors.filter((message) => !/ERR_NO_BUFFER_SPACE|favicon/i.test(message));
  assert(blockingConsoleErrors.length === 0, `blocking console errors during design proof: ${JSON.stringify(blockingConsoleErrors)}`);
  assert(proof.legacyMarkup === 0, `legacy territory game or theme navigator markup is still present: ${JSON.stringify(proof)}`);
  assert(proof.mapTileCount > 0, `territory map tiles did not load: ${JSON.stringify(proof)}`);
  assert(proof.switcher.box?.width >= 360 && proof.switcher.box?.height >= 56, `own/global switcher is not large enough to read: ${JSON.stringify(proof.switcher)}`);
  assert(proof.switcher.centerDelta <= 12, `own/global switcher is not centered over the territory map: ${JSON.stringify(proof.switcher)}`);
  assert(proof.buttons.length === 2, `expected exactly two territory scope buttons: ${JSON.stringify(proof.buttons)}`);
  proof.buttons.forEach((button) => {
    assert(button.text.length > 0, `scope button has no readable label: ${JSON.stringify(button)}`);
    assert(button.box?.width >= 170 && button.box?.height >= 48, `scope button is too small: ${JSON.stringify(button)}`);
    assert(button.style?.visibility !== "hidden" && button.style?.display !== "none", `scope button is hidden: ${JSON.stringify(button)}`);
  });

  console.log(JSON.stringify({
    ok: true,
    screenshot: screenshotPath,
    consoleErrorCount: consoleErrors.length,
    ignoredConsoleErrors: consoleErrors.length - blockingConsoleErrors.length,
    proof,
  }, null, 2));
} finally {
  await browser.close();
}
