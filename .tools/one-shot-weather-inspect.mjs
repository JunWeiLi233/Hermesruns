#!/usr/bin/env node
// One-shot: log in, navigate to /weather-engine, dump a full-page screenshot
// plus a list of all text nodes with their computed colors + background hints
// so we can find unreadable copy.
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

  await page.goto("http://localhost:8080/weather-engine", { waitUntil: "domcontentloaded", timeout: 20000 });
  await page.waitForLoadState("networkidle", { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const lowContrast = await page.evaluate(() => {
    function getEffectiveBg(el) {
      let current = el;
      while (current && current !== document.documentElement) {
        const cs = getComputedStyle(current);
        if (cs.backgroundColor && cs.backgroundColor !== "rgba(0, 0, 0, 0)" && cs.backgroundColor !== "transparent") {
          return cs.backgroundColor;
        }
        current = current.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor || "rgb(255,255,255)";
    }
    function parseColor(c) {
      const m = c.match(/^rgba?\(([\d., ]+)\)$/);
      if (!m) return null;
      const [r, g, b] = m[1].split(",").map(Number);
      return { r, g, b };
    }
    function luminance({ r, g, b }) {
      const f = (v) => {
        const x = v / 255;
        return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
    }
    function contrast(a, b) {
      const La = luminance(a);
      const Lb = luminance(b);
      return (Math.max(La, Lb) + 0.05) / (Math.min(La, Lb) + 0.05);
    }
    const offenders = [];
    const visited = new WeakSet();
    document.querySelectorAll(
      "h1, h2, h3, h4, h5, h6, p, span, li, dd, dt, a, button, label, strong, em, small, figcaption, .weather-engine-page *"
    ).forEach((el) => {
      if (visited.has(el)) return;
      visited.add(el);
      const text = (el.innerText || "").trim();
      if (!text || text.length > 200) return;
      const cs = getComputedStyle(el);
      if (cs.visibility !== "visible" || cs.display === "none") return;
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      const fg = parseColor(cs.color);
      const bg = parseColor(getEffectiveBg(el));
      if (!fg || !bg) return;
      const ratio = contrast(fg, bg);
      if (ratio < 4.5) {
        offenders.push({
          tag: el.tagName.toLowerCase(),
          cls: el.className,
          text: text.slice(0, 80),
          color: cs.color,
          bg: getEffectiveBg(el),
          ratio: Math.round(ratio * 100) / 100,
          fontSize: cs.fontSize,
          fontWeight: cs.fontWeight,
          path: (() => {
            const parts = [];
            let cur = el;
            for (let i = 0; cur && i < 6; i++, cur = cur.parentElement) {
              parts.unshift(cur.tagName.toLowerCase() + (cur.className ? "." + String(cur.className).split(/\s+/).slice(0, 2).join(".") : ""));
            }
            return parts.join(" > ");
          })(),
        });
      }
    });
    offenders.sort((a, b) => a.ratio - b.ratio);
    return offenders.slice(0, 30);
  });

  const out = path.join(OUT_DIR, "weather-full.jpg");
  await page.screenshot({ path: out, type: "jpeg", quality: 80, fullPage: true });
  const out2 = path.join(OUT_DIR, "weather-viewport.jpg");
  await page.screenshot({ path: out2, type: "jpeg", quality: 80, fullPage: false });
  console.log(JSON.stringify({ ok: true, url: page.url(), out, out2, lowContrast }, null, 2));
} finally {
  await context.close();
}
