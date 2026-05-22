#!/usr/bin/env node
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

  const probe = await page.evaluate(() => {
    const hermesFrame = document.querySelector(".hermes-site-frame");
    const refCards = Array.from(document.querySelectorAll(".runner-dashboard-profile-reference-card"));
    const prescriptionStrong = document.querySelector(".runner-dashboard-coach-prescription-stats strong");
    return {
      hermesFrameAttrs: hermesFrame ? {
        className: hermesFrame.className,
        dataGptTaste: hermesFrame.getAttribute("data-gpt-taste-system"),
        dataRoutePath: hermesFrame.getAttribute("data-route-path"),
        dataRunnerDesign: hermesFrame.getAttribute("data-runner-design"),
      } : null,
      refCardsTextAlign: refCards.map((c, i) => ({
        i,
        cls: c.className,
        textAlign: getComputedStyle(c).textAlign,
      })),
      prescriptionStrongAlign: prescriptionStrong ? {
        textAlign: getComputedStyle(prescriptionStrong).textAlign,
        text: prescriptionStrong.innerText,
      } : null,
    };
  });
  console.log(JSON.stringify(probe, null, 2));
} finally {
  await context.close();
}
