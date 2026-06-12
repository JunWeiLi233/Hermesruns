#!/usr/bin/env node
// One-shot: log in, navigate to /analysis/intensity, screenshot full + viewport.
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
  await page.goto("http://localhost:8080/analysis/intensity", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const structure = await page.evaluate(() => {
    const root = document.querySelector(".analysis-insight-detail-page.is-intensity");
    return {
      url: location.href,
      title: document.querySelector("h1")?.innerText,
      hasRoot: !!root,
      topLevelChildren: root ? Array.from(root.children).map((c) => ({
        tag: c.tagName.toLowerCase(),
        cls: c.className,
      })) : [],
      intensityCmdSections: Array.from(document.querySelectorAll("[class*='analysis-intensity-command-']")).map((el) => ({
        cls: el.className,
        rect: el.getBoundingClientRect().toJSON(),
      })).slice(0, 12),
    };
  });

  const outViewport = path.join(OUT_DIR, "intensity-viewport.jpg");
  await page.screenshot({ path: outViewport, type: "jpeg", quality: 82, fullPage: false });
  const outFull = path.join(OUT_DIR, "intensity-full.jpg");
  await page.screenshot({ path: outFull, type: "jpeg", quality: 80, fullPage: true });
  console.log(JSON.stringify({ ok: true, structure, outViewport, outFull }, null, 2));
} finally {
  await context.close();
}
