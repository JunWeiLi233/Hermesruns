#!/usr/bin/env node
// One-shot: log in, navigate to /profile, screenshot the cockpit + reference grid.
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

  await page.goto("http://localhost:8080/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  if (/\/(login|signin)\b/.test(page.url())) {
    const emailEl = await page.$("input[type=email]");
    const passEl = await page.$("input[type=password]");
    await emailEl.click();
    await page.keyboard.type("strava+140971747@hermes.local", { delay: 20 });
    await passEl.click();
    await page.keyboard.type((process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password"), { delay: 20 });
    const submitBtn = await page.$("button[type=submit]");
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u), { timeout: 12000 }).catch(() => {}),
      submitBtn.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  }

  await page.goto("http://localhost:8080/profile", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Find the cockpit + reference grid
  const geom = await page.evaluate(() => {
    const cockpit = document.querySelector(
      ".runner-dashboard-brand-carousel.runner-dashboard-coach-cockpit.runner-dashboard-profile-purpose-cockpit.runner-dashboard-profile-dossier"
    );
    const prescription = document.querySelector(".runner-dashboard-coach-prescription-stats");
    const refGrid = document.querySelector(".runner-dashboard-profile-reference-grid");
    const refCards = Array.from(document.querySelectorAll(".runner-dashboard-profile-reference-card"));
    const pick = (el) => el ? {
      rect: el.getBoundingClientRect().toJSON(),
      textAlign: getComputedStyle(el).textAlign,
      display: getComputedStyle(el).display,
      justify: getComputedStyle(el).justifyContent,
      align: getComputedStyle(el).alignItems,
    } : null;
    return {
      url: location.href,
      cockpit: pick(cockpit),
      prescription: pick(prescription),
      refGrid: pick(refGrid),
      refCards: refCards.map((c, i) => ({ i, ...pick(c), cls: c.className })),
    };
  });

  // Scroll cockpit into view, then screenshot
  await page.evaluate(() => {
    const el = document.querySelector(".runner-dashboard-coach-prescription-stats");
    if (el) el.scrollIntoView({ block: "center" });
  });
  await page.waitForTimeout(400);

  const out = path.join(OUT_DIR, "profile-cockpit-before.jpg");
  await page.screenshot({ path: out, type: "jpeg", quality: 80, fullPage: false });
  const out2 = path.join(OUT_DIR, "profile-cockpit-full.jpg");
  await page.screenshot({ path: out2, type: "jpeg", quality: 80, fullPage: true });
  console.log(JSON.stringify({ ok: true, geom, out, out2 }, null, 2));
} finally {
  await context.close();
}
