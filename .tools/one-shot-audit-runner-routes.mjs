#!/usr/bin/env node
// One-shot: audit every runner-facing route in the live local Hermes app.
// Logs in via the API to set the auth token, then visits each route, captures
// a screenshot + DOM metrics, and writes a single JSON line per route.
//
// Designed for /auto-hermes-max explorer audit. Headless. No source edits.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const STATE_DIR = path.join(REPO_ROOT, ".ai-sync", "playwright-state", "default");
const OUT_DIR = path.join(REPO_ROOT, "task-images");

fs.mkdirSync(STATE_DIR, { recursive: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const RUN_ID = process.argv[2] || "841";
const ROUTES = [
  { slug: "profile",         path: "/profile" },
  { slug: "today-run",       path: "/today-run" },
  { slug: "runs",            path: "/runs" },
  { slug: "run-detail",      path: `/run/${RUN_ID}` },
  { slug: "analysis",        path: "/analysis" },
  { slug: "analysis-vo2max", path: "/analysis/vo2max" },
  { slug: "heatmap",         path: "/heatmap" },
  { slug: "shoes",           path: "/shoes" },
  { slug: "shoes-add",       path: "/shoes/add" },
  { slug: "shoe-catalog",    path: "/shoe-catalog" },
  { slug: "races",           path: "/races" },
  { slug: "schedule",        path: "/schedule" },
  { slug: "muscle-training", path: "/muscle-training" },
  { slug: "rewards",         path: "/rewards" },
  { slug: "settings",        path: "/settings" },
];

const { chromium } = await import("playwright");

const context = await chromium.launchPersistentContext(STATE_DIR, {
  headless: true,
  viewport: { width: 1440, height: 900 },
});

const allResults = [];

try {
  const page = context.pages()[0] || (await context.newPage());

  // Login
  console.error("Logging in…");
  await page.goto("http://localhost:8080/login", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});

  if (/\/(login|signin)\b/.test(page.url())) {
    const emailEl = await page.$("input[type=email]");
    const passEl = await page.$("input[type=password]");
    if (!emailEl || !passEl) throw new Error("Could not locate login inputs");
    await emailEl.click();
    await page.keyboard.type("strava+140971747@hermes.local", { delay: 15 });
    await passEl.click();
    await page.keyboard.type((process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD || "local-test-password"), { delay: 15 });
    const submitBtn = await page.$("button[type=submit]");
    await Promise.all([
      page.waitForURL((u) => !/\/login\b/.test(u), { timeout: 15000 }).catch(() => {}),
      submitBtn.click(),
    ]);
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
  }
  console.error("Auth done, currentUrl=", page.url());

  for (const route of ROUTES) {
    const url = `http://localhost:8080${route.path}`;
    console.error(`\n== ${route.slug} (${route.path}) ==`);

    const consoleErrors = [];
    const errListener = (msg) => { if (msg.type() === "error") consoleErrors.push(msg.text().slice(0, 200)); };
    const pageErrListener = (e) => consoleErrors.push("pageerror: " + String(e?.message || e).slice(0, 200));
    page.on("console", errListener);
    page.on("pageerror", pageErrListener);

    let nav = { ok: true };
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(2500);
    } catch (e) {
      nav = { ok: false, error: String(e?.message || e).slice(0, 200) };
    }

    const finalUrl = page.url();
    const redirectedToLogin = /\/(login|signin)\b/.test(finalUrl);

    let metrics = {};
    try {
      metrics = await page.evaluate(() => {
        const txt = (sel) => document.querySelector(sel)?.innerText?.trim().slice(0, 200) || null;
        const cardSel = [
          ".card", "[class*='card']", "[class*='Card']",
          "section", "article", "[class*='panel']", "[class*='tile']",
        ];
        const cards = new Set();
        cardSel.forEach((s) => document.querySelectorAll(s).forEach((el) => cards.add(el)));
        const ctaBtns = Array.from(document.querySelectorAll("button, a")).filter((el) => {
          const r = el.getBoundingClientRect();
          if (r.width < 40 || r.height < 18) return false;
          const t = (el.innerText || "").trim();
          return t.length > 0 && t.length < 80;
        });
        const h1 = document.querySelector("h1")?.innerText?.trim() || null;
        const h2 = Array.from(document.querySelectorAll("h2")).slice(0, 5).map((e) => e.innerText.trim().slice(0, 80));
        const bodyText = document.body.innerText.replace(/\s+/g, " ").slice(0, 600);
        // Overflow heuristics
        const docW = document.documentElement.scrollWidth;
        const docH = document.documentElement.scrollHeight;
        const viewportW = window.innerWidth;
        const horizontalOverflow = docW > viewportW + 2;
        // Detect loading / empty / error sentinels
        const lc = bodyText.toLowerCase();
        const looksLoading = /loading|加载|加载中|正在加载/.test(bodyText) && cards.size < 3;
        const looksEmpty = /no data|empty|no runs|暂无|尚无/.test(bodyText) && cards.size < 3;
        const looksError = /error|出错|失败|something went wrong/i.test(bodyText) && cards.size < 3;
        // Token usage check
        const rootStyles = getComputedStyle(document.documentElement);
        const coralVar = rootStyles.getPropertyValue("--color-coral") || rootStyles.getPropertyValue("--coral") || rootStyles.getPropertyValue("--accent") || "";
        // Generic-AI smell detection
        const allEls = Array.from(document.querySelectorAll("*")).slice(0, 1500);
        let purpleGradient = 0, grayOnColor = 0, nestedCards = 0, hollowMotion = 0;
        allEls.forEach((el) => {
          const cs = getComputedStyle(el);
          const bg = cs.backgroundImage || "";
          if (/purple|violet|#[68][0-9a-f]{2}f|#a[0-9a-f]{2}f/i.test(bg)) purpleGradient++;
          if (bg.includes("gradient") && /#[6-9][0-9a-f]{2}[a-f]|purple|indigo/i.test(bg)) purpleGradient++;
          const color = cs.color || "";
          const bgc = cs.backgroundColor || "";
          if (/rgb\(1[0-9]{2}, 1[0-9]{2}, 1[0-9]{2}\)/.test(color) && bgc !== "rgba(0, 0, 0, 0)" && bgc !== "transparent") grayOnColor++;
          const anim = cs.animationName;
          if (anim && anim !== "none" && el.children.length === 0) hollowMotion++;
        });
        // Nested cards: count cards inside cards
        cards.forEach((c) => {
          if (Array.from(cards).some((p) => p !== c && p.contains(c))) nestedCards++;
        });
        return {
          title: document.title,
          h1, h2, bodyTextPreview: bodyText.slice(0, 240),
          cardCount: cards.size,
          ctaCount: ctaBtns.length,
          docDimensions: { w: docW, h: docH, viewportW },
          horizontalOverflow,
          looksLoading, looksEmpty, looksError,
          coralTokenPresent: !!coralVar.trim(),
          smells: { purpleGradient, grayOnColor, nestedCards, hollowMotion },
        };
      });
    } catch (e) {
      metrics = { error: String(e?.message || e).slice(0, 200) };
    }

    const screenshotPath = path.join(OUT_DIR, `audit-${route.slug}.jpg`);
    let shotOk = false;
    try {
      await page.screenshot({ path: screenshotPath, type: "jpeg", quality: 78, fullPage: true });
      shotOk = true;
    } catch (e) {
      console.error("screenshot failed:", e.message);
    }

    // Mobile viewport pass
    let mobileMetrics = {};
    try {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(800);
      mobileMetrics = await page.evaluate(() => {
        const docW = document.documentElement.scrollWidth;
        const viewportW = window.innerWidth;
        return {
          docW, viewportW,
          horizontalOverflow: docW > viewportW + 2,
        };
      });
      const mobileShotPath = path.join(OUT_DIR, `audit-${route.slug}-mobile.jpg`);
      await page.screenshot({ path: mobileShotPath, type: "jpeg", quality: 75, fullPage: false });
    } catch (e) {
      mobileMetrics = { error: String(e?.message || e).slice(0, 100) };
    } finally {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.waitForTimeout(300);
    }

    page.off("console", errListener);
    page.off("pageerror", pageErrListener);

    allResults.push({
      slug: route.slug,
      path: route.path,
      finalUrl,
      redirectedToLogin,
      navOk: nav.ok,
      navError: nav.error || null,
      consoleErrorCount: consoleErrors.length,
      consoleErrorsSample: consoleErrors.slice(0, 5),
      metrics,
      mobileMetrics,
      screenshotPath: shotOk ? screenshotPath : null,
    });
    console.error(`  done. cards=${metrics.cardCount} ctas=${metrics.ctaCount} errors=${consoleErrors.length} h1="${metrics.h1?.slice(0,40)}"`);
  }

  process.stdout.write(JSON.stringify({ ok: true, results: allResults }, null, 2));
} catch (e) {
  console.error("ERROR:", e.message);
  process.stdout.write(JSON.stringify({ ok: false, error: e.message, stack: e.stack, partial: allResults }, null, 2));
  process.exit(1);
} finally {
  await context.close().catch(() => {});
}
