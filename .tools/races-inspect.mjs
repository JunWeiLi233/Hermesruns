import path from "node:path";
import fs from "node:fs";
const REPO_ROOT = path.resolve(".");
const STATE_DIR = path.join(REPO_ROOT, ".ai-sync", "playwright-state", "default");
const EMAIL = "strava+140971747@hermes.local";
const PASSWORD = process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password";
const { chromium } = await import("playwright");
const ctx = await chromium.launchPersistentContext(STATE_DIR, { headless: true, viewport: { width: 1440, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
async function ensureLoggedIn() {
  await page.goto("http://localhost:8080/races", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1200);
  if (!/\/races/.test(page.url())) {
    // redirected to /login
    await page.goto("http://localhost:8080/login", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForSelector("#email", { timeout: 8000 });
    await page.fill("#email", EMAIL);
    await page.fill("#password", PASSWORD);
    await page.click("button[type='submit']");
    await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000);
    await page.goto("http://localhost:8080/races", { waitUntil: "domcontentloaded", timeout: 20000 });
    await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(2000);
  }
}
try {
  await ensureLoggedIn();
  const info = await page.evaluate(() => {
    const main = document.querySelector("main") || document.body;
    const sections = Array.from(main.querySelectorAll(":scope *"))
      .filter(el => {
        const c = el.className?.toString() || "";
        return /race-center-/.test(c) && el.getBoundingClientRect().height > 40;
      })
      .slice(0, 60)
      .map(el => ({
        tag: el.tagName.toLowerCase(),
        cls: el.className.toString().slice(0, 120),
        height: Math.round(el.getBoundingClientRect().height),
        firstHeadingText: el.querySelector("h1, h2, h3, h4")?.innerText?.slice(0, 60) || "",
      }));
    return {
      url: location.href,
      scrollHeight: document.documentElement.scrollHeight,
      viewportHeight: window.innerHeight,
      discoveryCards: document.querySelectorAll(".race-center-card").length,
      filterChipGroups: document.querySelectorAll(".race-center-filter-group").length,
      filterChips: document.querySelectorAll(".race-center-filter-chip").length,
      savedRaceCards: document.querySelectorAll("[class*='race-center-saved']").length,
      personalBestCards: document.querySelectorAll("[class*='race-center-pb']").length,
      h1: document.querySelector("h1")?.innerText?.slice(0, 80) || "",
      sections,
    };
  });
  console.log(JSON.stringify(info, null, 2));
  fs.mkdirSync("task-images", { recursive: true });
  await page.screenshot({ path: "task-images/races-current-desktop.jpg", type: "jpeg", quality: 80, fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: "task-images/races-current-mobile.jpg", type: "jpeg", quality: 80, fullPage: true });
  console.log("screenshots ok");
} catch (e) {
  console.error("FAIL", e?.message || e);
  process.exitCode = 1;
} finally {
  await ctx.close();
}
