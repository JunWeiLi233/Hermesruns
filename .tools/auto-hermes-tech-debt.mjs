import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFAULT_COMMAND_NAME = "auto-hermes-tech-debt";
const DEFAULT_MAX_TASKS = 8;
const CATEGORY_ORDER = ["Backend Debt", "Frontend Debt", "Docs / Automation Debt"];
const SCAN_ROOTS = [
  "frontend/src",
  "backend/src",
  ".tools",
  "docs",
];
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "target",
  "coverage",
  ".ai-sync",
  ".ai-codex",
  ".tmp",
  "tmp",
  ".claude",
  ".opencode",
  ".codex",
]);
const TEXT_EXTENSIONS = new Set([
  ".js",
  ".jsx",
  ".ts",
  ".tsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".java",
  ".ps1",
  ".toml",
  ".properties",
]);
const PROTECTED_OVERSIZED_FILE_SKIP = new Set([
  "frontend/src/pages/RacesDetail.jsx",
]);

export function runAutoHermesTechDebt(options = {}) {
  const rootDir = path.resolve(options.rootDir || process.cwd());
  const commandName = options.commandName || DEFAULT_COMMAND_NAME;
  const maxTasks = Math.max(1, Number(options.maxTasks || DEFAULT_MAX_TASKS));
  const tasksPath = options.tasks || "TASKS.md";
  const tasksAbsolutePath = path.join(rootDir, tasksPath);
  const write = Boolean(options.write);
  const reportDir = options.reportDir || ".ai-sync/tech-debt";

  const files = collectRepoFiles(rootDir);
  const tasksContent = fs.existsSync(tasksAbsolutePath) ? fs.readFileSync(tasksAbsolutePath, "utf8") : "";
  const existingTitles = collectExistingTaskTitles(tasksContent);
  const candidates = collectCandidates({ files, rootDir });
  const prioritizedCandidates = chooseStrongestPerFile(candidates);
  const deduped = prioritizedCandidates
    .filter((candidate) => !existingTitles.has(candidate.title));
  const byKind = new Map();
  for (const candidate of deduped) {
    const list = byKind.get(candidate.kind) || [];
    list.push(candidate);
    byKind.set(candidate.kind, list);
  }
  const spreadSelected = [];
  const kindOrder = [...byKind.keys()].sort((a, b) => {
    const aMax = Math.max(...(byKind.get(a) || []).map((c) => c.score));
    const bMax = Math.max(...(byKind.get(b) || []).map((c) => c.score));
    return bMax - aMax;
  });
  let remaining = maxTasks;
  while (remaining > 0) {
    let added = false;
    for (const kind of kindOrder) {
      if (remaining <= 0) break;
      const list = byKind.get(kind);
      if (!list || list.length === 0) continue;
      spreadSelected.push(list.shift());
      remaining -= 1;
      added = true;
    }
    if (!added) break;
  }
  const selectedTasks = spreadSelected.map((candidate) => ({
      ...candidate,
      markdown: formatTaskMarkdown(candidate),
    }));

  const runId = `${commandName}-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}`;
  const report = {
    runId,
    commandName,
    rootDir,
    status: "completed",
    scannedRoots: SCAN_ROOTS.filter((scanRoot) => fs.existsSync(path.join(rootDir, scanRoot))),
    scannedFileCount: files.length,
    candidateCount: candidates.length,
    candidates,
    selectedTasks,
    summary: `Reviewed ${files.length} files and selected ${selectedTasks.length} bounded tech-debt task(s).`,
    taskWriteback: {
      attempted: write,
      ids: [],
    },
  };

  if (write && fs.existsSync(tasksAbsolutePath)) {
    const writeResult = writeTechDebtTasks({
      tasksContent,
      selectedTasks,
    });
    fs.writeFileSync(tasksAbsolutePath, writeResult.content, "utf8");
    report.taskWriteback.ids = writeResult.ids;
  }

  if (write) {
    writeReportArtifacts({
      rootDir,
      reportDir,
      report,
    });
  }

  return { report };
}

function collectRepoFiles(rootDir) {
  const collected = [];
  for (const scanRoot of SCAN_ROOTS) {
    const absoluteRoot = path.join(rootDir, scanRoot);
    if (!fs.existsSync(absoluteRoot)) {
      continue;
    }
    walkFiles({ rootDir, currentDir: absoluteRoot, collected });
  }
  return collected;
}

function walkFiles({ rootDir, currentDir, collected }) {
  let entries;
  try {
    entries = fs.readdirSync(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = toPosix(path.relative(rootDir, absolutePath));
    if (entry.isDirectory()) {
      if (IGNORED_DIRS.has(entry.name)) {
        continue;
      }
      walkFiles({ rootDir, currentDir: absolutePath, collected });
      continue;
    }

    const extension = path.extname(entry.name);
    if (!TEXT_EXTENSIONS.has(extension)) {
      continue;
    }

    let content;
    try {
      content = fs.readFileSync(absolutePath, "utf8");
    } catch {
      continue;
    }

    collected.push({
      absolutePath,
      relativePath,
      content,
      extension,
      lines: content.split(/\r?\n/).length,
      category: classifyCategory(relativePath),
      baseName: path.basename(relativePath),
    });
  }
}

function collectCandidates({ files, rootDir }) {
  const fileSet = new Set(files.map((file) => file.relativePath));
  const candidates = [];
  for (const file of files) {
    const debtMarkerCandidate = createDebtMarkerCandidate(file);
    if (debtMarkerCandidate) {
      candidates.push(debtMarkerCandidate);
    }

    const missingFocusedTestsCandidate = createMissingFocusedTestsCandidate(file, fileSet);
    if (missingFocusedTestsCandidate) {
      candidates.push(missingFocusedTestsCandidate);
    }

    const oversizedFileCandidate = createOversizedFileCandidate(file);
    if (oversizedFileCandidate) {
      candidates.push(oversizedFileCandidate);
    }

    const godClassCandidate = createGodClassCandidate(file);
    if (godClassCandidate) {
      candidates.push(godClassCandidate);
    }

    const deadCodeCandidate = createDeadCodeCandidate(file, fileSet);
    if (deadCodeCandidate) {
      candidates.push(deadCodeCandidate);
    }

    const hardcodedConfigCandidate = createHardcodedConfigCandidate(file);
    if (hardcodedConfigCandidate) {
      candidates.push(hardcodedConfigCandidate);
    }

    const missingErrorHandlingCandidate = createMissingErrorHandlingCandidate(file);
    if (missingErrorHandlingCandidate) {
      candidates.push(missingErrorHandlingCandidate);
    }

    const circularDependencyCandidate = createCircularDependencyCandidate(file);
    if (circularDependencyCandidate) {
      candidates.push(circularDependencyCandidate);
    }

    const inconsistentNamingCandidate = createInconsistentNamingCandidate(file);
    if (inconsistentNamingCandidate) {
      candidates.push(inconsistentNamingCandidate);
    }

    const duplicateLogicCandidate = createDuplicateLogicCandidate(file);
    if (duplicateLogicCandidate) {
      candidates.push(duplicateLogicCandidate);
    }

    const frontendErrorHandlingCandidate = createFrontendErrorHandlingCandidate(file);
    if (frontendErrorHandlingCandidate) {
      candidates.push(frontendErrorHandlingCandidate);
    }

    const godComponentCandidate = createGodComponentCandidate(file);
    if (godComponentCandidate) {
      candidates.push(godComponentCandidate);
    }

    const hardcodedApiPathsCandidate = createHardcodedApiPathsCandidate(file);
    if (hardcodedApiPathsCandidate) {
      candidates.push(hardcodedApiPathsCandidate);
    }

    const unusedImportsCandidate = createUnusedImportsCandidate(file);
    if (unusedImportsCandidate) {
      candidates.push(unusedImportsCandidate);
    }

    const accessibilityCandidate = createAccessibilityCandidate(file);
    if (accessibilityCandidate) {
      candidates.push(accessibilityCandidate);
    }
  }
  return candidates;
}

function createDebtMarkerCandidate(file) {
  const markerLines = collectDebtMarkerLines(file.content);
  if (markerLines.length === 0) {
    return null;
  }

  return {
    id: `${file.relativePath}:debt-markers`,
    kind: "debt-markers",
    category: file.category,
    score: 80 + Math.min(markerLines.length * 4, 12) + categoryWeight(file.category),
    title: `Resolve explicit debt markers in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${markerLines.length} explicit debt marker(s) remain in ${file.relativePath}, which means the repo already knows this path needs cleanup but has not converted it into a bounded fix.`,
    steps: [
      `Inspect each remaining debt marker in \`${file.relativePath}\` and confirm which one still represents real work instead of stale commentary.`,
      `Convert the surviving debt marker into an explicit helper, guard, or cleanup so the marker text can be deleted without changing behavior unexpectedly.`,
      `Run the focused verification command for the touched path and remove any stale debt markers that no longer describe live work.`,
    ],
    doneWhen: `The explicit debt markers in ${file.relativePath} are either resolved or removed because they no longer describe real work.`,
    verify: defaultVerifyCommand(file),
  };
}

function createMissingFocusedTestsCandidate(file, fileSet) {
  if (isTestFile(file.relativePath)) {
    return null;
  }

  if (file.relativePath.startsWith("backend/src/main/java/") && file.baseName.endsWith(".java")) {
    const expectedTestPath = file.relativePath
      .replace("backend/src/main/java/", "backend/src/test/java/")
      .replace(/\.java$/, "Tests.java");
    if (fileSet.has(expectedTestPath)) {
      return null;
    }

    return {
      id: `${file.relativePath}:missing-focused-tests`,
      kind: "missing-focused-tests",
      category: "Backend Debt",
      score: 78 + categoryWeight("Backend Debt"),
      title: `Add focused coverage for ${path.basename(file.baseName, ".java")}`,
      primaryFile: file.relativePath,
      files: [file.relativePath, expectedTestPath],
      context: `${file.relativePath} has no matching focused backend test file, which leaves its critical logic easier to break silently.`,
      steps: [
        `Identify the highest-risk branches in \`${file.relativePath}\` that currently lack focused regression coverage.`,
        `Add a dedicated test class at \`${expectedTestPath}\` that exercises those branches and any obvious edge cases.`,
        `Run the focused backend test and then a compile check so the new coverage proves the production path still holds.`,
      ],
      doneWhen: `${file.relativePath} has a focused test class that covers its critical behavior and the backend compile check still passes.`,
      verify: `cd backend && ./mvnw test -Dtest=${path.basename(expectedTestPath, ".java")} && ./mvnw -q -DskipTests compile`,
    };
  }

  if (file.relativePath.startsWith(".tools/") && /\.(mjs|js)$/.test(file.baseName)) {
    const expectedTestPath = file.relativePath.replace(/\.(mjs|js)$/, ".test.mjs");
    if (fileSet.has(expectedTestPath)) {
      return null;
    }

    return {
      id: `${file.relativePath}:missing-focused-tests`,
      kind: "missing-focused-tests",
      category: "Docs / Automation Debt",
      score: 70 + categoryWeight("Docs / Automation Debt"),
      title: `Add focused coverage for ${file.baseName}`,
      primaryFile: file.relativePath,
      files: [file.relativePath, expectedTestPath],
      context: `${file.relativePath} is workflow automation code without a matching focused test, which weakens trust in Hermes repo tooling.`,
      steps: [
        `Identify the bounded helper or behavior in \`${file.relativePath}\` that is most likely to drift without focused coverage.`,
        `Add a dedicated script test at \`${expectedTestPath}\` using the existing fixture-style \`.tools\` testing pattern.`,
        `Run the new script test directly and confirm the automation behavior stays green after the coverage is added.`,
      ],
      doneWhen: `${file.relativePath} has a focused \`.tools\` test file that covers the highest-risk behavior.`,
      verify: `node ${expectedTestPath}`,
    };
  }

  const frontendTestCandidate = createFrontendMissingTestsCandidate(file, fileSet);
  if (frontendTestCandidate) {
    return frontendTestCandidate;
  }

  return null;
}

function createOversizedFileCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }

  if (PROTECTED_OVERSIZED_FILE_SKIP.has(file.relativePath)) {
    return null;
  }

  const threshold = oversizedThreshold(file.category);
  if (!threshold || file.lines <= threshold) {
    return null;
  }

  return {
    id: `${file.relativePath}:oversized-file`,
    kind: "oversized-file",
    category: file.category,
    score: 65 + Math.min(Math.floor((file.lines - threshold) / 40), 15) + categoryWeight(file.category),
    title: `Split oversized ${file.baseName} into smaller units`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} is ${file.lines} lines long, which makes review, reuse, and bounded edits harder than they need to be.`,
    steps: [
      `Identify one cohesive responsibility inside \`${file.relativePath}\` that can move into a nearby helper, component, or module without changing product behavior.`,
      `Extract that responsibility into a focused file and update the original file to compose the extracted unit instead of owning everything inline.`,
      `Run the relevant verification command and confirm the split preserved behavior while reducing the file's scope.`,
    ],
    doneWhen: `${file.relativePath} is broken into smaller focused units and the original surface still behaves the same.`,
    verify: defaultVerifyCommand(file),
  };
}

function createGodClassCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java")) {
    return null;
  }
  const methodPattern = /(?:public|private|protected)\s+(?:static\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*\(/g;
  const methodMatches = file.content.match(methodPattern) || [];
  const fieldPattern = /(?:private|protected|public)\s+(?!static\s+)(?:final\s+)?(?:\w+(?:<[^>]+>)?)\s+\w+\s*[;=]/g;
  const fieldMatches = file.content.match(fieldPattern) || [];
  const dependencyPattern = /@Autowired|@Inject|@Resource\s/g;
  const dependencyMatches = file.content.match(dependencyPattern) || [];
  const methodCount = methodMatches.length;
  const fieldCount = fieldMatches.length;
  const dependencyCount = dependencyMatches.length;
  const totalWeight = methodCount + fieldCount * 2 + dependencyCount * 3;
  if (methodCount < 15 && totalWeight < 50) {
    return null;
  }
  const violationExamples = [];
  if (methodCount > 15) violationExamples.push(`${methodCount} methods (threshold: 15)`);
  if (fieldCount > 12) violationExamples.push(`${fieldCount} fields (threshold: 12)`);
  if (dependencyCount > 8) violationExamples.push(`${dependencyCount} injected dependencies (threshold: 8)`);
  if (violationExamples.length === 0) return null;
  return {
    id: `${file.relativePath}:god-class`,
    kind: "god-class",
    category: file.category,
    score: 72 + Math.min(totalWeight, 20) + categoryWeight(file.category),
    title: `Reduce class scope in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} shows God Class signals: ${violationExamples.join(", ")}. This makes the class harder to test, understand, and change independently.`,
    steps: [
      `Identify the most cohesive subset of ${methodCount} methods that share the same data and could form a separate service or helper.`,
      `Extract that subset into a focused class with a single responsibility, injecting it into the original class.`,
      `Run the backend compile check and existing tests to confirm behavior is preserved while scope is reduced.`,
    ],
    doneWhen: `${file.baseName} has fewer than 15 methods and its injected dependencies are under 8, with extracted responsibilities moved to focused helpers.`,
    verify: defaultVerifyCommand(file),
  };
}

function createDeadCodeCandidate(file, fileSet) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java") && !file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js")) {
    return null;
  }
  const javaUnusedPattern = /@Deprecated\b/g;
  const deprecatedMatches = file.content.match(javaUnusedPattern) || [];
  if (deprecatedMatches.length === 0) {
    return null;
  }
  const javaExposePattern = /@Deprecated\s*\n\s*(?:public|protected)\s+/g;
  const exposedDeprecated = file.content.match(javaExposePattern) || [];
  if (exposedDeprecated.length === 0 && deprecatedMatches.length < 3) {
    return null;
  }
  return {
    id: `${file.relativePath}:dead-code`,
    kind: "dead-code",
    category: file.category,
    score: 68 + Math.min(deprecatedMatches.length * 3, 12) + categoryWeight(file.category),
    title: `Remove dead code in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${deprecatedMatches.length} @Deprecated annotation(s). ${exposedDeprecated.length > 0 ? "Some are on public/protected members, indicating API surface that callers should migrate away from." : "They may be candidates for removal if no callers remain."}`,
    steps: [
      `Search the codebase for all call sites of each @Deprecated member in \`${file.relativePath}\`.`,
      `Remove members with zero call sites, or add migration comments and a removal timeline for members with remaining callers.`,
      `Run the compile check and tests to confirm no silent breakage from the removal.`,
    ],
    doneWhen: `${file.baseName} has no @Deprecated members with zero callers, and any remaining @Deprecated members have documented removal timelines.`,
    verify: defaultVerifyCommand(file),
  };
}

function createHardcodedConfigCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java") && !file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js")) {
    return null;
  }
  const smells = [];
  if (file.relativePath.endsWith(".java")) {
    const hardcodedUrlPattern = /"(?:https?:\/\/|mailto:)[^"]+"/g;
    const urlMatches = file.content.match(hardcodedUrlPattern) || [];
    const localhostPattern = /localhost:\d+|127\.0\.0\.1:\d+/g;
    const localhostMatches = file.content.match(localhostPattern) || [];
    const magicNumberPattern = /(?:==|!=|>=|<=|>|<)\s*\b(\d{3,})\b/g;
    const magicMatches = [];
    let magicMatch;
    while ((magicMatch = magicNumberPattern.exec(file.content)) !== null) {
      const num = parseInt(magicMatch[1], 10);
      if (num !== 200 && num !== 401 && num !== 403 && num !== 404 && num !== 500 && num !== 1000 && num !== 3600) {
        magicMatches.push(magicMatch[1]);
      }
    }
    if (urlMatches.length > 3) {
      smells.push(`${urlMatches.length} hardcoded URL(s) that should be externalized to config`);
    }
    if (localhostMatches.length > 2 && !file.relativePath.includes("test")) {
      smells.push(`${localhostMatches.length} hardcoded localhost reference(s) that break in production`);
    }
    if (magicMatches.length > 5) {
      smells.push(`${magicMatches.length} magic number comparison(s) that should be named constants`);
    }
  }
  if (file.relativePath.endsWith(".jsx") || file.relativePath.endsWith(".js")) {
    const inlineStylePattern = /style=\s*\{[^}]*[A-Za-z]+:\s*["']#[0-9a-fA-F]{3,8}["']/g;
    const inlineMatches = file.content.match(inlineStylePattern) || [];
    if (inlineMatches.length > 5) {
      smells.push(`${inlineMatches.length} inline hex color(s) that should use CSS variables or theme tokens`);
    }
  }
  if (smells.length === 0) {
    return null;
  }
  return {
    id: `${file.relativePath}:hardcoded-config`,
    kind: "hardcoded-config",
    category: file.category,
    score: 60 + smells.length * 5 + categoryWeight(file.category),
    title: `Externalize hardcoded values in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has configuration code smells: ${smells.join("; ")}.`,
    steps: [
      `Identify each hardcoded value in \`${file.relativePath}\` and determine which should move to application config, environment variables, or CSS theme tokens.`,
      `Replace hardcoded values with named constants, @Value properties, or theme variables. Keep behavioral defaults sensible.`,
      `Run the verification command and confirm no visual or behavioral regression.`,
    ],
    doneWhen: `${file.baseName} has no hardcoded URLs, localhost references in production paths, or inline magic numbers/colors that belong in configuration.`,
    verify: defaultVerifyCommand(file),
  };
}

function createMissingErrorHandlingCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java")) {
    return null;
  }
  const catchEmptyPattern = /catch\s*\([^)]+\)\s*\{\s*\}/g;
  const emptyCatchMatches = file.content.match(catchEmptyPattern) || [];
  const swallowPattern = /catch\s*\([^)]+\)\s*\{\s*(?:\/\/\s*(?:ignore|noop|silent|intended)|e\.printStackTrace\(\))/gi;
  const swallowMatches = file.content.match(swallowPattern) || [];
  const total = emptyCatchMatches.length + swallowMatches.length;
  if (total < 2) {
    return null;
  }
  return {
    id: `${file.relativePath}:missing-error-handling`,
    kind: "missing-error-handling",
    category: file.category,
    score: 74 + Math.min(total * 4, 16) + categoryWeight(file.category),
    title: `Fix swallowed exceptions in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${total} catch block(s) that silently swallow exceptions (${emptyCatchMatches.length} empty catch blocks, ${swallowMatches.length} with e.printStackTrace() or ignore comments). Swallowed exceptions hide real failures and make debugging extremely difficult.`,
    steps: [
      `Audit each empty or swallow catch block in \`${file.relativePath}\` to determine whether the exception should be logged, re-thrown, or handled with a specific recovery path.`,
      `Replace empty catch blocks with proper error handling: log at minimum, or add recovery logic. Replace e.printStackTrace() with structured logging.`,
      `Run the backend compile check and tests to verify error paths are now observable without changing product behavior.`,
    ],
    doneWhen: `${file.baseName} has no empty catch blocks and no e.printStackTrace() calls — all exceptions are logged or properly handled.`,
    verify: defaultVerifyCommand(file),
  };
}

function createCircularDependencyCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java")) {
    return null;
  }
  const constructorPattern = /public\s+\w+\s*\(([^)]*)\)\s*\{/g;
  const springInjectionPattern = /@Autowired\s*\n\s*private\s+/g;
  const autowiredMatches = file.content.match(springInjectionPattern) || [];
  let constructorMatch;
  let maxConstructorParams = 0;
  while ((constructorMatch = constructorPattern.exec(file.content)) !== null) {
    const params = constructorMatch[1].split(",").filter((p) => p.trim().length > 0);
    maxConstructorParams = Math.max(maxConstructorParams, params.length);
  }
  if (maxConstructorParams < 8 && autowiredMatches.length < 8) {
    return null;
  }
  const totalDeps = Math.max(maxConstructorParams, autowiredMatches.length);
  return {
    id: `${file.relativePath}:circular-dependency-risk`,
    kind: "circular-dependency-risk",
    category: file.category,
    score: 67 + Math.min(totalDeps * 2, 14) + categoryWeight(file.category),
    title: `Reduce dependency count in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${totalDeps} dependencies injected (constructor: ${maxConstructorParams} params, @Autowired: ${autowiredMatches.length} fields). High dependency counts increase coupling, make testing harder, and risk circular dependency chains.`,
    steps: [
      `Group the ${totalDeps} dependencies in \`${file.relativePath}\` by responsibility. Identify a cluster of 2-3 dependencies that could be extracted into a separate service.`,
      `Extract that cluster into a focused service class, then inject the new service instead of the individual dependencies.`,
      `Run the backend compile check and tests to confirm the refactor preserved behavior.`,
    ],
    doneWhen: `${file.baseName} has fewer than 8 total dependencies, with related dependencies grouped behind focused service interfaces.`,
    verify: defaultVerifyCommand(file),
  };
}

function createInconsistentNamingCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java")) {
    return null;
  }
  const className = path.basename(file.baseName, ".java");
  if (className.endsWith("Controller") || className.endsWith("Service") || className.endsWith("Repository") || className.endsWith("Component") || className.endsWith("Filter") || className.endsWith("Config") || className.endsWith("Entity") || className.endsWith("Dto")) {
    return null;
  }
  const hasRestController = /@RestController|@Controller/.test(file.content);
  const hasServiceAnnotation = /@Service/.test(file.content);
  const hasRepositoryAnnotation = /@Repository/.test(file.content);
  const hasComponentAnnotation = /@Component/.test(file.content);
  const hasConfigurationAnnotation = /@Configuration/.test(file.content);
  let expectedSuffix = "";
  let actualAnnotations = "";
  if (hasRestController) {
    expectedSuffix = "Controller";
    actualAnnotations = "@RestController";
  } else if (hasServiceAnnotation) {
    expectedSuffix = "Service";
    actualAnnotations = "@Service";
  } else if (hasRepositoryAnnotation) {
    expectedSuffix = "Repository";
    actualAnnotations = "@Repository";
  } else if (hasConfigurationAnnotation) {
    expectedSuffix = "Configuration or Config";
    actualAnnotations = "@Configuration";
  } else if (hasComponentAnnotation && !hasRestController && !hasServiceAnnotation) {
    expectedSuffix = "Component";
    actualAnnotations = "@Component";
  } else {
    return null;
  }
  if (className.endsWith(expectedSuffix)) {
    return null;
  }
  return {
    id: `${file.relativePath}:inconsistent-naming`,
    kind: "inconsistent-naming",
    category: file.category,
    score: 50 + categoryWeight(file.category),
    title: `Rename ${className} to follow Spring naming convention`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${className} is annotated with ${actualAnnotations} but does not follow the expected naming suffix '${expectedSuffix}'. Spring convention expects ${expectedSuffix}-annotated classes to end with '${expectedSuffix}' for discoverability.`,
    steps: [
      `Rename \`${className}\` to \`${className}${expectedSuffix}\` (or a semantically appropriate name ending in '${expectedSuffix}') in both the file and the class declaration.`,
      `Update all Spring component scans, dependency injections, and import references to use the new name.`,
      `Run the backend compile check and tests to confirm the rename propagates cleanly.`,
    ],
    doneWhen: `${className} is renamed to end with '${expectedSuffix}' and all references are updated.`,
    verify: defaultVerifyCommand(file),
  };
}

function createDuplicateLogicCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".java")) {
    return null;
  }
  const copyPastePattern = /(?:List<[^>]+>\s+\w+\s*=\s*new\s+ArrayList<[^>]*>\(\)|Map<[^>]+>\s+\w+\s*=\s*new\s+(?:Linked|Hash)Map<[^>]*>\(\)|Set<[^>]+>\s+\w+\s*=\s*new\s+(?:Linked)?Hash(?:Set)<[^>]*>\(\))/g;
  const collectionInits = file.content.match(copyPastePattern) || [];
  const objectCreationPattern = /new\s+(\w+)\s*\(/g;
  const creationCounts = {};
  let match;
  while ((match = objectCreationPattern.exec(file.content)) !== null) {
    const className = match[1];
    creationCounts[className] = (creationCounts[className] || 0) + 1;
  }
  const repeatedCreations = Object.entries(creationCounts)
    .filter(([, count]) => count > 5)
    .map(([className, count]) => `${className} (${count}x)`);
  if (repeatedCreations.length === 0) {
    return null;
  }
  return {
    id: `${file.relativePath}:duplicate-logic`,
    kind: "duplicate-logic",
    category: file.category,
    score: 55 + repeatedCreations.length * 5 + categoryWeight(file.category),
    title: `Extract repeated ${repeatedCreations[0].split(" ")[0]} construction into a helper`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} constructs ${repeatedCreations.join(", ")} repeatedly. This pattern suggests factory or builder methods could reduce duplication and centralize validation.`,
    steps: [
      `Identify the most repeated construction pattern in \`${file.relativePath}\` and extract it into a static factory method or builder class.`,
      `Replace the repeated constructions with calls to the new factory/builder, keeping behavior identical.`,
      `Run the backend compile check and tests to confirm the refactor preserved all behavior.`,
    ],
    doneWhen: `${file.baseName} uses factory methods or builders for its most-repeated object constructions instead of inline new expressions.`,
    verify: defaultVerifyCommand(file),
  };
}

function createFrontendMissingTestsCandidate(file, fileSet) {
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js")) {
    return null;
  }
  if (file.relativePath.includes("/utils/") || file.relativePath.includes("/hooks/") || file.relativePath.includes("/contexts/")) {
    const stem = file.relativePath.replace(/\.(jsx|js)$/, "");
    const testPaths = [
      `${stem}.test.js`,
      `${stem}.test.jsx`,
      `${stem}.spec.js`,
      `${stem}.spec.jsx`,
    ];
    if (testPaths.some((tp) => fileSet.has(tp))) {
      return null;
    }
    const relativeTestPath = testPaths[0];
    const libStem = path.basename(file.baseName, path.extname(file.baseName));
    const altTestPaths = [
      `frontend/src/__tests__/${libStem}.test.js`,
      `frontend/src/__tests__/${libStem}.test.jsx`,
    ];
    if (altTestPaths.some((tp) => fileSet.has(tp))) {
      return null;
    }
    return {
      id: `${file.relativePath}:missing-frontend-tests`,
      kind: "missing-focused-tests",
      category: "Frontend Debt",
      score: 68 + categoryWeight("Frontend Debt"),
      title: `Add frontend test coverage for ${file.baseName}`,
      primaryFile: file.relativePath,
      files: [file.relativePath, relativeTestPath],
      context: `${file.relativePath} is a utility/hook/context module without a matching test file, making regressions harder to catch before they reach users.`,
      steps: [
        `Identify the most critical pure-function or data-transformation path in \`${file.relativePath}\` that powers product behavior.`,
        `Add a focused test file at \`${relativeTestPath}\` (or \`frontend/src/__tests__/\`) covering that path with the project's existing test runner.`,
        `Run \`cd frontend && npm test\` and confirm the new tests pass alongside existing ones.`,
      ],
      doneWhen: `${file.baseName} has a focused frontend test covering its most critical path, and all frontend tests pass.`,
      verify: "cd frontend && npm test -- --watchAll=false 2>&1 | tail -5",
    };
  }
  return null;
}

function createFrontendErrorHandlingCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js") && !file.relativePath.endsWith(".mjs")) {
    return null;
  }
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  const emptyCatchPattern = /\.catch\s*\(\s*\(\s*\)\s*=>\s*\{\s*\}\s*\)/g;
  const emptyCatchMatches = file.content.match(emptyCatchPattern) || [];
  const consoleErrorOnlyPattern = /\.catch\s*\([^)]*\)\s*=>\s*\{\s*console\.error\([^)]*\);\s*\}/g;
  const consoleErrorOnlyMatches = file.content.match(consoleErrorOnlyPattern) || [];
  const unhandledPromisePattern = /\bfetch\s*\(/g;
  const fetchMatches = file.content.match(unhandledPromisePattern) || [];
  const noAwaitOrCatchPattern = /fetch\s*\([^)]*\)[^;]*?(?:\.\s*then|;|\n)/g;
  const fetchNoCatch = [];
  let fm;
  while ((fm = noAwaitOrCatchPattern.exec(file.content)) !== null) {
    const start = fm.index;
    const segment = file.content.slice(start, start + 500);
    if (!segment.includes(".catch") && !segment.includes("await") && !segment.includes("try")) {
      fetchNoCatch.push(fm[0]);
    }
  }
  const total = emptyCatchMatches.length + consoleErrorOnlyMatches.length + fetchNoCatch.length;
  if (total < 2) {
    return null;
  }
  const details = [];
  if (emptyCatchMatches.length > 0) details.push(`${emptyCatchMatches.length} empty .catch() block(s)`);
  if (consoleErrorOnlyMatches.length > 0) details.push(`${consoleErrorOnlyMatches.length} .catch() only logging console.error`);
  if (fetchNoCatch.length > 0) details.push(`${fetchNoCatch.length} fetch call(s) without error handling`);
  return {
    id: `${file.relativePath}:frontend-error-handling`,
    kind: "missing-error-handling",
    category: "Frontend Debt",
    score: 70 + Math.min(total * 4, 12) + categoryWeight("Frontend Debt"),
    title: `Fix missing error handling in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${total} error-handling issue(s): ${details.join(", ")}. Unhandled promise rejections and empty catches hide failures from users and developers.`,
    steps: [
      `Audit each empty .catch() and console.error-only handler in \`${file.relativePath}\` to determine the appropriate recovery: show a user-facing error, retry, or gracefully degrade.`,
      `Replace empty catches with proper error boundaries, toast notifications, or structured error logging. Add .catch() to unhandled fetch calls.`,
      `Run \`cd frontend && npm run lint && npm run build\` to confirm no regressions.`,
    ],
    doneWhen: `${file.baseName} has no empty .catch() blocks and no fetch calls without error handling.`,
    verify: defaultVerifyCommand(file),
  };
}

function createGodComponentCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx")) {
    return null;
  }
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  const useStatePattern = /useState\s*\(/g;
  const useStateCount = (file.content.match(useStatePattern) || []).length;
  const useEffectPattern = /useEffect\s*\(/g;
  const useEffectCount = (file.content.match(useEffectPattern) || []).length;
  const useMemoPattern = /useMemo\s*\(/g;
  const useMemoCount = (file.content.match(useMemoPattern) || []).length;
  const useCallbackPattern = /useCallback\s*\(/g;
  const useCallbackCount = (file.content.match(useCallbackPattern) || []).length;
  const totalHooks = useStateCount + useEffectCount + useMemoCount + useCallbackCount;
  if (useStateCount < 8 && totalHooks < 15) {
    return null;
  }
  const details = [];
  if (useStateCount >= 8) details.push(`${useStateCount} useState calls (threshold: 8)`);
  if (totalHooks >= 15) details.push(`${totalHooks} total hooks (threshold: 15)`);
  if (details.length === 0) return null;
  return {
    id: `${file.relativePath}:god-component`,
    kind: "god-class",
    category: "Frontend Debt",
    score: 70 + Math.min(totalHooks, 20) + categoryWeight("Frontend Debt"),
    title: `Reduce component scope in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} shows large component signals: ${details.join(", ")}. This makes the component harder to test, understand, and render efficiently.`,
    steps: [
      `Identify the most cohesive subset of state and effects in \`${file.relativePath}\` that could form a custom hook (e.g., useXyzLoader, useXyzState).`,
      `Extract that subset into a focused custom hook in the same directory, then compose it from the original component.`,
      `Run \`cd frontend && npm run lint && npm run build\` to confirm the split preserved behavior while reducing the component's scope.`,
    ],
    doneWhen: `${file.baseName} has fewer than 8 useState calls and under 15 total hooks, with extracted responsibilities moved to custom hooks.`,
    verify: defaultVerifyCommand(file),
  };
}

function createHardcodedApiPathsCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js") && !file.relativePath.endsWith(".mjs")) {
    return null;
  }
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  const smells = [];
  const apiPathPattern = /['"`](\/api\/[^'"`)]+)['"`]/g;
  const apiPathMatches = [];
  let apm;
  while ((apm = apiPathPattern.exec(file.content)) !== null) {
    apiPathMatches.push(apm[1]);
  }
  if (apiPathMatches.length > 5) {
    const uniquePaths = [...new Set(apiPathMatches)];
    smells.push(`${uniquePaths.length} unique hardcoded API path(s): ${uniquePaths.slice(0, 3).join(", ")}${uniquePaths.length > 3 ? "..." : ""}`);
  }
  const localhostPattern = /localhost:\d+|127\.0\.0\.1:\d+/g;
  const localhostMatches = file.content.match(localhostPattern) || [];
  if (localhostMatches.length > 0) {
    smells.push(`${localhostMatches.length} hardcoded localhost reference(s)`);
  }
  const magicColorPattern = /(?:backgroundColor|color|borderColor|background):\s*['"`]#[0-9a-fA-F]{3,8}['"`]/g;
  const magicColorMatches = file.content.match(magicColorPattern) || [];
  if (magicColorMatches.length > 8) {
    smells.push(`${magicColorMatches.length} inline hex color(s) that should use CSS variables or theme tokens`);
  }
  if (smells.length === 0) {
    return null;
  }
  return {
    id: `${file.relativePath}:hardcoded-config`,
    kind: "hardcoded-config",
    category: "Frontend Debt",
    score: 58 + smells.length * 6 + categoryWeight("Frontend Debt"),
    title: `Externalize hardcoded values in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has frontend configuration code smells: ${smells.join("; ")}.`,
    steps: [
      `Identify each hardcoded API path, localhost reference, or inline color in \`${file.relativePath}\` and determine which should move to constants, env vars, or CSS theme tokens.`,
      `Replace hardcoded values with named constants, API helper functions, or CSS custom properties. Keep behavioral defaults sensible.`,
      `Run \`cd frontend && npm run lint && npm run build\` and confirm no visual or behavioral regression.`,
    ],
    doneWhen: `${file.baseName} has no hardcoded localhost references in production code, API paths centralized into a helper, and inline colors extracted to CSS variables.`,
    verify: defaultVerifyCommand(file),
  };
}

function createUnusedImportsCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx") && !file.relativePath.endsWith(".js")) {
    return null;
  }
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  const importPattern = /import\s+(?:(?:\{[^}]*\}|\*\s+as\s+\w+|\w+)(?:\s*,\s*(?:\{[^}]*\}|\*\s+as\s+\w+|\w+))*)\s+from\s+['"][^'"]+['"]/g;
  const importMatches = file.content.match(importPattern) || [];
  if (importMatches.length < 5) {
    return null;
  }
  const unusedImports = [];
  function extractNames(importLine) {
    const fromMatch = importLine.match(/from\s+['"]([^'"]+)['"]/);
    const source = fromMatch ? fromMatch[1] : "";
    if (/^\.\.\//.test(source) || /^\.\//.test(source)) {
      return [];
    }
    const namedMatch = importLine.match(/import\s+\{([^}]+)\}/);
    if (namedMatch) {
      return namedMatch[1].split(",").map((n) => n.trim().split(/\s+as\s+/)[0].trim()).filter(Boolean);
    }
    const defaultMatch = importLine.match(/import\s+(\w+)\s+from/);
    if (defaultMatch) {
      return [defaultMatch[1]];
    }
    return [];
  }
  for (const importLine of importMatches) {
    const names = extractNames(importLine);
    for (const name of names) {
      const nameRegex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "g");
      const usages = file.content.match(nameRegex) || [];
      if (usages.length <= 1) {
        unusedImports.push(name);
      }
    }
  }
  if (unusedImports.length < 3) {
    return null;
  }
  return {
    id: `${file.relativePath}:unused-imports`,
    kind: "hardcoded-config",
    category: "Frontend Debt",
    score: 52 + Math.min(unusedImports.length * 3, 12) + categoryWeight("Frontend Debt"),
    title: `Remove unused imports in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${unusedImports.length} likely unused import(s): ${unusedImports.slice(0, 5).join(", ")}${unusedImports.length > 5 ? "..." : ""}. Unused imports increase bundle size and slow code review.`,
    steps: [
      `Run \`npx eslint --rule 'no-unused-vars: error' ${file.relativePath}\` or manually verify each suspected unused import in \`${file.relativePath}\`.`,
      `Remove confirmed unused imports. If any are re-exports needed by other modules, add a side-effect import comment.`,
      `Run \`cd frontend && npm run lint && npm run build\` to confirm no breakage.`,
    ],
    doneWhen: `${file.baseName} has no unused imports from third-party or cross-module packages.`,
    verify: defaultVerifyCommand(file),
  };
}

function createAccessibilityCandidate(file) {
  if (isTestFile(file.relativePath)) {
    return null;
  }
  if (!file.relativePath.endsWith(".jsx")) {
    return null;
  }
  if (!file.relativePath.startsWith("frontend/src/")) {
    return null;
  }
  const onClickPattern = /<button[^>]*onClick\s*=/g;
  const buttonClickMatches = file.content.match(onClickPattern) || [];
  const buttonWithoutAria = [];
  for (const match of buttonClickMatches) {
    const matchStr = match;
    if (!matchStr.includes("aria-label") && !matchStr.includes("aria-labelledby") && !matchStr.includes(">")) {
      buttonWithoutAria.push(matchStr);
    }
  }
  const iconButtonPattern = /className="[^"]*icon[^"]*"[^>]*onClick/gi;
  const iconClickMatches = file.content.match(iconButtonPattern) || [];
  const iconWithoutAria = [];
  for (const match of iconClickMatches) {
    if (!match.includes("aria-label")) {
      iconWithoutAria.push(match);
    }
  }
  const total = buttonWithoutAria.length + iconWithoutAria.length;
  if (total < 3) {
    return null;
  }
  return {
    id: `${file.relativePath}:accessibility-missing`,
    kind: "missing-error-handling",
    category: "Frontend Debt",
    score: 56 + Math.min(total * 3, 12) + categoryWeight("Frontend Debt"),
    title: `Add ARIA labels to interactive elements in ${file.baseName}`,
    primaryFile: file.relativePath,
    files: [file.relativePath],
    context: `${file.relativePath} has ${total} interactive element(s) (buttons, icon buttons) without aria-label or accessible text. Screen readers cannot convey their purpose to users with visual impairments.`,
    steps: [
      `Audit each onClick handler in \`${file.relativePath}\` that lacks an aria-label or visible text content.`,
      `Add descriptive aria-label attributes to icon-only buttons and interactive elements. For elements with visible text, ensure the label is redundant.`,
      `Run \`cd frontend && npm run lint && npm run build\` and optionally test with a screen reader to confirm accessibility improvements.`,
    ],
    doneWhen: `${file.baseName} has no icon-only buttons or onClick elements without an aria-label or accessible text.`,
    verify: defaultVerifyCommand(file),
  };
}

const KIND_PRIORITY = {
  "debt-markers": 10,
  "god-class": 9,
  "missing-error-handling": 8,
  "circular-dependency-risk": 7,
  "hardcoded-config": 6,
  "dead-code": 5,
  "duplicate-logic": 4,
  "oversized-file": 3,
  "inconsistent-naming": 2,
  "missing-focused-tests": 1,
  "frontend-error-handling": 8,
  "god-component": 7,
  "unused-imports": 4,
  "accessibility-missing": 3,
};

const MAX_KINDS_PER_FILE = 2;

function chooseStrongestPerFile(candidates) {
  for (const candidate of candidates) {
    const kindPriority = KIND_PRIORITY[candidate.kind] || 0;
    candidate.score = candidate.score + kindPriority;
  }
  const sorted = candidates.slice().sort(compareCandidates);
  const byFile = new Map();
  for (const candidate of sorted) {
    const existingKinds = byFile.get(candidate.primaryFile) || [];
    if (existingKinds.length < MAX_KINDS_PER_FILE) {
      existingKinds.push(candidate);
      byFile.set(candidate.primaryFile, existingKinds);
    }
  }
  const result = [];
  for (const kinds of byFile.values()) {
    result.push(...kinds);
  }
  return result;
}

function compareCandidates(a, b) {
  if (a.score !== b.score) {
    return b.score - a.score;
  }
  const categoryDelta = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
  if (categoryDelta !== 0) {
    return categoryDelta;
  }
  return a.title.localeCompare(b.title);
}

function collectExistingTaskTitles(tasksContent) {
  const titles = new Set();
  const matches = tasksContent.matchAll(/^- \[[ x]\] (.+)$/gm);
  for (const match of matches) {
    titles.add(match[1].trim());
  }
  return titles;
}

function writeTechDebtTasks({ tasksContent, selectedTasks }) {
  let nextContent = tasksContent;
  const ids = [];
  for (const task of selectedTasks) {
    if (nextContent.includes(`- [ ] ${task.title}`)) {
      continue;
    }
    nextContent = insertTaskIntoTechDebtSection(nextContent, task);
    ids.push(task.id);
  }
  return { content: nextContent, ids };
}

function insertTaskIntoTechDebtSection(tasksContent, task) {
  const sectionHeading = "## Tech Debt Tasks";
  const sectionStart = tasksContent.indexOf(sectionHeading);
  if (sectionStart === -1) {
    return tasksContent;
  }

  const sectionLineEnd = tasksContent.indexOf("\n", sectionStart);
  const remainder = tasksContent.slice(sectionLineEnd + 1);
  const nextSectionOffset = remainder.search(/^## /m);
  const sectionEnd = nextSectionOffset === -1 ? tasksContent.length : sectionLineEnd + 1 + nextSectionOffset;
  let sectionBody = tasksContent.slice(sectionLineEnd + 1, sectionEnd);
  const before = tasksContent.slice(0, sectionLineEnd + 1);
  const after = tasksContent.slice(sectionEnd);

  for (const category of CATEGORY_ORDER) {
    if (!sectionBody.includes(`### ${category}`)) {
      sectionBody = `${sectionBody.trimEnd()}\n### ${category}\n`;
    }
  }

  const categoryHeading = `### ${task.category}`;
  const categoryStart = sectionBody.indexOf(categoryHeading);
  const categoryLineEnd = sectionBody.indexOf("\n", categoryStart);
  const tail = sectionBody.slice(categoryLineEnd + 1);
  const nextCategoryOffset = tail.search(/^### /m);
  const categoryEnd = nextCategoryOffset === -1 ? sectionBody.length : categoryLineEnd + 1 + nextCategoryOffset;
  const categoryBody = sectionBody.slice(categoryLineEnd + 1, categoryEnd).trimEnd();
  const updatedCategoryBody = `${categoryBody ? `${categoryBody}\n` : ""}${task.markdown}\n`;

  sectionBody = sectionBody.slice(0, categoryLineEnd + 1) + updatedCategoryBody + sectionBody.slice(categoryEnd);
  return `${before}${sectionBody}${after}`;
}

function formatTaskMarkdown(task) {
  const filesText = task.files.map((file) => `\`${file}\``).join(", ");
  const stepsText = task.steps.map((step, index) => `  ${index + 1}. ${step}`).join("\n");
  return `- [ ] ${task.title}
  Files: ${filesText}
  Context: ${task.context}
  Steps:
${stepsText}
  Done when: ${task.doneWhen}
  Verify: \`${task.verify}\``;
}

function writeReportArtifacts({ rootDir, reportDir, report }) {
  const absoluteReportDir = path.join(rootDir, reportDir);
  fs.mkdirSync(absoluteReportDir, { recursive: true });
  fs.writeFileSync(path.join(absoluteReportDir, `${report.runId}.json`), JSON.stringify(report, null, 2), "utf8");
  fs.writeFileSync(path.join(absoluteReportDir, `${report.runId}.md`), formatMarkdownReport(report), "utf8");
}

function formatMarkdownReport(report) {
  const lines = [
    "# Auto-Hermes Tech Debt",
    "",
    `Run Id: ${report.runId}`,
    `Command: ${report.commandName}`,
    `Status: ${report.status}`,
    "",
    "## Summary",
    `- Scanned roots: ${report.scannedRoots.join(", ") || "none"}`,
    `- Scanned files: ${report.scannedFileCount}`,
    `- Candidate count: ${report.candidateCount}`,
    `- Selected tasks: ${report.selectedTasks.length}`,
    `- Wrote tasks: ${report.taskWriteback.ids.length}`,
    "",
    "## Selected Tasks",
  ];

  if (report.selectedTasks.length === 0) {
    lines.push("- none");
  } else {
    for (const task of report.selectedTasks) {
      lines.push(`- ${task.title} (${task.category})`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function defaultVerifyCommand(file) {
  if (file.category === "Frontend Debt") {
    return "cd frontend && npm run build";
  }
  if (file.category === "Backend Debt") {
    return "cd backend && ./mvnw -q -DskipTests compile";
  }
  if (file.relativePath.startsWith(".tools/")) {
    return `node ${file.relativePath}`;
  }
  return "node .tools/auto-hermes-tech-debt.mjs --json";
}

function collectDebtMarkerLines(content) {
  return content
    .split(/\r?\n/)
    .filter((line) => /^\s*(\/\/|#|\/\*+|\*|<!--)\s*(TODO|FIXME|HACK|XXX)\b/i.test(line));
}

function classifyCategory(relativePath) {
  if (relativePath.startsWith("frontend/src/")) {
    return "Frontend Debt";
  }
  if (relativePath.startsWith("backend/src/")) {
    return "Backend Debt";
  }
  return "Docs / Automation Debt";
}

function categoryWeight(category) {
  if (category === "Backend Debt") {
    return 10;
  }
  if (category === "Frontend Debt") {
    return 6;
  }
  return 4;
}

function oversizedThreshold(category) {
  if (category === "Frontend Debt") {
    return 700;
  }
  if (category === "Backend Debt") {
    return 550;
  }
  if (category === "Docs / Automation Debt") {
    return 450;
  }
  return 0;
}

function isTestFile(relativePath) {
  return (
    /\.test\.[^.]+$/.test(relativePath) ||
    /\.smoke\.test\.[^.]+$/.test(relativePath) ||
    /Tests\.java$/.test(relativePath) ||
    /Test\.java$/.test(relativePath)
  );
}

function toPosix(value) {
  return value.split(path.sep).join("/");
}

function parseArgs(argv) {
  const options = {
    write: false,
    json: false,
    maxTasks: DEFAULT_MAX_TASKS,
    commandName: DEFAULT_COMMAND_NAME,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") {
      options.write = true;
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--max") {
      options.maxTasks = Number(argv[index + 1] || DEFAULT_MAX_TASKS);
      index += 1;
      continue;
    }
    if (arg === "--command-name") {
      options.commandName = argv[index + 1] || DEFAULT_COMMAND_NAME;
      index += 1;
      continue;
    }
  }

  return options;
}

const thisFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === thisFilePath) {
  const options = parseArgs(process.argv.slice(2));
  const { report } = runAutoHermesTechDebt(options);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(formatMarkdownReport(report));
  }
}
