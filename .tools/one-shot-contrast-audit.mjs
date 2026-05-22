#!/usr/bin/env node
/**
 * one-shot-contrast-audit.mjs
 *
 * Walks a list of routes via .tools/auto-hermes-browser.mjs and reports any
 * visible text element whose computed text-color vs effective background-color
 * contrast ratio falls below WCAG AA (4.5 for body text, 3.0 for large text).
 *
 * The audit specifically flags the pattern that hit `recent-runs-insight-card--primary`:
 * a page-scoped `:is(...)` rule paints text cream/white on what is actually a
 * light-mode (white / paper) surface, dropping contrast to ~1.0.
 *
 * Output: a JSON report grouped by route, then a flat ranked list.
 */
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const ROOT = resolve(dirname(__filename), "..");
const BROWSER = resolve(ROOT, ".tools/auto-hermes-browser.mjs");

const ROUTES = [
  "/profile",
  "/runs",
  "/analysis",
  "/analysis/intensity",
  "/analysis/coach-insight",
  "/analysis/injury-risk",
  "/analysis/load-balance",
  "/weather",
  "/muscle-training",
  "/races",
  "/shoes",
  "/territory",
  "/heatmap",
  "/schedule",
  "/today-run",
  "/settings",
  "/rewards",
  "/workflows",
];

function browser(...argv) {
  try {
    const out = execFileSync("node", [BROWSER, ...argv], {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      maxBuffer: 16 * 1024 * 1024,
    });
    return JSON.parse(out);
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

// JS that runs inside the page. Stringified.
const AUDIT_SCRIPT = `(function(){
  function parseColor(s){
    if(!s) return null;
    var m = s.match(/^rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([0-9.]+))?\\)/);
    if(!m) return null;
    return { r:+m[1], g:+m[2], b:+m[3], a: m[4] !== undefined ? +m[4] : 1 };
  }
  function blend(over, under){
    if(!over) return under;
    if(!under) under = { r:255, g:255, b:255, a:1 };
    var a = over.a + under.a * (1 - over.a);
    if(a === 0) return { r:0, g:0, b:0, a:0 };
    return {
      r: Math.round((over.r * over.a + under.r * under.a * (1 - over.a)) / a),
      g: Math.round((over.g * over.a + under.g * under.a * (1 - over.a)) / a),
      b: Math.round((over.b * over.a + under.b * under.a * (1 - over.a)) / a),
      a: a,
    };
  }
  function effectiveBg(el){
    // Walk up the tree, blending each element's bg over the next.
    var stack = [];
    for(var node = el; node; node = node.parentElement){
      var cs = getComputedStyle(node);
      var c = parseColor(cs.backgroundColor);
      // Treat any visible gradient / image as fully opaque mid-gray for safety;
      // we can't easily sample the gradient at the text position, but a
      // gradient nearly always provides enough contrast with body text — skip.
      if(cs.backgroundImage && cs.backgroundImage !== "none") return null; // skip — gradient
      if(c && c.a > 0) stack.push(c);
      if(c && c.a === 1) break;
    }
    if(stack.length === 0) return { r:255, g:255, b:255, a:1 };
    var bg = stack.pop();
    while(stack.length) bg = blend(stack.pop(), bg);
    return bg;
  }
  function luminance(c){
    function chan(v){ v /= 255; return v <= 0.03928 ? v/12.92 : Math.pow((v + 0.055)/1.055, 2.4); }
    return 0.2126 * chan(c.r) + 0.7152 * chan(c.g) + 0.0722 * chan(c.b);
  }
  function contrast(a, b){
    var la = luminance(a), lb = luminance(b);
    var hi = Math.max(la, lb), lo = Math.min(la, lb);
    return (hi + 0.05) / (lo + 0.05);
  }
  function isLargeText(cs){
    var px = parseFloat(cs.fontSize) || 0;
    var weight = parseInt(cs.fontWeight, 10) || 400;
    return px >= 24 || (px >= 18.66 && weight >= 700);
  }
  function selectorOf(el){
    if(!el) return "";
    if(el.id) return "#" + el.id;
    var name = el.tagName.toLowerCase();
    var cls = (el.className||"").toString().trim().split(/\\s+/).filter(Boolean).slice(0,3).join(".");
    return name + (cls ? "." + cls : "");
  }
  function ancestorChain(el, depth){
    var chain = [];
    var n = el;
    for(var i=0; i<depth && n; i++){
      chain.unshift(selectorOf(n));
      n = n.parentElement;
    }
    return chain.join(" > ");
  }
  var findings = [];
  var TEXT_TAGS = new Set(["P","SPAN","STRONG","EM","B","I","H1","H2","H3","H4","H5","H6","LABEL","SMALL","LI","A","BUTTON","TD","TH","DIV","ARTICLE","SECTION","FOOTER","HEADER","NAV","ASIDE","FIGCAPTION"]);
  document.querySelectorAll("*").forEach(function(el){
    if(!TEXT_TAGS.has(el.tagName)) return;
    var r = el.getBoundingClientRect();
    if(r.width < 10 || r.height < 10) return;
    var cs = getComputedStyle(el);
    if(cs.visibility !== "visible" || cs.display === "none" || +cs.opacity === 0) return;
    // Only inspect leaf text — element whose own text is non-empty AND not just
    // the concatenation of children's text.
    var ownText = "";
    for(var n of el.childNodes){ if(n.nodeType === 3) ownText += n.nodeValue; }
    ownText = ownText.replace(/\\s+/g, "").slice(0, 30);
    if(!ownText) return;
    var fg = parseColor(cs.color);
    if(!fg || fg.a === 0) return;
    var bg = effectiveBg(el);
    if(!bg) return; // gradient — skip
    if(fg.a < 1) fg = blend(fg, bg);
    var ratio = contrast(fg, bg);
    var threshold = isLargeText(cs) ? 3.0 : 4.5;
    if(ratio < threshold){
      findings.push({
        ratio: Math.round(ratio * 100) / 100,
        threshold: threshold,
        text: ownText,
        fg: "rgb(" + fg.r + "," + fg.g + "," + fg.b + ")",
        bg: "rgb(" + bg.r + "," + bg.g + "," + bg.b + ")",
        sel: selectorOf(el),
        chain: ancestorChain(el, 4),
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
      });
    }
  });
  findings.sort(function(a,b){ return a.ratio - b.ratio; });
  return JSON.stringify({ count: findings.length, findings: findings.slice(0, 40) });
})()`;

// Theme is selected via the localStorage key `hermes_theme` (see
// frontend/src/contexts/ThemeContext.jsx). Set it before each navigation so
// the SPA boots in the requested mode. Pass `--theme=light` or
// `--theme=midnight` (or `--theme=high-contrast` / `high-contrast-light`).
const THEME_ARG = (process.argv.find((a) => a.startsWith("--theme=")) || "--theme=light").slice(8);
const THEME = ["light", "midnight", "high-contrast", "high-contrast-light"].includes(THEME_ARG) ? THEME_ARG : "light";

async function audit() {
  browser("cleanup");
  const report = {};
  for (const route of ROUTES) {
    const url = "http://localhost:8080" + route + "?contrast=1";
    process.stderr.write(`→ [theme=${THEME}] ${route}\n`);
    // Persist theme + force a hard reload so the body class flips before the
    // first eval. ThemeContext writes the class to <body> on mount, so any
    // route opened after this seed picks the requested mode up immediately.
    browser("eval", "--js", `localStorage.setItem('hermes_theme', '${THEME}'); 'ok'`);
    const goto = browser("goto", "--url", url, "--wait-ms", "9000");
    if (!goto || !goto.ok) {
      report[route] = { error: "goto-failed" };
      continue;
    }
    // small extra settle
    await new Promise((r) => setTimeout(r, 600));
    const ev = browser("eval", "--js", AUDIT_SCRIPT);
    if (!ev || !ev.ok) {
      report[route] = { error: "eval-failed" };
      continue;
    }
    try {
      const parsed = JSON.parse(ev.value);
      report[route] = parsed;
    } catch {
      report[route] = { error: "parse-failed", raw: String(ev.value || "").slice(0, 200) };
    }
  }
  // Flat ranking
  const all = [];
  for (const [route, data] of Object.entries(report)) {
    if (!data || !data.findings) continue;
    for (const f of data.findings) all.push({ route, ...f });
  }
  all.sort((a, b) => a.ratio - b.ratio);
  console.log(JSON.stringify({ perRoute: report, rankedTop60: all.slice(0, 60) }, null, 2));
}

audit().catch((err) => {
  console.error("FATAL:", err.message);
  process.exit(1);
});
