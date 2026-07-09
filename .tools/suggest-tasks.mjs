#!/usr/bin/env node
/**
 * suggest-tasks.mjs - Auto-generate suggested next tasks for TASKS.md.
 *
 * The goal is to emit concrete, promotable queue items with enough ownership
 * information for auto-hermes to route them deterministically.
 */

import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const SCREEN_INTENTS = [
  { screen: "TodayRun", tier: 1, intent: 'Answer "should I run today and how hard?"', file: "frontend/src/pages/TodayRun.jsx" },
  { screen: "Profile", tier: 1, intent: "Show trend and readiness at a glance", file: "frontend/src/pages/Profile.jsx" },
  { screen: "Analysis", tier: 1, intent: "Deep-dive into training science", file: "frontend/src/pages/Analysis.jsx" },
  { screen: "Runs", tier: 2, intent: "Searchable, sortable log with pattern recognition", file: "frontend/src/pages/Runs.jsx" },
  { screen: "RunDetail", tier: 2, intent: "Individual run breakdown and GPS route", file: "frontend/src/pages/RunDetail.jsx" },
  { screen: "Shoes", tier: 1, intent: "Never get caught with dead shoe mid-block", file: "frontend/src/pages/Shoes.jsx" },
  { screen: "Races", tier: 3, intent: "Race day planning and goal-setting", file: "frontend/src/pages/Races.jsx" },
  { screen: "Rewards", tier: 4, intent: "Celebrate consistency without feeling cheap", file: "frontend/src/pages/Rewards.jsx" },
  { screen: "Settings", tier: 5, intent: "Control and trust - runner owns their data", file: "frontend/src/pages/Settings.jsx" },
  { screen: "Landing", tier: 5, intent: "Convert a skeptical Strava user", file: "frontend/src/pages/Landing.jsx", requiresEmptyState: false },
  { screen: "Login", tier: 5, intent: "Convert returning runners without friction", file: "frontend/src/pages/Login.jsx", requiresEmptyState: false },
  { screen: "Signup", tier: 5, intent: "Onboard new runners with minimal friction", file: "frontend/src/pages/Signup.jsx", requiresEmptyState: false },
  { screen: "AdminLogin", tier: 5, intent: "Operator access gate 鈥?fast and trustworthy", file: "frontend/src/pages/AdminLogin.jsx", requiresEmptyState: false },
  { screen: "Dashboard", tier: 5, intent: "Admin ops surface 鈥?race maps, course review, catalog", file: "frontend/src/pages/Dashboard.jsx", requiresEmptyState: false },
  { screen: "Heatmap", tier: 3, intent: "Visualize where the runner trains geographically", file: "frontend/src/pages/Heatmap.jsx" },
  { screen: "WeatherEngine", tier: 2, intent: "Show how weather affects today's target pace", file: "frontend/src/pages/WeatherEngine.jsx" },
  { screen: "AnalysisInsightDetail", tier: 2, intent: "Drill into a single training insight with supporting data", file: "frontend/src/pages/AnalysisInsightDetail.jsx" },
  { screen: "Vo2MaxDetail", tier: 2, intent: "Explain VO2max estimate with full transparency", file: "frontend/src/pages/Vo2MaxDetail.jsx" },
  { screen: "AddShoes", tier: 1, intent: "Add new shoes with AI-assisted mileage detection", file: "frontend/src/pages/AddShoes.jsx" },
  { screen: "ShoeCatalog", tier: 5, intent: "Browse and select shoe models from the catalog", file: "frontend/src/pages/ShoeCatalog.jsx", requiresEmptyState: false },
  { screen: "RacesDetail", tier: 3, intent: "Race-day brief with course map and elevation", file: "frontend/src/pages/RacesDetail.jsx" },
  { screen: "Schedule", tier: 1, intent: "Weekly training plan with load and recovery view", file: "frontend/src/pages/Schedule.jsx" },
  { screen: "PredictionDetail", tier: 3, intent: "Show race-time prediction with confidence and methodology", file: "frontend/src/pages/PredictionDetail.jsx" },
  { screen: "MuscleTraining", tier: 2, intent: "Strength sessions that complement running load", file: "frontend/src/pages/MuscleTraining.jsx" },
  { screen: "LegalPage", tier: 5, intent: "Privacy and terms 鈥?builds trust with cautious runners", file: "frontend/src/pages/LegalPage.jsx", requiresEmptyState: false },
  { screen: "WorkflowBuilder", tier: 5, intent: "Admin workflow automation surface", file: "frontend/src/pages/WorkflowBuilder.jsx", requiresEmptyState: false },
  { screen: "ForgotPassword", tier: 5, intent: "Restore access and trust for existing runners", file: "frontend/src/pages/ForgotPassword.jsx", requiresEmptyState: false },
];

const SHELL_INVARIANTS = {
  ForgotPassword: {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    tier: 5,
  },
  Profile: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 1,
  },
  Analysis: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 1,
  },
  Runs: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 2,
  },
  Races: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 3,
  },
  Shoes: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 1,
  },
  TodayRun: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 1,
  },
  Rewards: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 4,
  },
  PredictionDetail: {
    required: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle"],
    forbidden: ["AuthenticatedPageChrome"],
    tier: 3,
  },
  Landing: {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    tier: 5,
  },
  Login: {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    tier: 5,
  },
  Signup: {
    forbidden: ["analysis-stitch-topbar-profile-actions", "runner-dashboard-sidebar-toggle", "analysis-stitch-sidebar"],
    tier: 5,
  },
};

function parseArgs() {
  const args = { write: false, max: 5, tier: null, quiet: false };
  const argv = process.argv.slice(2);
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--max") args.max = Number.parseInt(argv[++index], 10) || 5;
    else if (arg === "--tier") args.tier = Number.parseInt(argv[++index], 10) || null;
    else if (arg === "--quiet") args.quiet = true;
  }
  return args;
}

function readFile(relPath) {
  const full = path.resolve(ROOT, relPath);
  return fs.existsSync(full) ? fs.readFileSync(full, "utf8") : "";
}

function resolvePageFile(relPath, seen = new Set()) {
  const normalized = String(relPath || "").replace(/\\/g, "/");
  if (!normalized || seen.has(normalized)) return normalized;
  seen.add(normalized);

  const content = readFile(normalized);
  if (!content) return normalized;

  const reexportMatch = content.match(/export\s*\{\s*default\s*\}\s*from\s*['"](\.\/[^'"]+)['"]/);
  if (!reexportMatch) return normalized;

  const parentDir = path.posix.dirname(normalized);
  let candidate = path.posix.normalize(path.posix.join(parentDir, reexportMatch[1]));
  if (!path.posix.extname(candidate)) candidate = `${candidate}.jsx`;
  return resolvePageFile(candidate, seen);
}

function readScreenFile(screen) {
  return readFile(resolvePageFile(screen.file));
}

function glob(dir, pattern) {
  const full = path.resolve(ROOT, dir);
  if (!fs.existsSync(full)) return [];

  const results = [];
  function walk(target) {
    for (const entry of fs.readdirSync(target, { withFileTypes: true })) {
      if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
        walk(path.join(target, entry.name));
      } else if (entry.isFile() && pattern.test(entry.name)) {
        results.push(path.join(target, entry.name));
      }
    }
  }
  walk(full);
  return results;
}

function shell(command) {
  try {
    return execSync(command, {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 10000,
      stdio: ["pipe", "pipe", "pipe"],
    }).trim();
  } catch {
    return "";
  }
}

function relativeFile(filePath) {
  return path.relative(ROOT, filePath).replace(/\\/g, "/");
}

function loadAgentSync() {
  const file = path.resolve(ROOT, ".ai-sync/AGENT_SYNC.json");
  if (!fs.existsSync(file)) {
    return { activeClaims: [], recentlyCompleted: [], mustFixQueue: [] };
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      activeClaims: Array.isArray(parsed.activeClaims) ? parsed.activeClaims : [],
      recentlyCompleted: Array.isArray(parsed.recentlyCompleted) ? parsed.recentlyCompleted : [],
      mustFixQueue: Array.isArray(parsed.mustFixQueue) ? parsed.mustFixQueue : [],
    };
  } catch {
    return { activeClaims: [], recentlyCompleted: [], mustFixQueue: [] };
  }
}

function collectScreensFromText(value) {
  const text = String(value || "");
  const screens = new Set();
  for (const screen of SCREEN_INTENTS) {
    if (text.includes(screen.screen) || text.includes(screen.file)) screens.add(screen.screen);
  }
  if (/Controller|Service|backend/i.test(text)) screens.add("Backend");
  return screens;
}

function buildFreshnessState(syncState) {
  const activeClaims = new Set();
  const recentlyCompleted = new Set();
  const mustFix = new Set();

  for (const item of syncState.activeClaims) {
    for (const screen of collectScreensFromText(`${item.surface} ${item.task} ${(item.files || []).join(" ")}`)) {
      activeClaims.add(screen);
    }
  }

  for (const item of syncState.recentlyCompleted) {
    for (const screen of collectScreensFromText(`${item.surface} ${item.task} ${(item.files || []).join(" ")}`)) {
      recentlyCompleted.add(screen);
    }
  }

  for (const item of syncState.mustFixQueue) {
    for (const screen of collectScreensFromText(`${item.surface} ${item.task} ${(item.files || []).join(" ")}`)) {
      mustFix.add(screen);
    }
  }

  return { activeClaims, recentlyCompleted, mustFix };
}

function getRecentChanges() {
  return {
    log: shell("git log --oneline -20 --no-merges").split("\n").filter(Boolean),
    files: shell("git diff --name-only HEAD~5 HEAD 2>nul").split("\n").filter(Boolean),
  };
}

function getRecentlyTouchedScreens(changedFiles) {
  const touched = new Set();
  for (const changedFile of changedFiles) {
    for (const screen of SCREEN_INTENTS) {
      if (changedFile.includes(screen.file.replace("frontend/src/pages/", ""))) touched.add(screen.screen);
    }
  }
  return touched;
}

function screenIssue(screen, type, desc, files = [screen.file], tier = screen.tier) {
  return { screen: screen.screen, tier, type, desc, files };
}

function checkScreenCompleteness() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    if (!readScreenFile(screen)) {
      issues.push(screenIssue(screen, "missing_screen", `${screen.screen} page file doesn't exist yet - "${screen.intent}" is unaddressed`));
    }
  }
  return issues;
}

function checkEmptyStates() {
  const issues = [];
  for (const screen of SCREEN_INTENTS.filter((entry) => entry.requiresEmptyState !== false)) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const hasEmptyState = /empty|no.?data|no.?runs|no.?activities|no.?results|鏆傛棤/i.test(content);
    const hasNextAction = /import|add|create|get.?started|寮€濮媩瀵煎叆|娣诲姞/i.test(content);

    if (!hasEmptyState) {
      issues.push(screenIssue(screen, "missing_empty_state", `${screen.screen} page has no visible empty state - runners with no data see a blank screen`));
    } else if (!hasNextAction) {
      issues.push(screenIssue(screen, "empty_state_no_action", `${screen.screen} shows "no data" but doesn't tell the runner what to do next`));
    }
  }
  return issues;
}

function checkErrorHandling() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const fetchCalls = (content.match(/apiJson|apiFetch|fetch\(/g) || []).length;
    const catchCalls = (content.match(/\.catch|catch\s*[\({]/g) || []).length;
    if (fetchCalls > 0 && catchCalls === 0) {
      issues.push(screenIssue(screen, "missing_error_handling", `${screen.screen} makes ${fetchCalls} API call(s) with no visible error handling - network failures blank the page`));
    }
  }
  return issues;
}

function checkLoadingStates() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const hasAsync = /apiJson|apiFetch|useEffect.*async|fetch\(/i.test(content);
    const hasLoadingUI = /loading|spinner|skeleton|CardLoadingState|姝ｅ湪鍔犺浇/i.test(content);
    if (hasAsync && !hasLoadingUI) {
      issues.push(screenIssue(screen, "missing_loading_state", `${screen.screen} fetches data but shows no loading indicator - runners see a blank flash before data arrives`));
    }
  }
  return issues;
}

function checkShellDesignIntegrity() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    const invariant = SHELL_INVARIANTS[screen.screen];
    if (!content || !invariant) continue;

    for (const token of invariant.required || []) {
      if (!content.includes(token)) {
        issues.push(screenIssue(screen, "design_shell_drift", `${screen.screen} is missing required shell marker "${token}" - frontend layout may have drifted away from the approved Hermes surface`, [screen.file], invariant.tier || screen.tier));
      }
    }

    for (const token of invariant.forbidden || []) {
      if (content.includes(token)) {
        issues.push(screenIssue(screen, "design_shell_drift", `${screen.screen} contains forbidden shell pattern "${token}" - frontend layout may have regressed into the wrong chrome family`, [screen.file], invariant.tier || screen.tier));
      }
    }
  }
  return issues;
}

function checkTranslationGaps() {
  const content = readFile("frontend/src/i18n/translations.js");
  if (!content) return [];

  const bypassMatches = content.match(/\/\*\s*bypass\b/gi);
  if (!bypassMatches || bypassMatches.length <= 3) return [];

  return [{
    screen: "Global",
    tier: 2,
    type: "translation_bypasses",
    desc: `${bypassMatches.length} translation bypass markers found - some UI strings may show raw keys instead of translated text`,
    files: ["frontend/src/i18n/translations.js"],
  }];
}

function checkCoachVoice() {
  const content = readFile("frontend/src/i18n/translations.js");
  if (!content) return [];

  const patterns = [
    /recommended\s+(?:value|range|setting)/i,
    /configuration\s+option/i,
    /data\s+not\s+available/i,
    /no\s+results?\s+found/i,
    /operation\s+(?:failed|succeeded)/i,
  ];

  const issues = [];
  for (const pattern of patterns) {
    if (pattern.test(content)) {
      issues.push({
        screen: "Global",
        tier: 1,
        type: "app_voice",
        desc: `Found app-voice copy matching "${pattern.source}" - should use coach-voice instead`,
        files: ["frontend/src/i18n/translations.js"],
      });
    }
  }
  return issues;
}

function checkTestCoverage() {
  const issues = [];
  const testFiles = glob("backend/src/test/java/com/hermes/backend", /Tests?\.java$/);
  const controllerFiles = glob("backend/src/main/java/com/hermes/backend", /Controller\.java$/);
  const testedControllers = new Set(testFiles.map((file) => path.basename(file).replace(/Tests?\.java$/, "")));

  for (const controllerFile of controllerFiles) {
    const name = path.basename(controllerFile).replace(".java", "");
    if (testedControllers.has(name)) continue;

    issues.push({
      screen: "Backend",
      tier: 2,
      type: "backend_logic_guard",
      desc: `${name} backend logic has no focused test file - auth, validation, and response-contract behavior can drift unnoticed`,
      files: [
        relativeFile(controllerFile),
        `backend/src/test/java/com/hermes/backend/${name}Tests.java`,
      ],
    });
  }
  return issues;
}

function checkAccessibility() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const imgTags = (content.match(/<img\b/g) || []).length;
    const altTags = (content.match(/alt\s*=/g) || []).length;
    if (imgTags > 0 && altTags < imgTags) {
      issues.push(screenIssue(screen, "missing_alt_text", `${screen.screen} has ${imgTags - altTags} image(s) without alt text`));
    }
  }
  return issues;
}

function checkImprovedAccessibility() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    // Check for icon-only buttons with no aria-label
    // Look for <button ...> followed by <AppIcon ...> or similar, and no text before </button>
    // This is a simplified regex-based check
    const buttonMatches = content.matchAll(/<button[^>]*>(.*?)<\/button>/gs);
    for (const match of buttonMatches) {
      const inner = match[1];
      const hasIcon = /<AppIcon|<img|<svg/i.test(inner);
      const hasText = />[^<{}\s][^<{}]*</.test(`>${inner}<`) || /\b(t|displayName|initials|initial)\b/.test(inner);
      const hasAriaLabel = /\baria-label\s*=/.test(match[0]);

      if (hasIcon && !hasText && !hasAriaLabel) {
        issues.push(screenIssue(screen, "missing_aria_label", `${screen.screen} has icon-only button with no aria-label - screen readers will announce "button"`));
      }
    }
  }
  return issues;
}

function checkHardcodedStrings() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const hardcoded = new Set();

    // 1. Strings in JSX text nodes: >Some Text<
    const jsxTextRe = />\s*([A-Z][^<>{}\d]*[a-z][^<>{}\d]*)\s*</g;
    let match;
    while ((match = jsxTextRe.exec(content)) !== null) {
      const text = match[1].trim();
      if (text.length > 2 && !/^(Hermes|Strava|Google|Garmin|Apple|JSON|GPX|FIT|TCX|VDOT|VO2max|BPM|SPM|HR|KM|M|W|KCAL|JVM|DEM|OSRM|GPX|FIT|TCX)$/i.test(text)) {
        hardcoded.add(text);
      }
    }

    // 2. Strings in common labels/titles: label: 'Some Text'
    const labelRe = /\b(label|title|placeholder|heading|subheading|caption|text|copy|tagline|purpose)\s*[:=]\s*['"]([A-Z][^'"{}\d]*[a-z][^'"{}\d]*)['"]/g;
    while ((match = labelRe.exec(content)) !== null) {
      const text = match[2].trim();
      if (text.length > 2 && !/^(Hermes|Strava|Google|Garmin|Apple|JSON|GPX|FIT|TCX|VDOT|VO2max|BPM|SPM|HR|KM|M|W|KCAL|JVM|DEM|OSRM|GPX|FIT|TCX)$/i.test(text)) {
        hardcoded.add(text);
      }
    }

    if (hardcoded.size > 0) {
      const samples = Array.from(hardcoded).slice(0, 3).join(", ");
      issues.push(screenIssue(screen, "hardcoded_strings", `${screen.screen} has hardcoded strings in JSX/JS (e.g., "${samples}") - should use t() for internationalization`));
    }
  }
  return issues;
}

function checkReactAntiPatterns() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    // Check for index-based keys in .map() - using [\s\S]* to handle newlines
    if (/\.map\s*\(\s*\([^,)]+,\s*index\)\s*=>[\s\S]*?key\s*=\s*{\s*index\s*}/.test(content) ||
        /\.map\s*\(\s*\([^,)]+,\s*index\)\s*=>[\s\S]*?key\s*=\s*{\s*`[^`]*\${index}[^`]*`\s*}/.test(content)) {
      issues.push(screenIssue(screen, "react_index_key", `${screen.screen} uses array index as React key - can cause rendering bugs and performance issues during list updates`));
    }
  }
  return issues;
}

function checkInlineStyles() {
  const issues = [];
  for (const screen of SCREEN_INTENTS) {
    const content = readScreenFile(screen);
    if (!content) continue;

    // Check for inline styles with hardcoded pixel values or colors
    // style={{ width: '100px', color: '#fff' }}
    const inlineStyleRe = /style\s*=\s*{{\s*([^}]+)\s*}}/g;
    let match;
    while ((match = inlineStyleRe.exec(content)) !== null) {
      const styleBody = match[1];
      if (/[:\s]['"]?\d+px['"]?/.test(styleBody) || /[:\s]['"]?#(?:[0-9a-fA-F]{3}){1,2}['"]?/.test(styleBody)) {
        issues.push(screenIssue(screen, "inline_styles", `${screen.screen} uses inline styles with hardcoded pixels or colors - should prefer CSS classes or design tokens`));
        break;
      }
    }
  }
  return issues;
}

function discoverScreensDynamically() {
  const content = readFile("frontend/src/App.jsx");
  if (!content) return [];

  const lazyImports = [];
  const lazyRe = /React\.lazy\(\(\)\s*=>\s*import\(['"]\.\/pages\/([^'"]+)['"]\)\)/g;
  let match;
  while ((match = lazyRe.exec(content)) !== null) {
    lazyImports.push({ name: match[1], file: `frontend/src/pages/${match[1]}.jsx` });
  }

  const knownScreens = new Set(SCREEN_INTENTS.map((s) => s.screen));
  const issues = [];

  for (const imp of lazyImports) {
    if (knownScreens.has(imp.name)) continue;

    if (!readFile(imp.file)) {
      issues.push({
        screen: imp.name,
        tier: 3,
        type: "dynamic_missing_page",
        desc: `${imp.name} page referenced in App.jsx routes but page file is missing`,
        files: [imp.file],
      });
    } else {
      issues.push({
        screen: imp.name,
        tier: 3,
        type: "dynamic_unregistered_screen",
        desc: `${imp.name} page exists and is routed in App.jsx but has no SCREEN_INTENTS entry - quality checks may skip it`,
        files: [imp.file],
      });
    }
  }

  return issues;
}

function discoverTestFailures() {
  const surefireDir = path.resolve(ROOT, "backend/target/surefire-reports");
  if (!fs.existsSync(surefireDir)) return [];

  const xmlFiles = glob("backend/target/surefire-reports", /\.xml$/);
  const issues = [];

  for (const xmlFile of xmlFiles) {
    const content = fs.readFileSync(xmlFile, "utf8");
    const errorsMatch = content.match(/errors="(\d+)"/);
    const failuresMatch = content.match(/failures="(\d+)"/);
    const errors = errorsMatch ? Number.parseInt(errorsMatch[1], 10) : 0;
    const failures = failuresMatch ? Number.parseInt(failuresMatch[1], 10) : 0;

    if (errors > 0 || failures > 0) {
      const testName = path.basename(xmlFile, ".xml").replace(/^TEST-/, "");
      issues.push({
        screen: "Backend",
        tier: 1,
        type: "test_failure",
        desc: `${testName} has ${errors} error(s) and ${failures} failure(s) - regressions may be passing silently`,
        files: [relativeFile(xmlFile)],
      });
    }
  }

  return issues;
}

function discoverLintWarnings() {
  let lintOutput;
  try {
    lintOutput = execSync("npx eslint --format json frontend/src/", {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 30000,
      stdio: ["pipe", "pipe", "pipe"],
    });
  } catch (e) {
    lintOutput = e.stdout || "";
  }

  if (!lintOutput) return [];

  let results;
  try {
    results = JSON.parse(lintOutput);
  } catch {
    return [];
  }

  const issues = [];
  for (const fileResult of results) {
    const relPath = path.relative(ROOT, fileResult.filePath).replace(/\\/g, "/");
    if (fileResult.errorCount > 0) {
      issues.push({
        screen: "Global",
        tier: 2,
        type: "lint_errors",
        desc: `${relPath} has ${fileResult.errorCount} ESLint error(s) that should be fixed`,
        files: [relPath],
      });
    } else if (fileResult.warningCount > 3) {
      issues.push({
        screen: "Global",
        tier: 3,
        type: "lint_warnings",
        desc: `${relPath} has ${fileResult.warningCount} ESLint warning(s) - consider cleaning up`,
        files: [relPath],
      });
    }
  }

  return issues;
}

function inferScreenFromConsoleRoute(route, sourceUrl, message) {
  const normalizedRoute = String(route || '').split('?')[0].toLowerCase();
  if (normalizedRoute.startsWith('/today-run')) return 'TodayRun';
  if (normalizedRoute.startsWith('/analysis/vo2max')) return 'Vo2MaxDetail';
  if (normalizedRoute.startsWith('/analysis/insight')) return 'AnalysisInsightDetail';
  if (normalizedRoute.startsWith('/analysis')) return 'Analysis';
  if (normalizedRoute.startsWith('/prediction/')) return 'PredictionDetail';
  if (normalizedRoute.startsWith('/run/')) return 'RunDetail';
  if (normalizedRoute.startsWith('/runs')) return 'Runs';
  if (normalizedRoute.startsWith('/shoes')) return 'Shoes';
  if (normalizedRoute.startsWith('/races/details/')) return 'RacesDetail';
  if (normalizedRoute.startsWith('/races')) return 'Races';
  if (normalizedRoute.startsWith('/settings')) return 'Settings';
  if (normalizedRoute.startsWith('/schedule')) return 'Schedule';
  if (normalizedRoute.startsWith('/heatmap')) return 'Heatmap';
  if (normalizedRoute.startsWith('/weather')) return 'WeatherEngine';
  if (normalizedRoute.startsWith('/muscle-training')) return 'MuscleTraining';
  if (normalizedRoute.startsWith('/profile')) return 'Profile';
  if (normalizedRoute.startsWith('/dashboard')) return 'Dashboard';
  if (normalizedRoute.startsWith('/login')) return 'Login';
  if (normalizedRoute.startsWith('/signup')) return 'Signup';

  const haystack = `${sourceUrl || ''} ${message || ''}`;
  const match = SCREEN_INTENTS.find((screen) => {
    const baseName = path.basename(screen.file).replace(/\.(jsx|js|tsx|ts)$/i, '');
    return haystack.includes(baseName);
  });
  return match?.screen || 'Global';
}

function discoverLocalConsoleErrors() {
  const ledgerPath = path.resolve(ROOT, '.ai-sync/LOCAL_CONSOLE_ERRORS.json');
  if (!fs.existsSync(ledgerPath)) return [];

  let ledger;
  try {
    ledger = JSON.parse(fs.readFileSync(ledgerPath, 'utf8'));
  } catch {
    return [];
  }

  const entries = Array.isArray(ledger?.entries) ? ledger.entries : [];
  return entries
    .filter((entry) => {
      const severity = String(entry?.severity || 'error').toLowerCase();
      return severity === 'error';
    })
    .slice(0, 25)
    .map((entry) => {
      const screen = inferScreenFromConsoleRoute(entry.route, entry.sourceUrl, entry.message);
      const screenMeta = SCREEN_INTENTS.find((candidate) => candidate.screen === screen);
      const count = Number.isFinite(Number(entry.count)) ? Number(entry.count) : 1;
      const summary = String(entry.message || 'Console error').replace(/\s+/g, ' ').trim();
      return {
        screen,
        tier: screenMeta?.tier || 2,
        type: 'local_console_error',
        desc: `${screen} logs local browser console error: ${summary}${count > 1 ? ` (${count}x)` : ''}`,
        files: [screenMeta?.file || 'frontend/src/main.jsx', '.ai-sync/LOCAL_CONSOLE_ERRORS.md'],
      };
    });
}

function checkMobileResponsiveness() {
  const cssContent = readFile("frontend/src/styles/style.css");
  if (!cssContent) return [];

  const SHELL_CLASSES = new Set([
    "runner-shell-page",
    "runner-dashboard-page",
    "runner-shell-sidebar",
    "runner-shell-main",
    "runner-shell-canvas",
    "dashboard-container",
  ]);

  const issues = [];
  for (const screen of SCREEN_INTENTS.filter((entry) => entry.tier <= 2)) {
    const content = readScreenFile(screen);
    if (!content) continue;

    const screenClasses = (content.match(/className="([^"]+)"/g) || [])
      .map((m) => m.match(/"([^"]+)"/)?.[1])
      .filter(Boolean)
      .flatMap((c) => c.split(/\s+/))
      .filter((c) => !SHELL_CLASSES.has(c) && !c.includes("{") && !c.includes("$") && !c.includes("is-") && !c.includes("--") && !c.startsWith("mm-"));
    if (!screenClasses.length) continue;

    const hasResponsiveRule = screenClasses.some((className) =>
      new RegExp(`@media[\\s\\S]*\\.${className.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&")}(?:[^a-zA-Z0-9_-]|$)`, "i").test(cssContent),
    );
    if (!hasResponsiveRule) {
      const mainClass = screenClasses[0];
      issues.push(screenIssue(screen, "mobile_responsive", `${screen.screen} may need mobile breakpoint review (no @media rules found for its main container .${mainClass})`, [screen.file, "frontend/src/styles/style.css"], 2));
    }
  }
  return issues;
}
function filesForIssue(issue) {
  if (Array.isArray(issue.files) && issue.files.length) return issue.files;
  const fileHint = SCREEN_INTENTS.find((screen) => screen.screen === issue.screen)?.file;
  return fileHint ? [fileHint] : [];
}

function problemClassForIssue(issue) {
  if (issue.screen === "Backend" || issue.type === "backend_logic_guard") return "backend-logic";
  if ([
    "test_failure",
  ].includes(issue.type)) return "backend-logic";
  if ([
    "design_shell_drift",
    "missing_empty_state",
    "empty_state_no_action",
    "missing_loading_state",
    "mobile_responsive",
    "app_voice",
    "missing_screen",
    "dynamic_missing_page",
    "dynamic_unregistered_screen",
    "hardcoded_strings",
    "inline_styles",
  ].includes(issue.type)) return "frontend-design";
  if (["translation_bypasses", "missing_error_handling", "missing_alt_text", "lint_errors", "lint_warnings", "local_console_error", "react_index_key", "missing_aria_label"].includes(issue.type)) return "frontend-logic";
  return issue.screen === "Backend" ? "backend-logic" : "frontend-logic";
}

function ownerForProblemClass(problemClass) {
  if (problemClass === "backend-logic") return "backend-agent";
  if (problemClass === "frontend-design" || problemClass === "frontend-logic") return "frontend-agent";
  return "planning-agent";
}

function verifyForIssue(issue, problemClass, files) {
  if (problemClass === "backend-logic") {
    const testFile = files.find((file) => /Tests?\.java$/i.test(file));
    const testClass = testFile ? path.basename(testFile).replace(/\.java$/i, "") : "";
    return testClass
      ? `\`cd backend && ./mvnw test -Dtest=${testClass} && ./mvnw -q -DskipTests compile\``
      : "`cd backend && ./mvnw test && ./mvnw -q -DskipTests compile`";
  }
  if (problemClass === "frontend-design") {
    return "`cd frontend && npm run lint && npm run build`";
  }
  if (issue.type === "translation_bypasses" || issue.type === "hardcoded_strings") {
    return "`node .tools/check-translations.mjs`";
  }
  return "`cd frontend && npm run lint && cd backend && ./mvnw -q -DskipTests compile`";
}

function issuesToTasks(issues, recentScreens, freshness) {
  const typeWeights = {
    missing_screen: 10,
    dynamic_missing_page: 9,
    design_shell_drift: 9,
    local_console_error: 9,
    backend_logic_guard: 8,
    test_failure: 8,
    missing_error_handling: 8,
    react_index_key: 8,
    missing_empty_state: 7,
    empty_state_no_action: 6,
    missing_loading_state: 5,
    mobile_responsive: 5,
    hardcoded_strings: 5,
    missing_aria_label: 5,
    inline_styles: 4,
    translation_bypasses: 4,
    app_voice: 4,
    lint_errors: 4,
    dynamic_unregistered_screen: 3,
    lint_warnings: 2,
    missing_alt_text: 2,
  };

  return issues
    .map((issue) => {
      const tierScore = (6 - issue.tier) * 10;
      const typeScore = typeWeights[issue.type] || 3;
      const recencyBoost = recentScreens.has(issue.screen) ? 5 : 0;
      const freshnessPenalty = freshness.recentlyCompleted.has(issue.screen) ? 1000 : 0;
      const claimedPenalty = freshness.activeClaims.has(issue.screen) ? 1000 : 0;
      return {
        ...issue,
        priority: tierScore + typeScore + recencyBoost - freshnessPenalty - claimedPenalty,
        blockedByFreshness:
          (freshness.recentlyCompleted.has(issue.screen) || freshness.activeClaims.has(issue.screen)) &&
          !freshness.mustFix.has(issue.screen),
      };
    })
    .filter((issue) => !issue.blockedByFreshness)
    .sort((left, right) => right.priority - left.priority);
}

function formatTask(task) {
  const files = filesForIssue(task);
  const problemClass = problemClassForIssue(task);
  const owner = ownerForProblemClass(problemClass);
  const lines = [`- [ ] ${task.desc}`];
  if (files.length) lines.push(`  Files: \`${files.join(", ")}\``);
  lines.push(`  Problem: ${problemClass}`);
  lines.push(`  Owner: ${owner}`);
  lines.push(`  Context: Auto-suggested from codebase analysis (${task.type})`);
  lines.push("  Done when: the issue described above is resolved and verified");
  lines.push(`  Verify: ${verifyForIssue(task, problemClass, files)}`);
  return lines.join("\n");
}

function writeToTasksFile(tasks) {
  const tasksPath = path.resolve(ROOT, "TASKS.md");
  let content = fs.readFileSync(tasksPath, "utf8");

  const byTier = new Map();
  for (const task of tasks) {
    if (!byTier.has(task.tier)) byTier.set(task.tier, []);
    byTier.get(task.tier).push(task);
  }

  for (const [tier, tierTasks] of byTier.entries()) {
    const sectionHeader = `### TIER ${tier}`;
    const headerIdx = content.indexOf(sectionHeader);
    if (headerIdx === -1) continue;

    const headerEnd = content.indexOf("\n", headerIdx);
    if (headerEnd === -1) continue;

    const afterHeader = content.slice(headerEnd + 1);
    const nextSectionMatch = afterHeader.match(/^(###?\s)/m);
    const nextSectionOffset = nextSectionMatch ? afterHeader.indexOf(nextSectionMatch[0]) : afterHeader.length;
    const existingBlock = afterHeader.slice(0, nextSectionOffset);
    const comments = (existingBlock.match(/<!--[\s\S]*?-->/g) || []).join("\n");
    const taskBlock = tierTasks.map(formatTask).join("\n\n");
    const newBlock = comments ? `${comments}\n${taskBlock}\n\n` : `${taskBlock}\n\n`;

    content = content.slice(0, headerEnd + 1) + newBlock + content.slice(headerEnd + 1 + nextSectionOffset);
  }

  fs.writeFileSync(tasksPath, content, "utf8");
}

export function collectSuggestedTasks({ max = 5, tier = null } = {}) {
  const recent = getRecentChanges();
  const recentScreens = getRecentlyTouchedScreens(recent.files);
  const freshness = buildFreshnessState(loadAgentSync());

  const allIssues = [
    ...checkScreenCompleteness(),
    ...checkEmptyStates(),
    ...checkErrorHandling(),
    ...checkLoadingStates(),
    ...checkShellDesignIntegrity(),
    ...checkTranslationGaps(),
    ...checkCoachVoice(),
    ...checkTestCoverage(),
    ...checkAccessibility(),
    ...checkImprovedAccessibility(),
    ...checkHardcodedStrings(),
    ...checkReactAntiPatterns(),
    ...checkInlineStyles(),
    ...checkMobileResponsiveness(),
    ...discoverLocalConsoleErrors(),
    ...discoverScreensDynamically(),
    ...discoverTestFailures(),
    ...discoverLintWarnings(),
  ];

  const filtered = tier ? allIssues.filter((issue) => issue.tier === tier) : allIssues;
  const ranked = issuesToTasks(filtered, recentScreens, freshness);
  const seen = new Set();
  const deduped = ranked.filter((task) => {
    const key = `${task.screen}:${task.type}:${task.desc}:${filesForIssue(task).join("|")}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const topTasks = deduped.slice(0, max);
  return {
    count: topTasks.length,
    freshness: {
      activeClaims: [...freshness.activeClaims],
      recentlyCompleted: [...freshness.recentlyCompleted],
      mustFix: [...freshness.mustFix],
    },
    tasks: topTasks.map((task) => ({
      tier: task.tier,
      screen: task.screen,
      type: task.type,
      problemClass: problemClassForIssue(task),
      owner: ownerForProblemClass(problemClassForIssue(task)),
      desc: task.desc,
      files: filesForIssue(task),
    })),
    rawTasks: topTasks,
  };
}

function main() {
  const args = parseArgs();
  const result = collectSuggestedTasks({ max: args.max, tier: args.tier });
  const topTasks = result.rawTasks || [];
  if (!topTasks.length) {
    if (!args.quiet) console.log("No actionable suggestions found - codebase looks clean.");
    process.exit(0);
  }

  if (!args.quiet) {
    console.log(`\n-- Suggested Next Tasks (${topTasks.length}) --\n`);
    for (const task of topTasks) {
      console.log(`[T${task.tier}] [${task.type}] ${task.desc}`);
      console.log(`     Screen: ${task.screen} | Problem: ${problemClassForIssue(task)} | Priority: ${task.priority}`);
      console.log();
    }
  }

  if (args.write) {
    writeToTasksFile(topTasks);
    if (!args.quiet) console.log("Written to TASKS.md suggested sections.");
  }

  if (args.quiet) {
    console.log(JSON.stringify({
      count: result.count,
      freshness: result.freshness,
      tasks: result.tasks,
    }));
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
