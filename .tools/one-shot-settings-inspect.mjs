#!/usr/bin/env node
// One-shot: log in as the mock runner, navigate to /settings, capture a
// full-page screenshot so we can confirm the edge-to-edge canvas pass.
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
    if (!emailEl || !passEl) throw new Error("Login inputs not found");
    await emailEl.click();
    await page.keyboard.type("strava+140971747@hermes.local", { delay: 20 });
    await passEl.click();
    await page.keyboard.type((process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password"), { delay: 20 });
    const submitBtn = await page.$("button[type=submit]");
    if (!submitBtn) throw new Error("No submit button");
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u), { timeout: 12000 }).catch(() => {}),
      submitBtn.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  }

  await page.goto("http://localhost:8080/settings", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(1500);

  const observed = await page.evaluate(() => {
    const canvas = document.querySelector(".settings-control-page .settings-control-canvas");
    const atlas = document.querySelector(".settings-control-page .settings-atlas-canvas");
    const main = document.querySelector(".runner-shell-main");
    const sidebar = document.querySelector(".runner-shell-sidebar");
    const pick = (el) => el ? {
      rect: el.getBoundingClientRect().toJSON(),
      paddingLeft: getComputedStyle(el).paddingLeft,
      paddingRight: getComputedStyle(el).paddingRight,
      marginLeft: getComputedStyle(el).marginLeft,
      marginRight: getComputedStyle(el).marginRight,
      width: getComputedStyle(el).width,
    } : null;
    return {
      url: location.href,
      viewport: { w: window.innerWidth, h: window.innerHeight },
      canvas: pick(canvas),
      atlas: pick(atlas),
      main: pick(main),
      sidebar: pick(sidebar),
    };
  });

  const outPath = path.join(OUT_DIR, "settings-edge-to-edge.jpg");
  await page.screenshot({ path: outPath, type: "jpeg", quality: 80, fullPage: false });
  console.log(JSON.stringify({ ok: true, out: outPath, observed }, null, 2));
} finally {
  await context.close();
}
