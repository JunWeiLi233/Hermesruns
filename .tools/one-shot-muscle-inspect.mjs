#!/usr/bin/env node
// One-shot: login as the mock runner, navigate to /muscle-training, inspect
// the rendered muscle masks + anatomy image, capture a screenshot showing
// every mask active so we can see how they align with the PNG.
// Writes JSON inspection result to stdout + screenshot to disk.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(REPO_ROOT, ".ai-sync", "playwright-state", "default");
const OUT_DIR = path.join(REPO_ROOT, "task-images");

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const { chromium } = await import("playwright");

const context = await chromium.launchPersistentContext(STATE_DIR, {
  headless: true,
  viewport: { width: 1920, height: 1080 },
});

try {
  const page = context.pages()[0] || (await context.newPage());

  console.error("Navigating to /login…");
  await page.goto("http://localhost:8080/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  // Check if we're already authenticated (was redirected to dashboard/profile?).
  let currentUrl = page.url();
  if (/\/(login|signin)\b/.test(currentUrl)) {
    console.error("On login page; filling credentials…");
    // Try several common selectors
    const emailSel = ["input[type=email]", "input[name=email]", "input[placeholder*='mail' i]", "input[id*='mail' i]"];
    const passSel = ["input[type=password]"];
    let emailEl = null, passEl = null;
    for (const s of emailSel) { emailEl = await page.$(s); if (emailEl) break; }
    for (const s of passSel) { passEl = await page.$(s); if (passEl) break; }
    if (!emailEl || !passEl) {
      const inputs = await page.$$eval("input", (els) => els.map((e) => ({ type: e.type, name: e.name, placeholder: e.placeholder, id: e.id })));
      console.error("Inputs found:", JSON.stringify(inputs));
      throw new Error("Could not locate email/password inputs.");
    }
    // Use type instead of fill so React's onChange fires per keystroke.
    await emailEl.click();
    await page.keyboard.type("strava+140971747@hermes.local", { delay: 20 });
    await passEl.click();
    await page.keyboard.type((process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password"), { delay: 20 });
    await page.waitForTimeout(200);
    // Click the submit button (we know it's button[type=submit] with text "登录")
    const submitBtn = await page.$("button[type=submit]");
    if (!submitBtn) throw new Error("No submit button found.");
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u), { timeout: 12000 }).catch(() => {}),
      submitBtn.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    currentUrl = page.url();
    console.error("After submit:", currentUrl);
  } else {
    console.error("Already authenticated, currentUrl=", currentUrl);
  }

  console.error("Navigating to /muscle-training…");
  await page.goto("http://localhost:8080/muscle-training", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});

  // Give React a moment to render
  await page.waitForTimeout(2000);

  // Force every region active so we can see all highlights at once
  await page.evaluate(() => {
    document.querySelectorAll(".mt-muscle-pixel-fill").forEach((el) => {
      el.classList.add("is-active", "is-focused");
    });
  });
  await page.waitForTimeout(400);

  // Capture inspection data
  const inspection = await page.evaluate(() => {
    const svg = document.querySelector(".muscle-map-figure, .mt-body-measure-svg");
    const svgBox = svg?.getBoundingClientRect();
    const vb = svg?.viewBox?.baseVal;
    const anteriorImg = document.querySelector('image.mt-body-reference-image[href*="anterior"]');
    const posteriorImg = document.querySelector('image.mt-body-reference-image[href*="posterior"]');
    const fills = Array.from(document.querySelectorAll(".mt-muscle-pixel-fill"));
    const fillStats = fills.map((el) => {
      const cp = el.getAttribute("clip-path") || "";
      const region = el.getAttribute("data-region") || "";
      const clipId = cp.match(/url\(#([^)]+)\)/)?.[1] || "";
      const clipPath = clipId ? document.getElementById(clipId) : null;
      const pathEl = clipPath?.querySelector("path");
      const d = pathEl?.getAttribute("d") || "";
      let bbox = null;
      try {
        if (pathEl) {
          const b = pathEl.getBBox();
          bbox = { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
        }
      } catch (e) {}
      return { region, clipId, dLen: d.length, bbox };
    });
    return {
      url: location.href,
      anatomyAnterior: anteriorImg ? { x: anteriorImg.getAttribute("x"), y: anteriorImg.getAttribute("y"), w: anteriorImg.getAttribute("width"), h: anteriorImg.getAttribute("height") } : null,
      anatomyPosterior: posteriorImg ? { x: posteriorImg.getAttribute("x"), y: posteriorImg.getAttribute("y"), w: posteriorImg.getAttribute("width"), h: posteriorImg.getAttribute("height") } : null,
      svgViewBox: vb ? { w: vb.width, h: vb.height } : null,
      pixelFillCount: fills.length,
      fillsByRegion: fillStats,
    };
  });

  const outPath = path.join(OUT_DIR, "muscle-inspect-all-active.jpg");
  await page.screenshot({ path: outPath, type: "jpeg", quality: 82 });

  console.log(JSON.stringify({ ok: true, inspection, screenshotPath: outPath }, null, 2));
} catch (e) {
  console.error("ERROR:", e.message);
  console.log(JSON.stringify({ ok: false, error: e.message, stack: e.stack }, null, 2));
  process.exit(1);
} finally {
  await context.close().catch(() => {});
}
