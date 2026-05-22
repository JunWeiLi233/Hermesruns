#!/usr/bin/env node
// One-shot inspect: login as the mock runner, navigate to /shoes/add,
// dump the list of brands + the set of models for the newly added
// brands (Karhu, Diadora) and the new series (LunarGlide, Beast, Jazz,
// 990, Wave Prophecy, Premier, Charged Bandit, DS Trainer, Tarther).

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
    const emailEl = await page.$("input[type=email], input[id=email]");
    const passEl = await page.$("input[type=password]");
    if (!emailEl || !passEl) throw new Error("login inputs missing");
    await emailEl.click();
    await page.keyboard.type("strava+140971747@hermes.local", { delay: 18 });
    await passEl.click();
    await page.keyboard.type((process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password"), { delay: 18 });
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u), { timeout: 12000 }).catch(() => {}),
      page.click("button[type=submit]"),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  }

  await page.goto("http://localhost:8080/shoes/add", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2000);

  // Click "show more brands" to expand the full brand list (if collapsed).
  await page.evaluate(() => {
    const showMore = Array.from(document.querySelectorAll("button")).find((b) => /展开更多|更多品牌|Show more|More brands/i.test(b.textContent || ""));
    if (showMore) showMore.click();
  });
  await page.waitForTimeout(800);

  // Catalog is loaded into memory regardless of which brand is selected.
  // Read it from the React props by inspecting the entire DOM's accessible
  // brand+model index.
  const inspection = await page.evaluate(async () => {
    // The merged catalog is rendered into the brand grid + (per-brand) the model
    // grid. Walk every brand tile, click it, snapshot its models, restore.
    const result = { brands: {}, totalsByBrand: {} };
    const brandButtons = Array.from(document.querySelectorAll("[class*='brand' i] button, button[class*='brand' i]"))
      .filter((b) => !/展开|更多|返回|Show|More|Back/i.test(b.textContent || ""));
    // Fallback: any clickable card-like element with a logo
    const candidates = brandButtons.length
      ? brandButtons
      : Array.from(document.querySelectorAll("button")).filter((b) => /\d+\s*个型号|models?/i.test(b.textContent || ""));
    for (const btn of candidates) {
      const brandLabel = (btn.innerText || btn.textContent || "").replace(/\s+/g, " ").trim();
      try { btn.click(); } catch { continue; }
      // Wait briefly for re-render
      await new Promise((r) => setTimeout(r, 220));
      const modelTiles = Array.from(document.querySelectorAll("[class*='model' i], [data-model]"))
        .map((el) => (el.querySelector("strong, h3, h4, [class*='name' i]")?.innerText || el.innerText || "").trim().split("\n")[0])
        .filter(Boolean);
      result.brands[brandLabel] = modelTiles.slice(0, 100);
      result.totalsByBrand[brandLabel] = modelTiles.length;
    }
    return result;
  });

  // Now check expected entries against discovered model lists
  const allTexts = Object.values(inspection.brands).flat().join("\n").toLowerCase();
  const allBrandLabels = Object.keys(inspection.brands).join("\n");
  const expectBrands = ["Karhu", "Diadora"];
  const brandsFound = expectBrands.filter((b) => allBrandLabels.includes(b));
  const expectSeries = [
    ["Nike", "LunarGlide"], ["Nike", "Air Span"],
    ["Adidas", "Supernova Sequence"], ["Adidas", "Cosmic"],
    ["New Balance", "990"], ["New Balance", "991"], ["New Balance", "993"], ["New Balance", "670"], ["New Balance", "410"],
    ["Saucony", "Jazz"], ["Saucony", "Omni"], ["Saucony", "Echelon"],
    ["Brooks", "Beast"], ["Brooks", "Ariel"],
    ["Mizuno", "Wave Prophecy"],
    ["Reebok", "Premier"], ["Reebok", "DMX Run"],
    ["Under Armour", "Charged Bandit"], ["Under Armour", "SpeedForm"],
    ["ASICS", "DS Trainer"], ["ASICS", "Tarther"],
    ["Karhu", "Fusion"], ["Karhu", "Mestari"], ["Karhu", "Aria"], ["Karhu", "Ikoni"], ["Karhu", "Synchron"],
    ["Diadora", "Mythos"], ["Diadora", "Equipe"], ["Diadora", "Atomo"],
  ];
  const seriesMissing = expectSeries.filter(([, s]) => !allTexts.includes(s.toLowerCase()));
  const summary = {
    url: page.url(),
    brandsDiscovered: Object.keys(inspection.brands).length,
    totalsByBrand: inspection.totalsByBrand,
    brandsFound,
    brandsMissing: expectBrands.filter((b) => !brandsFound.includes(b)),
    seriesFoundCount: expectSeries.length - seriesMissing.length,
    seriesMissingCount: seriesMissing.length,
    seriesMissing: seriesMissing.map(([b, s]) => `${b}/${s}`),
  };

  const outShot = path.join(OUT_DIR, "shoes-add-after-catalog-add.jpg");
  await page.screenshot({ path: outShot, type: "jpeg", quality: 78, fullPage: true });

  console.log(JSON.stringify({ ok: true, summary, screenshotPath: outShot }, null, 2));
} catch (e) {
  console.log(JSON.stringify({ ok: false, error: e.message }, null, 2));
  process.exit(1);
} finally {
  await context.close().catch(() => {});
}
