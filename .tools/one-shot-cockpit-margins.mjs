#!/usr/bin/env node
// Inspect the computed margins of the two grids to understand why margin-top
// might not be shifting them.
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(REPO_ROOT, ".ai-sync", "playwright-state", "default");

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
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const dump = await page.evaluate(() => {
    const prescription = document.querySelector(".runner-dashboard-coach-prescription-stats");
    const refGrid = document.querySelector(".runner-dashboard-profile-reference-grid");
    const cockpit = document.querySelector(".runner-dashboard-profile-purpose-cockpit");
    const isCockpitInTree = (el) => {
      let cur = el;
      while (cur) {
        if (cur === cockpit) return true;
        cur = cur.parentElement;
      }
      return false;
    };
    const pick = (el) => el ? {
      cs_marginTop: getComputedStyle(el).marginTop,
      cs_paddingTop: getComputedStyle(el).paddingTop,
      cs_display: getComputedStyle(el).display,
      rect_top: el.getBoundingClientRect().top,
      inCockpit: isCockpitInTree(el),
    } : null;
    // Walk up the DOM from prescription to find its layout parent
    let p = prescription;
    const ancestry = [];
    for (let i = 0; p && i < 8; i++, p = p.parentElement) {
      ancestry.push({
        tag: p.tagName.toLowerCase(),
        cls: p.className,
        cs_marginTop: getComputedStyle(p).marginTop,
        cs_display: getComputedStyle(p).display,
        cs_gap: getComputedStyle(p).rowGap || getComputedStyle(p).gap,
      });
    }
    return {
      prescription: pick(prescription),
      refGrid: pick(refGrid),
      cockpit: { className: cockpit ? cockpit.className : null },
      ancestry,
    };
  });
  console.log(JSON.stringify(dump, null, 2));
} finally {
  await context.close();
}
