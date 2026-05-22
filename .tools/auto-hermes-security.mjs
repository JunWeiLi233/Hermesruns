#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);
const STANDARD_ATTACK_PROBES = [
  "auth-bypass",
  "data-leak",
  "idor",
  "injection",
  "mass-assignment",
  "webhook-abuse",
  "cors",
  "rate-limit",
  "security-headers",
  "url-enumeration",
  "user-enumeration",
];
const AGGRESSIVE_ATTACK_PROBES = [
  "admin-enumeration",
  "admin-credential-stuffing",
  "admin-data-exfil",
];
const SEVERITY_ORDER = {
  LOW: 1,
  MEDIUM: 2,
  HIGH: 3,
  CRITICAL: 4,
};

function parseArgs(rawArgs) {
  const args = {
    rootDir: ROOT,
    mode: "audit",
    commandName: "auto-hermes-security",
    runtimeBaseUrl: "",
    outputDir: ".ai-sync/security-reports",
    tasks: "TASKS.md",
    write: false,
    writeTasks: false,
    aggressive: false,
    json: false,
  };

  for (let index = 0; index < rawArgs.length; index += 1) {
    const arg = rawArgs[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--write-tasks") args.writeTasks = true;
    else if (arg === "--aggressive") args.aggressive = true;
    else if (arg === "--json") args.json = true;
    else if (arg.startsWith("--")) {
      const key = arg
        .slice(2)
        .replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args && index + 1 < rawArgs.length) {
        args[key] = rawArgs[index + 1];
        index += 1;
      }
    }
  }

  args.rootDir = path.resolve(String(args.rootDir || ROOT));
  args.mode = String(args.mode || "audit").trim().toLowerCase();
  args.commandName = String(args.commandName || "auto-hermes-security").trim() || "auto-hermes-security";
  args.outputDir = String(args.outputDir || ".ai-sync/security-reports").trim() || ".ai-sync/security-reports";
  args.tasks = String(args.tasks || "TASKS.md").trim() || "TASKS.md";
  args.runtimeBaseUrl = String(args.runtimeBaseUrl || "").trim();

  return args;
}

function nowIso() {
  return new Date().toISOString();
}

function makeRunId(commandName) {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const normalized = String(commandName || "auto-hermes-security")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-");
  return `${normalized}-${stamp}`;
}

function resolveFromRoot(rootDir, relPath) {
  return path.isAbsolute(relPath) ? relPath : path.join(rootDir, relPath);
}

function ensureParent(targetPath) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
}

function readText(filePath) {
  try {
    return fs.readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function walkFiles(baseDir, predicate) {
  if (!fs.existsSync(baseDir)) return [];

  const results = [];
  const stack = [baseDir];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fs.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }

    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        stack.push(fullPath);
        continue;
      }
      if (!predicate || predicate(fullPath)) {
        results.push(fullPath);
      }
    }
  }

  return results.sort();
}

function toRel(rootDir, filePath) {
  return filePath.replace(`${rootDir}${path.sep}`, "").replace(/\\/g, "/");
}

function normalizeSecurityRelPath(relPath) {
  return String(relPath || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

function isIgnoredSecurityScanPath(relPath) {
  const rel = normalizeSecurityRelPath(relPath);
  if (!rel) return true;
  if (rel.startsWith(".git/")) return true;
  if (rel.startsWith(".ai-codex/")) return true;
  if (rel.startsWith(".ai-sync/")) return true;
  if (rel.startsWith(".claude/")) return true;
  if (rel.startsWith(".gemini/")) return true;
  if (rel.startsWith(".mempalace/")) return true;
  if (rel.startsWith(".omx/")) return true;
  if (rel.startsWith(".tmp/")) return true;
  if (rel.startsWith(".worktrees/")) return true;
  if (rel.startsWith(".share/")) return true;
  if (rel === "Hermes.local.env.ps1") return true;
  if (rel.startsWith(".venv/")) return true;
  if (rel.startsWith("Hermes/")) return true;
  if (/^Qwen(?:2\.5)?-VL-[^/]+\//.test(rel)) return true;
  if (rel.startsWith(".codex/")) {
    const allowedCodexPath = rel.startsWith(".codex/commands/")
      || rel.startsWith(".codex/workflows/")
      || rel.startsWith(".codex/skills/architecture-diagram-generator/");
    if (!allowedCodexPath) return true;
  }
  if (rel.startsWith(".codex/tmp/")) return true;
  if (rel.startsWith(".cursor/")) return true;
  if (rel.startsWith(".superpowers/")) return true;
  if (/^\.opencode[^/]*(\/|$)/.test(rel)) return true;
  if (rel.startsWith(".oh-my-openagent/")) return true;
  if (rel === ".tools/claude-code.ps1" || rel === ".tools/claude-deepseek.ps1" || rel === ".tools/rtk-codex-health.ps1") return true;
  if (rel.startsWith(".tools/token_tester/") || rel.includes("/token_tester/tmp/")) return true;
  if (rel.startsWith(".tools/prompt_optimizer/")) return true;
  if (rel.startsWith(".tools/mempalace/")) return true;
  if (rel.startsWith("backend/src/main/resources/static/")) return true;
  if (rel.startsWith("backend/target/")) return true;
  if (rel.startsWith("backend/.venv/")) return true;
  if (rel.startsWith("frontend/dist/")) return true;
  if (rel.startsWith("frontend/node_modules/") || rel.startsWith("node_modules/") || rel.includes("/node_modules/")) return true;
  if (rel.startsWith("course-map-images/") || rel.startsWith("backend/course-map-images/")) return true;
  if (rel.endsWith(".lock.db") || rel.endsWith(".trace.db") || rel.endsWith(".mv.db")) return true;
  return false;
}

function firstMatch(content, pattern, fallback = "") {
  const match = content.match(pattern);
  return match ? match[1] : fallback;
}

function normalizeEndpointPath(basePath, methodPath) {
  const base = String(basePath || "").trim();
  const method = String(methodPath || "").trim();
  if (!base && !method) return "";
  if (!base) return method || "/";
  if (!method) return base || "/";
  if (method === "/") return base;
  return `${base.replace(/\/$/, "")}/${method.replace(/^\//, "")}`;
}

function parseRuntimeTarget(runtimeBaseUrl) {
  if (!runtimeBaseUrl) {
    return {
      provided: false,
      baseUrl: "",
      hostname: "",
      localDev: false,
    };
  }

  try {
    const url = new URL(runtimeBaseUrl);
    const hostname = String(url.hostname || "").trim().toLowerCase();
    const localDev = LOCAL_HOSTS.has(hostname)
      || hostname.endsWith(".local")
      || hostname.includes("dev");
    return {
      provided: true,
      baseUrl: runtimeBaseUrl,
      hostname,
      localDev,
    };
  } catch {
    return {
      provided: true,
      baseUrl: runtimeBaseUrl,
      hostname: "",
      localDev: false,
    };
  }
}

function discoverTables(rootDir) {
  const backendDir = path.join(rootDir, "backend", "src", "main", "java");
  const javaFiles = walkFiles(backendDir, (filePath) => filePath.endsWith(".java"));
  const tables = [];

  for (const filePath of javaFiles) {
    const content = readText(filePath);
    if (!/@Entity\b/.test(content)) continue;
    const className = firstMatch(content, /\bclass\s+([A-Za-z0-9_]+)/, path.basename(filePath, ".java"));
    const tableName = firstMatch(content, /@Table\s*\(\s*name\s*=\s*"([^"]+)"/, className.replace(/([a-z])([A-Z])/g, "$1_$2").toLowerCase());
    const ownershipSignals = [
      /\bRunner\b/,
      /\brunnerId\b/,
      /\buserId\b/,
      /\bownerId\b/,
      /\btenantId\b/,
      /@ManyToOne[\s\S]*?\bRunner\b/,
    ].some((pattern) => pattern.test(content));

    tables.push({
      name: tableName,
      className,
      file: toRel(rootDir, filePath),
      ownershipSignals,
    });
  }

  return tables;
}

function discoverEndpoints(rootDir) {
  const backendDir = path.join(rootDir, "backend", "src", "main", "java");
  const javaFiles = walkFiles(backendDir, (filePath) => filePath.endsWith(".java"));
  const endpoints = [];

  for (const filePath of javaFiles) {
    const content = readText(filePath);
    if (!/@(?:RestController|Controller)\b/.test(content)) continue;

    const className = firstMatch(content, /\bclass\s+([A-Za-z0-9_]+)/, path.basename(filePath, ".java"));
    const classBase = firstMatch(content, /@RequestMapping\s*\(\s*"([^"]*)"/, "")
      || firstMatch(content, /@RequestMapping\s*\(\s*value\s*=\s*"([^"]*)"/, "");

    const methodPattern = /@(Get|Post|Put|Delete|Patch)Mapping(?:\(([^)]*)\))?/g;
    let match = methodPattern.exec(content);
    let foundMethod = false;
    while (match) {
      foundMethod = true;
      const verb = `${match[1].toUpperCase()}`;
      const args = match[2] || "";
      const methodPath = firstMatch(args, /"([^"]*)"/, "");
      endpoints.push({
        file: toRel(rootDir, filePath),
        controller: className,
        method: verb,
        path: normalizeEndpointPath(classBase, methodPath || ""),
      });
      match = methodPattern.exec(content);
    }

    if (!foundMethod && classBase) {
      endpoints.push({
        file: toRel(rootDir, filePath),
        controller: className,
        method: "ANY",
        path: classBase,
      });
    }
  }

  return endpoints;
}

function discoverForms(rootDir) {
  const frontendDir = path.join(rootDir, "frontend", "src");
  const frontendFiles = walkFiles(
    frontendDir,
    (filePath) => [".jsx", ".js", ".tsx", ".ts"].includes(path.extname(filePath)),
  );
  const forms = [];

  for (const filePath of frontendFiles) {
    const content = readText(filePath);
    if (!/<form\b|onSubmit=/.test(content)) continue;

    const inputs = [];
    const inputPattern = /<(input|textarea|select)\b[^>]*?(?:name="([^"]+)")?[^>]*?(?:type="([^"]+)")?[^>]*?>/g;
    let match = inputPattern.exec(content);
    while (match) {
      inputs.push({
        tag: match[1],
        name: match[2] || "",
        type: match[3] || "",
      });
      match = inputPattern.exec(content);
    }

    forms.push({
      file: toRel(rootDir, filePath),
      hasPassword: /type="password"/.test(content),
      submitHandlers: (content.match(/onSubmit=/g) || []).length,
      inputs,
    });
  }

  return forms;
}

function discoverConfigFiles(rootDir) {
  const configTargets = [
    path.join(rootDir, "backend", "src", "main", "resources", "application.properties"),
    path.join(rootDir, "backend", "src", "main", "resources", "application-production.properties"),
  ];

  return configTargets
    .filter((filePath) => fs.existsSync(filePath))
    .map((filePath) => ({
      file: toRel(rootDir, filePath),
      content: readText(filePath),
    }));
}

function discoverSecurityInventory(rootDir) {
  return {
    tables: discoverTables(rootDir),
    endpoints: discoverEndpoints(rootDir),
    forms: discoverForms(rootDir),
    configFiles: discoverConfigFiles(rootDir),
  };
}

function makeFinding({
  checker,
  severity,
  summary,
  target,
  file = "",
  evidence = [],
  verification = "static-only",
  confidence = 0.5,
}) {
  return {
    id: `${checker}:${target}:${summary}`.toLowerCase().replace(/[^a-z0-9:.-]+/g, "-"),
    checker,
    severity,
    summary,
    target,
    file,
    evidence,
    verification,
    confidence,
  };
}

function runRlsAuditor(inventory) {
  const findings = [];
  for (const table of inventory.tables) {
    if (table.ownershipSignals) continue;
    // Whitelist global catalog/config tables that are intended to be public/shared
    if (table.name.includes("catalog") || table.name.includes("asset") || table.name.includes("audit") || table.name.includes("config")) {
       continue;
    }

    findings.push(
      makeFinding({
        checker: "rls-auditor",
        severity: "HIGH",
        summary: "Missing Row-Level Ownership: Potential for unauthorized data access.",
        target: table.name,
        file: table.file,
        evidence: [
          `Entity class ${table.className} maps to table ${table.name}.`,
          "Critical: No runnerId/userId/ownerId detected. This entity might be accessible to any authenticated (or unauthenticated) user.",
        ],
        confidence: 0.8,
      }),
    );
  }
  return findings;
}

function runIdorHunter(rootDir, inventory) {
  const findings = [];
  // Look for endpoints that take an {id} but the controller doesn't use findByRunner or equivalent ownership guards
  const idEndpoints = inventory.endpoints.filter(e => e.path.includes("{id}") || e.path.includes("{identifier}"));

  for (const endpoint of idEndpoints) {
    const content = readText(path.join(rootDir, endpoint.file));
    // Heuristic: If it uses findById(id) but NOT findByIdAndRunner(id, runner) or similar
    const usesFindById = /\.findById\s*\(/.test(content);
    const usesOwnershipFind = /\.find(?:By.*)?AndRunner\s*\(/.test(content) || /\.findByRunner\s*\(/.test(content);
    const hasAuthPrincipal = /@AuthenticationPrincipal|authService\.getCurrentRunner/.test(content);

    if (usesFindById && !usesOwnershipFind && !hasAuthPrincipal) {
        findings.push(
            makeFinding({
                checker: "idor-hunter",
                severity: "HIGH",
                summary: "Potential IDOR: Endpoint accesses resource by ID without verifying ownership.",
                target: `${endpoint.method} ${endpoint.path}`,
                file: endpoint.file,
                evidence: [
                    "Endpoint accepts a resource ID but the controller appears to use a generic 'findById' call without a 'runner' constraint.",
                ],
                confidence: 0.7,
            })
        );
    }
  }
  return findings;
}

function runPiiLeakHunter(rootDir, inventory) {
  const findings = [];
  const piiFields = ["email", "phone", "address", "birthday", "dob", "ssn", "password", "token", "secret"];

  // Check both entities and DTOs
  const backendDir = path.join(rootDir, "backend", "src", "main", "java");
  const javaFiles = walkFiles(backendDir, (filePath) => filePath.endsWith(".java"));

  for (const filePath of javaFiles) {
    const content = readText(filePath);
    // Ignore password field if it's annotated with @JsonIgnore
    const hasPii = piiFields.some(field => {
        const re = new RegExp(`\\bprivate\\s+String\\s+${field}\\b`, "i");
        if (re.test(content)) {
            // Check if it has @JsonIgnore or @JsonProperty(access = WRITE_ONLY)
            const fieldLines = content.split("\n");
            const fieldIdx = fieldLines.findIndex(l => re.test(l));
            if (fieldIdx > 0) {
                const prevLine = fieldLines[fieldIdx - 1];
                if (/@JsonIgnore|WRITE_ONLY/.test(prevLine)) return false;
            }
            return true;
        }
        return false;
    });

    if (hasPii) {
        findings.push(
            makeFinding({
                checker: "pii-leak-hunter",
                severity: "MEDIUM",
                summary: "Sensitive Data Exposure: Entity/DTO might leak PII in JSON responses.",
                target: toRel(rootDir, filePath),
                file: toRel(rootDir, filePath),
                evidence: ["Detected potential PII field without explicit @JsonIgnore or Write-Only protection."],
                confidence: 0.6,
            })
        );
    }
  }
  return findings;
}

function runSecretAndPiiHunter(rootDir) {
  const findings = [];
  const PII_LITERALS = (process.env.AUTO_HERMES_PII_LITERALS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  const SECRET_PATTERNS = [
    { name: "Generic API Key", regex: /[a-f0-9]{32,64}/gi },
    { name: "High Entropy Alphanumeric", regex: /[a-zA-Z0-9\/+]{40,}/g },
    { name: "OpenAI Key", regex: /sk-[a-zA-Z0-9]{32,}/g },
    { name: "Stripe Key", regex: /(sk|pk)_(test|live)_[0-9a-zA-Z]{24}/g },
    { name: "Google API Key", regex: /AIza[0-9A-Za-z\-_]{35}/g },
    { name: "Google OAuth Secret", regex: /GOCSPX-[0-9A-Za-z\-_]{28}/g },
    { name: "Private Key", regex: /-----BEGIN (RSA|EC|PRIVATE) KEY-----/g },
  ];

  // Only scan textual files that are likely to contain secrets but shouldn't
  const scanExtensions = [".java", ".js", ".jsx", ".ts", ".tsx", ".md", ".json", ".properties", ".ps1", ".bat", ".sh", ".yml", ".yaml"];
  const allFiles = walkFiles(rootDir, (f) => {
    const ext = path.extname(f).toLowerCase();
    const rel = toRel(rootDir, f);
    return scanExtensions.includes(ext) && 
           !isIgnoredSecurityScanPath(rel) &&
           !rel.endsWith(".example.ps1") &&
           !rel.endsWith(".example.json") &&
           !rel.endsWith(".example.yml") &&
           !rel.endsWith(".example.yaml");
  });

  for (const filePath of allFiles) {
    const content = readText(filePath);
    const relPath = toRel(rootDir, filePath);

    // 1. Check PII Literals
    for (const pii of PII_LITERALS) {
      const expectedPublishIdentity = /auto-hermes|auto-ship|auto-commit|git-and-publish|daily-operator-guide|DESIGN_VERSIONS|AGENTS\.md|CLAUDE\.md|^\.codex\/(?:commands|workflows|skills)\//.test(relPath);
      if (expectedPublishIdentity) continue;
      if (relPath.includes("/src/test/")) continue;
      if (content.toLowerCase().includes(pii.toLowerCase())) {
        findings.push(makeFinding({
          checker: "secret-pii-hunter",
          severity: "CRITICAL",
          summary: `Personal Information (PII) detected: "${pii}"`,
          target: relPath,
          file: relPath,
          evidence: [`Found literal "${pii}" in ${relPath}. Redact this before committing.`],
          confidence: 0.9,
        }));
      }
    }

    // 2. Check Secret Patterns
    for (const pat of SECRET_PATTERNS) {
      const flags = pat.regex.flags.includes("g") ? pat.regex.flags : `${pat.regex.flags}g`;
      const matcher = new RegExp(pat.regex.source, flags);
      const matches = Array.from(content.matchAll(matcher));
      if (matches) {
        // Simple heuristic: ignore if it looks like a version number, hash, or common non-secret
        const suspicious = matches.filter(match => {
          const m = match[0];
          const ext = path.extname(relPath).toLowerCase();
          if ([".md", ".html", ".svg"].includes(ext) && ["Generic API Key", "High Entropy Alphanumeric"].includes(pat.name)) return false;
          if (["Generic API Key", "High Entropy Alphanumeric"].includes(pat.name)) {
            const index = typeof match.index === "number" ? match.index : content.indexOf(m);
            const context = content.slice(Math.max(0, index - 120), Math.min(content.length, index + m.length + 120));
            if (!SENSITIVE_KEY_PATTERNS.test(context)) return false;
            const before = index > 0 ? content[index - 1] : "";
            const after = content[index + m.length] || "";
            if (/[\w$]/.test(before) || /[\w$]/.test(after)) return false;
            if (before === "." || after === "(") return false;
            if (m.startsWith("/api/") || m.startsWith("api/")) return false;
            if (relPath.endsWith("package-lock.json") || /integrity|sha(256|384|512)|DUMMY_HASH/i.test(context)) return false;
          }
          if (m.length < 32 && !pat.name.includes("Key")) return false;
          if (/^[0-9.]+$/.test(m)) return false; // Version numbers
          if (/^[a-f0-9]{32}$/i.test(m) && pat.name === "Generic API Key") return true; // MD5/UUID-like
          return true;
        });

        if (suspicious.length > 0) {
          findings.push(makeFinding({
            checker: "secret-pii-hunter",
            severity: "CRITICAL",
            summary: `Potential ${pat.name} detected.`,
            target: relPath,
            file: relPath,
            evidence: [`Found pattern matching ${pat.name} in ${relPath}.`],
            confidence: 0.7,
          }));
        }
      }
    }
  }

  return findings;
}

function runDosVectorFinder(rootDir, inventory) {
  const findings = [];
  // Look for endpoints returning List<> without Pageable or limit
  const backendDir = path.join(rootDir, "backend", "src", "main", "java");
  const controllers = walkFiles(backendDir, (f) => f.endsWith("Controller.java"));

  for (const filePath of controllers) {
    const content = readText(filePath);
    const methodPattern = /public\s+List<[^>]+>\s+\w+\s*\(([^)]*)\)/g;
    let match;
    while ((match = methodPattern.exec(content)) !== null) {
        const args = match[1];
        if (!args.includes("Pageable") && !args.includes("limit")) {
            findings.push(
                makeFinding({
                    checker: "dos-vector-finder",
                    severity: "MEDIUM",
                    summary: "Potential DoS: Unpaginated collection return.",
                    target: toRel(rootDir, filePath),
                    file: toRel(rootDir, filePath),
                    evidence: ["Controller method returns a List but does not accept Pageable or a limit parameter, allowing for memory exhaustion."],
                    confidence: 0.7,
                })
            );
        }
    }
  }
  return findings;
}

function runAuthBypassProber(inventory) {
  const findings = [];
  const publicPaths = [
    "/",
    "/api/auth/login",
    "/api/auth/signup",
    "/api/auth/google",
    "/api/auth/strava",
    "/api/auth/reset-password",
    "/api/dev/",
    "/api/maps/tiles/",
    "/api/public/",
    "/api/health",
    "/api/strava/webhook",
  ];

  for (const endpoint of inventory.endpoints) {
    if (!endpoint.path.startsWith("/api/") && endpoint.path !== "/") continue;
    if (publicPaths.some(p => endpoint.path.startsWith(p))) continue;

    const content = readText(path.resolve(ROOT, endpoint.file));
    const hasAuthHeader = /@RequestHeader\s*\(\s*(?:value\s*=\s*)?["']Authorization["']/.test(content);
    const readsAuthorizationHeader = /\.getHeader\s*\(\s*["']Authorization["']\s*\)/.test(content);
    const hasAuthPrincipal = /@AuthenticationPrincipal/.test(content);
    const hasRequireAdmin = /requireAdmin\s*\(/.test(content);
    const hasLocalDevGuard = /isLocalDevRequest\s*\(/.test(content);

    if (!hasAuthHeader && !readsAuthorizationHeader && !hasAuthPrincipal && !hasRequireAdmin && !hasLocalDevGuard) {
        findings.push(
            makeFinding({
                checker: "auth-bypass-prober",
                severity: "CRITICAL",
                summary: "Potential Auth Bypass: Endpoint under /api/ appears to lack authentication guards.",
                target: `${endpoint.method} ${endpoint.path}`,
                file: endpoint.file,
                evidence: ["Endpoint is not on the public whitelist and does not use @RequestHeader('Authorization') or @AuthenticationPrincipal."],
                confidence: 0.8,
            })
        );
    }
  }
  return findings;
}

function runInjectionHunter(rootDir) {
  const findings = [];
  const scanRoots = [
    path.join(rootDir, "backend", "src", "main", "java"),
    path.join(rootDir, "frontend", "src"),
    path.join(rootDir, ".tools"),
  ];
  const codeFiles = scanRoots.flatMap((scanRoot) => walkFiles(
    scanRoot,
    (filePath) => [".java", ".js", ".jsx", ".ts", ".tsx", ".mjs"].includes(path.extname(filePath))
      && !filePath.includes(`${path.sep}node_modules${path.sep}`)
      && !filePath.includes(`${path.sep}dist${path.sep}`)
      && !filePath.includes(`${path.sep}target${path.sep}`),
  ));

  // Refined regex for SQL injection: look for SQL keywords followed by string concatenation with non-literal variables
  const sqlConcatPattern = /\b(select|update|delete|insert)\b[\s\S]{0,120}\+\s*(?!(?:['"]|String\.valueOf))([A-Za-z_][A-Za-z0-9_]*)/i;
  for (const filePath of codeFiles) {
    if (/\.test\.(m?js|ts|tsx|jsx)$/i.test(filePath)) continue;
    const content = readText(filePath);
    if (!sqlConcatPattern.test(content)) continue;
    const relPath = toRel(rootDir, filePath);
    findings.push(
      makeFinding({
        checker: "injection-hunter",
        severity: relPath.startsWith(".tools/") ? "MEDIUM" : "CRITICAL",
        summary: "Possible SQL Injection: Dynamic query construction with unescaped input.",
        target: relPath,
        file: relPath,
        evidence: [
          "Detected SQL-like text combined with dynamic variable concatenation.",
        ],
        confidence: 0.9,
      }),
    );
  }

  return findings;
}
function runLeakDetector(inventory) {
  const findings = [];
  for (const endpoint of inventory.endpoints) {
    if (!/\/(export|config|status)\b/i.test(endpoint.path)) continue;
    findings.push(
      makeFinding({
        checker: "leak-detector",
        severity: "LOW",
        summary: "Endpoint shape suggests configuration, export, or status data that should be reviewed for oversharing.",
        target: `${endpoint.method} ${endpoint.path}`,
        file: endpoint.file,
        evidence: [
          `Controller route ${endpoint.path} matched the config/export/status review heuristic.`,
        ],
      }),
    );
  }
  return findings;
}

function runConfigChecker(rootDir, inventory) {
  const findings = [];
  const securityFilter = walkFiles(
    path.join(rootDir, "backend", "src", "main", "java"),
    (filePath) => filePath.endsWith("SecurityHeadersFilter.java"),
  )[0];

  if (securityFilter) {
    const content = readText(securityFilter);
    const requiredHeaders = [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "Referrer-Policy",
    ];
    for (const header of requiredHeaders) {
      if (content.includes(header)) continue;
      findings.push(
        makeFinding({
          checker: "config-checker",
          severity: "MEDIUM",
          summary: `Expected security header ${header} was not detected in the security header filter.`,
          target: header,
          file: toRel(rootDir, securityFilter),
          evidence: [
            "SecurityHeadersFilter.java exists, but this header name was not found in the file.",
          ],
        }),
      );
    }
  }

  for (const configFile of inventory.configFiles) {
    const lines = configFile.content.split(/\r?\n/);
    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      const match = line.match(/(?:secret|api[-_.]?key|token|password)\s*=\s*(?!\$\{)([^\s#]+)/i);
      if (!match) continue;
      if (/[<>]/.test(match[1])) continue;
      findings.push(
        makeFinding({
          checker: "config-checker",
          severity: "HIGH",
          summary: "Possible hard-coded secret-like configuration value detected.",
          target: configFile.file,
          file: configFile.file,
          evidence: [
            `Matched config key assignment with literal value: ${line}.`,
          ],
        }),
      );
    }
  }

  return findings;
}

const FETCH_TIMEOUT_MS = 5000;
const SENSITIVE_KEY_PATTERNS = /client[_-]?id|redirect[_-]?uri|secret|token|api[_-]?key|password|stripe|billing|provider|base[_-]?url|webhook/i;
const PUBLIC_ENDPOINT_ALLOWLIST = new Set([
  "/api/auth/login",
  "/api/auth/signup",
  "/api/auth/reset-password",
  "/api/auth/google",
  "/api/auth/strava",
  "/api/health",
  "/api/config/status",
  "/api/billing/config",
]);

async function safeFetch(url, opts = {}) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), opts.timeout || FETCH_TIMEOUT_MS);
    const resp = await fetch(url, { ...opts, signal: controller.signal });
    clearTimeout(timer);
    return resp;
  } catch {
    return null;
  }
}

async function checkRuntimeReachable(baseUrl) {
  const targets = ["/api/health", "/"];
  for (const target of targets) {
    const resp = await safeFetch(`${baseUrl}${target}`, { method: "GET", timeout: 2500 });
    if (resp) {
      return {
        reachable: true,
        checked: target,
        status: resp.status,
      };
    }
  }
  return {
    reachable: false,
    checked: targets.join(", "),
    status: null,
  };
}

function attackProbeCoverage(aggressive) {
  return aggressive
    ? [...STANDARD_ATTACK_PROBES, ...AGGRESSIVE_ATTACK_PROBES]
    : [...STANDARD_ATTACK_PROBES];
}

function makeActiveProbeState(overrides = {}) {
  return {
    attempted: false,
    skipped: false,
    reason: "",
    coverage: [],
    runtimeReachable: null,
    ...overrides,
  };
}

function makeCleanupReport(overrides = {}) {
  return {
    required: true,
    attempted: false,
    status: "not-needed",
    notes: [],
    taggedState: [
      "security-test-assignment@test.hermes.local",
      "console error payloads posted to /api/dev/console-errors",
      "password reset probe emails under test/local domains",
    ],
    ...overrides,
  };
}

async function runActiveAuthBypassProbe(baseUrl) {
  const findings = [];
  const protectedPaths = [
    { path: "/api/profile", label: "Profile endpoint" },
    { path: "/api/activities", label: "Activities endpoint" },
    { path: "/api/shoes", label: "Shoes endpoint" },
    { path: "/api/coach/today", label: "Coach endpoint" },
    { path: "/api/races", label: "Races endpoint" },
    { path: "/api/training/muscle", label: "Muscle training endpoint" },
    { path: "/api/v1/weather", label: "Weather endpoint" },
    { path: "/api/billing/checkout", label: "Billing checkout endpoint" },
    { path: "/api/admin/stats", label: "Admin stats endpoint" },
    { path: "/api/admin/users?page=0&size=10", label: "Admin users endpoint" },
    { path: "/api/auth/runners/1", label: "Runner detail endpoint" },
  ];

  const fakeTokens = [
    { header: null, label: "no-auth" },
    { header: "Bearer invalid-token-12345", label: "fake-bearer" },
    { header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.fake", label: "forged-jwt" },
  ];

  for (const probe of protectedPaths) {
    for (const tkn of fakeTokens) {
      const headers = {};
      if (tkn.header) headers["Authorization"] = tkn.header;
      const resp = await safeFetch(`${baseUrl}${probe.path}`, { headers });
      if (!resp) continue;
      if (resp.status >= 200 && resp.status < 300) {
        let bodyPreview = "";
        try { bodyPreview = await resp.text(); } catch { /* ignore */ }
        const isAdmin = /\/admin\b/i.test(probe.path);
        findings.push(makeFinding({
          checker: "active-auth-bypass",
          severity: isAdmin ? "CRITICAL" : "HIGH",
          summary: `Authenticated endpoint ${probe.path} returned ${resp.status} with ${tkn.label}.`,
          target: probe.path,
          evidence: [
            `${probe.label} returned HTTP ${resp.status} with ${tkn.label} Authorization header.`,
            isAdmin ? "This is an admin-only endpoint — unauthorized access is a critical breach." : "User data may be accessible without valid credentials.",
            `Response length: ${bodyPreview.length} bytes.`,
          ],
          verification: "runtime-verified",
          confidence: 0.95,
        }));
      }
    }
  }

  const roleEscalationToken = "Bearer role-escalation-test";
  const escalationResp = await safeFetch(`${baseUrl}/api/profile`, {
    headers: { Authorization: roleEscalationToken },
  });
  if (escalationResp && escalationResp.status >= 200 && escalationResp.status < 300) {
    findings.push(makeFinding({
      checker: "active-auth-bypass",
      severity: "CRITICAL",
      summary: "Profile endpoint accepted a fabricated token — auth system may not validate tokens.",
      target: "/api/profile",
      evidence: [
        "Sent a clearly fabricated Authorization header 'Bearer role-escalation-test'.",
        `Server returned HTTP ${escalationResp.status} instead of 401/403.`,
      ],
      verification: "runtime-verified",
      confidence: 0.95,
    }));
  }

  return findings;
}

async function runActiveDataLeakProbe(baseUrl) {
  const findings = [];

  const leakEndpoints = [
    { path: "/api/config/status", label: "Config status" },
    { path: "/api/billing/config", label: "Billing config" },
    { path: "/api/dev/console-errors", label: "Console errors (GET)", method: "GET" },
  ];

  for (const ep of leakEndpoints) {
    const method = ep.method || "GET";
    const resp = await safeFetch(`${baseUrl}${ep.path}`, { method });
    if (!resp) continue;
    const status = resp.status;
    if (status >= 200 && status < 300) {
      let body = "";
      try { body = await resp.text(); } catch { /* ignore */ }

      const sensitiveKeys = [];
      try {
        const json = JSON.parse(body);
        const flatten = (obj, prefix = "") => {
          for (const [k, v] of Object.entries(obj)) {
            const fullPath = prefix ? `${prefix}.${k}` : k;
            if (SENSITIVE_KEY_PATTERNS.test(k) || SENSITIVE_KEY_PATTERNS.test(fullPath)) {
              sensitiveKeys.push(`${fullPath}=${typeof v === "string" ? (v.length > 40 ? v.slice(0, 40) + "..." : v) : v}`);
            }
            if (v && typeof v === "object" && !Array.isArray(v)) flatten(v, fullPath);
          }
        };
        if (typeof json === "object" && json !== null) flatten(json);
      } catch { /* body is not JSON */ }

      if (sensitiveKeys.length > 0) {
        findings.push(makeFinding({
          checker: "active-data-leak",
          severity: "HIGH",
          summary: `${ep.label} endpoint leaks sensitive configuration data without authentication.`,
          target: ep.path,
          evidence: [
            `HTTP ${status} returned without any Authorization header.`,
            `Exposed sensitive fields: ${sensitiveKeys.join(", ")}`,
            `An attacker can enumerate integration config, OAuth redirect URIs, and service provider details.`,
          ],
          verification: "runtime-verified",
          confidence: 0.95,
        }));
      } else if (body.length > 10) {
        findings.push(makeFinding({
          checker: "active-data-leak",
          severity: "MEDIUM",
          summary: `${ep.label} endpoint returns data without authentication.`,
          target: ep.path,
          evidence: [
            `HTTP ${status} returned ${body.length} bytes without auth.`,
            "No obviously sensitive key names found, but the endpoint should be reviewed for data exposure.",
          ],
          verification: "runtime-verified",
          confidence: 0.7,
        }));
      }
    }
  }

  return findings;
}

async function runActiveIdorProbe(baseUrl) {
  const findings = [];

  const idorPaths = [
    { path: "/api/auth/runners/1", method: "GET", label: "Runner detail (ID=1)" },
    { path: "/api/auth/runners/2", method: "GET", label: "Runner detail (ID=2)" },
    { path: "/api/auth/runners/1", method: "DELETE", label: "Runner delete (ID=1)" },
    { path: "/api/shoes/runner/1", method: "GET", label: "Runner shoes (ID=1)" },
    { path: "/api/activities/runner/1", method: "GET", label: "Runner activities (ID=1)" },
    { path: "/api/profile", method: "GET", label: "Own profile" },
  ];

  for (const probe of idorPaths) {
    const opts = { method: probe.method };
    if (probe.method === "DELETE") opts.headers = { Authorization: "Bearer idor-test" };
    const resp = await safeFetch(`${baseUrl}${probe.path}`, opts);
    if (!resp) continue;
    const status = resp.status;
    if (status >= 200 && status < 300) {
      let bodyPreview = "";
      try { bodyPreview = await resp.text(); } catch { /* ignore */ }
      const hasEmail = /email/i.test(bodyPreview);
      const hasPersonalData = /displayName|stravaAthleteId|subscriptionTier|password|token/i.test(bodyPreview);
      findings.push(makeFinding({
        checker: "active-idor",
        severity: status === 200 && (hasEmail || hasPersonalData) ? "CRITICAL" : "HIGH",
        summary: `${probe.label} accessible without valid auth (HTTP ${status}).`,
        target: probe.path,
        evidence: [
          `${probe.method} ${probe.path} returned HTTP ${status} without valid session.`,
          hasEmail ? "Response contains email field — PII exposure confirmed." : "",
          hasPersonalData ? "Response contains personal data fields — IDOR vulnerability confirmed." : "",
        ].filter(Boolean),
        verification: "runtime-verified",
        confidence: status === 200 ? 0.95 : 0.8,
      }));
    } else if (status === 401 || status === 403) {
      // expected — auth is working
    } else if (status === 500) {
      findings.push(makeFinding({
        checker: "active-idor",
        severity: "MEDIUM",
        summary: `${probe.label} returned 500 — may reveal stack traces or internal state.`,
        target: probe.path,
        evidence: [`HTTP 500 on ${probe.method} ${probe.path} without auth.`],
        verification: "runtime-verified",
        confidence: 0.6,
      }));
    }
  }

  return findings;
}

async function runActiveInjectionProbe(baseUrl) {
  const findings = [];

  const sqlPayloads = [
    { payload: "' OR '1'='1", label: "classic OR injection" },
    { payload: "1; DROP TABLE runner--", label: "stacked DROP" },
    { payload: "1 UNION SELECT email,password FROM runner--", label: "UNION SELECT" },
  ];

  const xssPayloads = [
    { payload: "<script>alert('xss')</script>", label: "script tag injection" },
    { payload: "\" onmouseover=\"alert('xss')\"", label: "attribute injection" },
  ];

  for (const { payload, label } of sqlPayloads) {
    const loginResp = await safeFetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: payload, password: "test" }),
    });
    if (!loginResp) continue;
    const status = loginResp.status;
    let body = "";
    try { body = await loginResp.text(); } catch { /* ignore */ }

    if (status === 500) {
      findings.push(makeFinding({
        checker: "active-injection",
        severity: "CRITICAL",
        summary: `SQL injection ${label} on login caused server error (HTTP 500).`,
        target: "/api/auth/login",
        evidence: [
          `Payload: email=${payload.slice(0, 50)}`,
          `Server returned HTTP 500 — possible unhandled SQL exception.`,
          body.length < 500 ? `Response: ${body.slice(0, 200)}` : `Response length: ${body.length} bytes`,
        ],
        verification: "runtime-verified",
        confidence: 0.85,
      }));
    } else if (status === 200) {
      findings.push(makeFinding({
        checker: "active-injection",
        severity: "CRITICAL",
        summary: `SQL injection ${label} on login returned HTTP 200 — authentication bypass possible.`,
        target: "/api/auth/login",
        evidence: [
          `Payload: email=${payload.slice(0, 50)}`,
          "Server accepted the malformed input and returned 200 instead of 400.",
        ],
        verification: "runtime-verified",
        confidence: 0.95,
      }));
    }
  }

  for (const { payload, label } of xssPayloads) {
    const consoleResp = await safeFetch(`${baseUrl}/api/dev/console-errors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errors: [{ message: payload }] }),
    });
    if (!consoleResp) continue;
    if (consoleResp.status === 200) {
      let body = "";
      try { body = await consoleResp.text(); } catch { /* ignore */ }
      if (body.includes(payload)) {
        findings.push(makeFinding({
          checker: "active-injection",
          severity: "MEDIUM",
          summary: `XSS ${label} reflected in console-errors response (stored-XSS risk on admin dashboard).`,
          target: "/api/dev/console-errors",
          evidence: [
            "Injected script payload was reflected verbatim in the response body.",
            "If admin views console errors without sanitization, this becomes stored XSS.",
          ],
          verification: "runtime-verified",
          confidence: 0.8,
        }));
      }
    }
  }

  return findings;
}

async function runActiveMassAssignmentProbe(baseUrl) {
  const findings = [];

  const signupResp = await safeFetch(`${baseUrl}/api/auth/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email: "security-test-assignment@test.hermes.local",
      password: "SecurityTest123!",
      role: "ADMIN",
      subscriptionTier: "PRO",
      aiFreeScansRemaining: 99999,
    }),
  });

  if (!signupResp) return findings;

  const status = signupResp.status;
  let body = "";
  try { body = await signupResp.text(); } catch { /* ignore */ }

  if (status === 200 || status === 201) {
    try {
      const json = JSON.parse(body);
      const hasAdminRole = /"role"\s*:\s*"ADMIN"/i.test(body);
      const hasProTier = /"subscriptionTier"\s*:\s*"PRO"/i.test(body);
      if (hasAdminRole || hasProTier) {
        findings.push(makeFinding({
          checker: "active-mass-assignment",
          severity: "CRITICAL",
          summary: "Signup endpoint accepted role/subscriptionTier fields — mass assignment vulnerability.",
          target: "/api/auth/signup",
          evidence: [
            "Sent role=ADMIN and subscriptionTier=PRO in signup request.",
            hasAdminRole ? "Server accepted and persisted the ADMIN role." : "",
            hasProTier ? "Server accepted and persisted the PRO subscription tier." : "",
            "This allows any attacker to escalate privileges at registration.",
          ].filter(Boolean),
          verification: "runtime-verified",
          confidence: 0.95,
        }));
      }
    } catch { /* response not JSON */ }
  } else if (status === 400 || status === 403) {
    // expected — input validation is working
  }

  // Also test the password-reset endpoint for mass assignment
  const resetResp = await safeFetch(`${baseUrl}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent@test.local" }),
  });
  if (resetResp) {
    const resetStatus = resetResp.status;
    let resetBody = "";
    try { resetBody = await resetResp.text(); } catch { /* ignore */ }

    const revealsExistence = resetStatus === 200 && /sent|email|check/i.test(resetBody);
    const revealsNonexistence = resetStatus === 404 || /not found|does.?not.?exist|no account/i.test(resetBody);

    if (revealsExistence || revealsNonexistence) {
      findings.push(makeFinding({
        checker: "active-user-enum",
        severity: "MEDIUM",
        summary: revealsExistence
          ? "Password reset confirms email existence — enables user enumeration."
          : "Password reset reveals non-existence of email — enables user enumeration.",
        target: "/api/auth/reset-password",
        evidence: [
          `HTTP ${resetStatus} for a nonexistent email address.`,
          `Response: ${resetBody.slice(0, 200)}`,
          "Differential response allows attackers to enumerate valid email accounts.",
        ],
        verification: "runtime-verified",
        confidence: 0.8,
      }));
    }
  }

  const loginResp = await safeFetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "nonexistent-enum-test-xyz@test.local", password: "WrongPass123!" }),
  });
  if (loginResp) {
    const loginStatus = loginResp.status;
    let loginBody = "";
    try { loginBody = await loginResp.text(); } catch { /* ignore */ }

    const enumPatterns = /not found|no account|no user|doesn.?t exist|unregistered|invalid email/i;
    if (loginStatus === 401 && enumPatterns.test(loginBody)) {
      findings.push(makeFinding({
        checker: "active-user-enum",
        severity: "MEDIUM",
        summary: "Login error message reveals account existence — enables user enumeration.",
        target: "/api/auth/login",
        evidence: [
          `HTTP ${loginStatus} for nonexistent email.`,
          `Response contains: ${loginBody.slice(0, 200)}`,
          "Differential error messages allow attackers to determine if an email is registered.",
        ],
        verification: "runtime-verified",
        confidence: 0.75,
      }));
    }
  }

  return findings;
}

async function runActiveWebhookAbuseProbe(baseUrl) {
  const findings = [];

  const webhookResp = await safeFetch(`${baseUrl}/api/strava/webhook?hub.mode=subscribe&hub.verify_token=wrong-token&hub.challenge=test`, {
    method: "GET",
  });
  if (webhookResp) {
    const status = webhookResp.status;
    let body = "";
    try { body = await webhookResp.text(); } catch { /* ignore */ }

    if (status === 200) {
      findings.push(makeFinding({
        checker: "active-webhook-abuse",
        severity: "CRITICAL",
        summary: "Strava webhook subscription validation accepted wrong verify token.",
        target: "/api/strava/webhook",
        evidence: [
          "Sent hub.verify_token=wrong-token which should be rejected.",
          `Server returned HTTP 200 with: ${body.slice(0, 200)}`,
          "An attacker could forge webhook subscriptions to receive user activity data.",
        ],
        verification: "runtime-verified",
        confidence: 0.95,
      }));
    } else if (status === 500) {
      findings.push(makeFinding({
        checker: "active-webhook-abuse",
        severity: "MEDIUM",
        summary: "Strava webhook endpoint returns 500 on GET — may leak stack traces.",
        target: "/api/strava/webhook",
        evidence: [
          "GET request with wrong verify token returned HTTP 500.",
          `Response: ${body.slice(0, 200)}`,
          "Error responses may expose internal application structure.",
        ],
        verification: "runtime-verified",
        confidence: 0.7,
      }));
    }
  }

  const forgedEventResp = await safeFetch(`${baseUrl}/api/strava/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      object_type: "activity",
      object_id: 999999,
      aspect_type: "create",
      owner_id: 1,
      updates: {},
    }),
  });
  if (forgedEventResp) {
    const status = forgedEventResp.status;
    if (status === 200) {
      let body = "";
      try { body = await forgedEventResp.text(); } catch { /* ignore */ }
      findings.push(makeFinding({
        checker: "active-webhook-abuse",
        severity: "HIGH",
        summary: "Strava webhook accepts unauthenticated forged activity events.",
        target: "/api/strava/webhook",
        evidence: [
          "POST request with forged activity event (owner_id=1) returned HTTP 200.",
          `Response: ${body}`,
          "An attacker could inject fake activity sync requests for any runner.",
        ],
        verification: "runtime-verified",
        confidence: 0.85,
      }));
    }
  }

  const stripeResp = await safeFetch(`${baseUrl}/api/billing/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Stripe-Signature": "t=1234,v1=fake" },
    body: JSON.stringify({ id: "evt_fake", object: "event", type: "checkout.session.completed", data: { object: { id: "cs_fake", payment_status: "paid", metadata: { runnerId: "1", months: "12" } } } }),
  });
  if (stripeResp) {
    const status = stripeResp.status;
    if (status === 200) {
      let body = "";
      try { body = await stripeResp.text(); } catch { /* ignore */ }
      if (body !== "ignored" && body !== "webhook not configured") {
        findings.push(makeFinding({
          checker: "active-webhook-abuse",
          severity: "CRITICAL",
          summary: "Stripe webhook accepted forged event with fake signature.",
          target: "/api/billing/webhook",
          evidence: [
            "Sent forged Stripe webhook event with fake signature.",
            `Server returned HTTP 200 with: ${body}`,
            "An attacker could grant Pro subscriptions without payment.",
          ],
          verification: "runtime-verified",
          confidence: 0.95,
        }));
      }
    }
  }

  return findings;
}

async function runActiveCorsProbe(baseUrl) {
  const findings = [];

  const corsPaths = ["/api/profile", "/api/config/status", "/api/auth/login"];
  const origins = ["https://evil.com", "https://attacker.example.com"];

  for (const pathname of corsPaths) {
    for (const origin of origins) {
      const resp = await safeFetch(`${baseUrl}${pathname}`, {
        method: "GET",
        headers: { Origin: origin },
      });
      if (!resp) continue;

      const acao = resp.headers.get("access-control-allow-origin");
      const acac = resp.headers.get("access-control-allow-credentials");

      if (acao === "*" || acao === origin) {
        findings.push(makeFinding({
          checker: "active-cors",
          severity: acao === origin ? "HIGH" : "MEDIUM",
          summary: `CORS allows ${acao === "*" ? "any origin" : `origin: ${origin}`} on ${pathname}.`,
          target: pathname,
          evidence: [
            `Origin: ${origin}`,
            `Access-Control-Allow-Origin: ${acao}`,
            `Access-Control-Allow-Credentials: ${acac || "not set"}`,
            acao === origin ? "Wildcard reflection allows any origin to access this endpoint." : "",
            acac === "true" ? "Credentials are allowed — this makes the CORS issue exploitable." : "",
          ].filter(Boolean),
          verification: "runtime-verified",
          confidence: 0.9,
        }));
      }
    }
  }

  return findings;
}

async function runActiveRateLimitProbe(baseUrl) {
  const findings = [];
  const loginAttempts = 25;
  const responses = [];

  for (let i = 0; i < loginAttempts; i++) {
    const resp = await safeFetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: `rate-test-${i}@test.local`, password: "wrong" }),
    });
    if (!resp) continue;
    responses.push({ attempt: i + 1, status: resp.status });
    if (resp.status === 429) break;
  }

  const lastStatus = responses.length > 0 ? responses[responses.length - 1].status : null;
  if (lastStatus !== 429 && responses.length >= loginAttempts) {
    findings.push(makeFinding({
      checker: "active-rate-limit",
      severity: "MEDIUM",
      summary: "Login endpoint has no rate limiting — brute-force attacks possible.",
      target: "/api/auth/login",
      evidence: [
        `Sent ${responses.length} rapid login attempts with no rate-limit response (429).`,
        `Last response: HTTP ${lastStatus}.`,
        "Attackers can brute-force passwords without throttling.",
      ],
      verification: "runtime-verified",
      confidence: 0.85,
    }));
  } else if (lastStatus === 429) {
    const rateLimitedAt = responses.findIndex((r) => r.status === 429) + 1;
    findings.push(makeFinding({
      checker: "active-rate-limit",
      severity: "LOW",
      summary: `Login endpoint rate-limits after ${rateLimitedAt} attempts — rate limiting is active.`,
      target: "/api/auth/login",
      evidence: [
        `Rate limit (429) triggered after ${rateLimitedAt} attempts.`,
        "Brute-force protection is in place.",
      ],
      verification: "runtime-verified",
      confidence: 0.9,
    }));
  }

  return findings;
}

async function runActiveSecurityHeadersProbe(baseUrl) {
  const findings = [];
  const criticalHeaders = [
    "content-security-policy",
    "x-content-type-options",
    "x-frame-options",
    "strict-transport-security",
    "referrer-policy",
    "permissions-policy",
  ];

  const resp = await safeFetch(`${baseUrl}/api/auth/login`, { method: "OPTIONS" });
  if (!resp) {
    const resp2 = await safeFetch(`${baseUrl}/api/config/status`);
    if (!resp2) return findings;
    for (const header of criticalHeaders) {
      const val = resp2.headers.get(header);
      if (!val) {
        findings.push(makeFinding({
          checker: "active-security-headers",
          severity: header === "content-security-policy" || header === "strict-transport-security" ? "MEDIUM" : "LOW",
          summary: `Missing security header: ${header}`,
          target: "/api/config/status",
          evidence: [
            `The ${header} response header is not set.`,
            header === "content-security-policy" ? "Without CSP, the site is vulnerable to XSS and content injection attacks." : "",
            header === "strict-transport-security" ? "Without HSTS, users are vulnerable to protocol downgrade attacks." : "",
          ].filter(Boolean),
          verification: "runtime-verified",
          confidence: 0.95,
        }));
      }
    }
    return findings;
  }

  for (const header of criticalHeaders) {
    const val = resp.headers.get(header);
    if (!val) {
      findings.push(makeFinding({
        checker: "active-security-headers",
        severity: header === "content-security-policy" || header === "strict-transport-security" ? "MEDIUM" : "LOW",
        summary: `Missing security header: ${header}`,
        target: "response-headers",
        evidence: [
          `The ${header} response header is not set.`,
          header === "content-security-policy" ? "Without CSP, the site is vulnerable to XSS and content injection attacks." : "",
          header === "strict-transport-security" ? "Without HSTS, users are vulnerable to protocol downgrade attacks." : "",
        ].filter(Boolean),
        verification: "runtime-verified",
        confidence: 0.95,
      }));
    }
  }

  return findings;
}

async function runActiveAuthBypassUrlsProbe(baseUrl) {
  const findings = [];

  const bypassPaths = [
    { path: "/actuator/health", label: "Spring Actuator health" },
    { path: "/actuator/env", label: "Spring Actuator env" },
    { path: "/actuator/mappings", label: "Spring Actuator mappings" },
    { path: "/actuator/beans", label: "Spring Actuator beans" },
    { path: "/swagger-ui.html", label: "Swagger UI" },
    { path: "/v3/api-docs", label: "OpenAPI docs" },
    { path: "/api/admin/users/export", label: "User export" },
    { path: "/api/shoe-catalog/admin/pending", label: "Shoe catalog admin" },
    { path: "/.env", label: "Environment file" },
    { path: "/.git/config", label: "Git config" },
  ];

  for (const probe of bypassPaths) {
    const resp = await safeFetch(`${baseUrl}${probe.path}`);
    if (!resp) continue;
    const status = resp.status;
    if (status >= 200 && status < 300) {
      let body = "";
      try { body = await resp.text(); } catch { /* ignore */ }

      const isSensitivePath = /actuator|swagger|\.env|\.git|export/i.test(probe.path);
      findings.push(makeFinding({
        checker: "active-url-enumeration",
        severity: isSensitivePath ? "HIGH" : "MEDIUM",
        summary: `${probe.label} endpoint accessible without authentication (HTTP ${status}).`,
        target: probe.path,
        evidence: [
          `HTTP ${status} returned for ${probe.path} without any Authorization header.`,
          isSensitivePath ? "This endpoint can expose sensitive internal information." : "",
          `Response length: ${body.length} bytes.`,
        ].filter(Boolean),
        verification: "runtime-verified",
        confidence: isSensitivePath ? 0.9 : 0.7,
      }));
    }
  }

  return findings;
}

function discoverAdminPathsFromCodex(rootDir) {
  const codexPath = path.join(rootDir, ".ai-codex", "routes.md");
  const text = readText(codexPath);
  if (!text) return [];

  const paths = new Set();
  const lines = text.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const match = line.match(/^(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/admin\S*)/i);
    if (!match) continue;
    const method = match[1].toUpperCase();
    let endpoint = match[2].split(/\s+/)[0];
    endpoint = endpoint.replace(/\{[^}]+\}/g, "1");
    if (!endpoint.startsWith("/api/admin")) continue;
    paths.add(`${method} ${endpoint}`);
  }
  return Array.from(paths);
}

async function runActiveAdminEnumerationProbe(baseUrl, rootDir) {
  const findings = [];
  const adminPaths = discoverAdminPathsFromCodex(rootDir);
  if (adminPaths.length === 0) return findings;

  const fakeTokens = [
    { header: null, label: "no-auth" },
    { header: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwicm9sZSI6ImFkbWluIn0.fake", label: "forged-jwt-admin" },
  ];

  const reachedAdmin = [];

  for (const entry of adminPaths) {
    const [method, endpoint] = entry.split(" ");
    if (method !== "GET" && method !== "POST") continue; // mutating verbs are skipped to keep probe non-destructive
    if (method === "POST" && !/\b(scan|reanalyze|run|export)\b/i.test(endpoint)) {
      // POSTs that look like state mutation are skipped; only read-shaped POSTs are probed
      // (export endpoints frequently use POST in this codebase)
      continue;
    }
    for (const tkn of fakeTokens) {
      const headers = {};
      if (tkn.header) headers["Authorization"] = tkn.header;
      const resp = await safeFetch(`${baseUrl}${endpoint}`, { method, headers });
      if (!resp) continue;
      const status = resp.status;
      if (status >= 200 && status < 300) {
        let body = "";
        try { body = await resp.text(); } catch { /* ignore */ }
        reachedAdmin.push({ method, endpoint, status, label: tkn.label, bodyLen: body.length });
        findings.push(makeFinding({
          checker: "active-admin-enumeration",
          severity: "CRITICAL",
          summary: `Admin endpoint ${method} ${endpoint} reachable with ${tkn.label} (HTTP ${status}).`,
          target: endpoint,
          evidence: [
            `${method} ${endpoint} returned HTTP ${status} with ${tkn.label} authorization.`,
            "Admin surface should always require a valid admin session.",
            `Response length: ${body.length} bytes.`,
          ],
          verification: "runtime-verified",
          confidence: 0.95,
        }));
        break; // one breach per endpoint is enough; stop trying other tokens
      }
    }
  }

  if (reachedAdmin.length === 0 && adminPaths.length > 0) {
    findings.push(makeFinding({
      checker: "active-admin-enumeration",
      severity: "LOW",
      summary: `Probed ${adminPaths.length} admin endpoints from .ai-codex/routes.md — all rejected unauthenticated and forged-token requests.`,
      target: "/api/admin/*",
      evidence: [
        `Sampled ${adminPaths.length} admin routes derived from the codex.`,
        "All probed routes returned 401/403/404/4xx — admin gate held.",
      ],
      verification: "runtime-verified",
      confidence: 0.85,
    }));
  }

  return findings;
}

async function runActiveAdminCredentialStuffingProbe(baseUrl) {
  const findings = [];
  const guesses = [
    { email: "admin@hermes.local", password: "admin" },
    { email: "admin@hermes.local", password: "password" },
    { email: "admin@admin.com", password: "admin123" },
    { email: "admin@example.com", password: "admin" },
    { email: "root@hermes.local", password: "root" },
    { email: "test@hermes.local", password: "test" },
    { email: "operator@hermes.local", password: "operator" },
    { email: "admin@hermes.app", password: "Hermes123!" },
  ];

  let throttledAt = -1;
  let acceptedAt = -1;
  let lastStatus = null;

  for (let i = 0; i < guesses.length; i += 1) {
    const guess = guesses[i];
    const resp = await safeFetch(`${baseUrl}/api/auth/admin-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(guess),
    });
    if (!resp) continue;
    lastStatus = resp.status;
    if (resp.status === 429) {
      throttledAt = i + 1;
      break;
    }
    if (resp.status >= 200 && resp.status < 300) {
      acceptedAt = i + 1;
      break;
    }
  }

  if (acceptedAt > 0) {
    findings.push(makeFinding({
      checker: "active-admin-credential-stuffing",
      severity: "CRITICAL",
      summary: `Admin login accepted a guessed credential on attempt ${acceptedAt}.`,
      target: "/api/auth/admin-login",
      evidence: [
        `A common-credentials guess succeeded against /api/auth/admin-login.`,
        "Admin accounts must use unique strong credentials and the seed account, if any, must be rotated.",
      ],
      verification: "runtime-verified",
      confidence: 0.99,
    }));
  } else if (throttledAt < 0 && lastStatus !== null) {
    findings.push(makeFinding({
      checker: "active-admin-credential-stuffing",
      severity: "MEDIUM",
      summary: "Admin login endpoint never returned 429 across credential-stuffing attempts.",
      target: "/api/auth/admin-login",
      evidence: [
        `Sent ${guesses.length} guesses without a 429 throttle response (last status ${lastStatus}).`,
        "Without throttling, admin credentials are vulnerable to slow brute force.",
      ],
      verification: "runtime-verified",
      confidence: 0.8,
    }));
  } else if (throttledAt > 0) {
    findings.push(makeFinding({
      checker: "active-admin-credential-stuffing",
      severity: "LOW",
      summary: `Admin login throttled credential-stuffing after ${throttledAt} attempts.`,
      target: "/api/auth/admin-login",
      evidence: [
        `Rate limit (429) triggered on attempt ${throttledAt}.`,
        "Throttling protects admin login from automated guessing.",
      ],
      verification: "runtime-verified",
      confidence: 0.9,
    }));
  }

  return findings;
}

async function runActiveAdminDataExfilProbe(baseUrl) {
  const findings = [];

  const exfilTargets = [
    { method: "GET", path: "/api/admin/users/export", label: "Admin user export" },
    { method: "GET", path: "/api/admin/shoes/export", label: "Admin shoe export" },
    { method: "GET", path: "/api/admin/audit", label: "Admin audit log" },
    { method: "GET", path: "/api/admin/jobs", label: "Admin background jobs" },
    { method: "GET", path: "/api/admin/queues", label: "Admin queue inspector" },
    { method: "GET", path: "/api/admin/overview", label: "Admin overview" },
    { method: "GET", path: "/api/dev/console-errors", label: "Dev console error feed" },
    { method: "GET", path: "/actuator/env", label: "Spring env dump" },
    { method: "GET", path: "/actuator/mappings", label: "Spring route mappings" },
  ];

  for (const target of exfilTargets) {
    const resp = await safeFetch(`${baseUrl}${target.path}`, { method: target.method });
    if (!resp) continue;
    const status = resp.status;
    if (status < 200 || status >= 300) continue;

    let body = "";
    try { body = await resp.text(); } catch { /* ignore */ }

    const exposesEmail = /"email"\s*:/i.test(body) || /@[\w.-]+\.[a-z]{2,}/i.test(body);
    const exposesToken = /"token"\s*:|"refreshToken"\s*:|"accessToken"\s*:/i.test(body);
    const exposesSecrets = /(?:secret|client[_-]?secret|webhook[_-]?secret|api[_-]?key)\b/i.test(body);
    const exposesPii = /"displayName"|"stravaAthleteId"|"subscriptionTier"|"passwordHash"/i.test(body);

    const isCritical = exposesEmail || exposesToken || exposesSecrets || exposesPii;

    findings.push(makeFinding({
      checker: "active-admin-data-exfil",
      severity: isCritical ? "CRITICAL" : "HIGH",
      summary: `${target.label} reachable without admin auth (HTTP ${status}, ${body.length} bytes).`,
      target: target.path,
      evidence: [
        `${target.method} ${target.path} returned HTTP ${status} without any Authorization header.`,
        exposesEmail ? "Response contains email-shaped data — runner PII is exfiltrable." : "",
        exposesToken ? "Response contains token fields — session/OAuth tokens may leak." : "",
        exposesSecrets ? "Response contains secret-shaped keys — provider secrets may leak." : "",
        exposesPii ? "Response contains runner profile fields — PII is exfiltrable." : "",
        `Body length: ${body.length} bytes.`,
      ].filter(Boolean),
      verification: "runtime-verified",
      confidence: 0.95,
    }));
  }

  return findings;
}

function sortFindings(findings) {
  return findings.slice().sort((left, right) => {
    const severityDelta = (SEVERITY_ORDER[right.severity] || 0) - (SEVERITY_ORDER[left.severity] || 0);
    if (severityDelta !== 0) return severityDelta;
    return left.checker.localeCompare(right.checker);
  });
}

export function shouldWriteFindingToTasks(finding) {
  if (!finding) return false;
  if ((SEVERITY_ORDER[finding.severity] || 0) < SEVERITY_ORDER.HIGH) return false;
  if (finding.verification !== "runtime-verified") return false;
  if (finding.duplicate) return false;
  return true;
}

function addFindingsToTasks(tasksPath, findings, report) {
  if (!fs.existsSync(tasksPath)) return [];

  const taskLines = [];
  let tasksText = readText(tasksPath);
  const eligible = findings.filter((finding) => shouldWriteFindingToTasks(finding));
  if (eligible.length === 0) return [];

  for (const finding of eligible) {
    const title = `[security] ${finding.summary}`;
    if (tasksText.includes(title)) continue;
    taskLines.push(
      `- [ ] ${title}`,
      `  Files: \`${finding.file || finding.target}\``,
      `  Context: ${finding.checker} flagged ${finding.target}. Evidence: ${(finding.evidence || []).join(" ")}`,
      "  Done when: the security finding is resolved and the verification command shows the issue no longer reproduces.",
      `  Verify: \`node .tools/auto-hermes-security.mjs --mode audit --command-name ${report.commandName} --runtime-base-url ${report.runtime.baseUrl || "http://localhost:8080"} --json\``,
      "",
    );
  }

  if (taskLines.length === 0) return [];

  if (/## Suggested Next Tasks/.test(tasksText)) {
    tasksText = tasksText.replace(/## Suggested Next Tasks\s*/, `## Suggested Next Tasks\n${taskLines.join("\n")}`);
  } else {
    tasksText = `${tasksText.trimEnd()}\n\n## Suggested Next Tasks\n${taskLines.join("\n")}\n`;
  }

  fs.writeFileSync(tasksPath, tasksText, "utf8");
  return eligible.map((finding) => finding.id);
}

function renderMarkdown(report) {
  const lines = [
    `# ${report.commandName}`,
    "",
    `Run Id: ${report.runId}`,
    `Mode: ${report.mode}${report.aggressive ? " (aggressive)" : ""}`,
    `Status: ${report.status}`,
    `Generated: ${report.generatedAt}`,
    "",
    "## Summary",
    report.summary,
    "",
    "## Runtime",
    `Base URL: ${report.runtime.baseUrl || "not-provided"}`,
    `Local/Dev Eligible: ${report.runtime.localDev ? "yes" : "no"}`,
    "",
    "## Active Probes",
    `Attempted: ${report.activeProbes?.attempted ? "yes" : "no"}`,
    `Skipped: ${report.activeProbes?.skipped ? "yes" : "no"}`,
    `Reason: ${report.activeProbes?.reason || "n/a"}`,
    `Coverage: ${(report.activeProbes?.coverage || []).join(", ") || "n/a"}`,
    "",
    "## Cleanup",
    `Required: ${report.cleanup?.required ? "yes" : "no"}`,
    `Attempted: ${report.cleanup?.attempted ? "yes" : "no"}`,
    `Status: ${report.cleanup?.status || "n/a"}`,
    `Notes: ${(report.cleanup?.notes || []).join(" | ") || "n/a"}`,
    "",
    "## Inventory",
    `Tables: ${report.inventory.tables.length}`,
    `Endpoints: ${report.inventory.endpoints.length}`,
    `Forms: ${report.inventory.forms.length}`,
    "",
    "## Findings",
  ];

  if (report.findings.length === 0) {
    lines.push("No findings recorded.");
  } else {
    for (const finding of report.findings) {
      lines.push(`- [${finding.severity}] ${finding.checker} :: ${finding.summary}`);
      lines.push(`  Target: ${finding.target}`);
      if (finding.file) lines.push(`  File: ${finding.file}`);
      lines.push(`  Verification: ${finding.verification}`);
    }
  }

  if (report.taskWriteback.ids.length > 0) {
    lines.push("", "## Task Writeback");
    for (const id of report.taskWriteback.ids) {
      lines.push(`- ${id}`);
    }
  }

  return `${lines.join("\n")}\n`;
}

function writeArtifacts(rootDir, outputDir, report) {
  const reportDir = resolveFromRoot(rootDir, outputDir);
  fs.mkdirSync(reportDir, { recursive: true });

  const markdownPath = path.join(reportDir, `${report.runId}.md`);
  const jsonPath = path.join(reportDir, `${report.runId}.json`);
  fs.writeFileSync(markdownPath, renderMarkdown(report), "utf8");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2), "utf8");

  return {
    markdownPath,
    jsonPath,
  };
}

export async function runAutoHermesSecurity(rawArgs = process.argv.slice(2)) {
  const args = Array.isArray(rawArgs)
    ? parseArgs(rawArgs)
    : parseArgs([]); // start from defaults
  if (rawArgs && !Array.isArray(rawArgs) && typeof rawArgs === "object") {
    const merged = {
      ...args,
      ...rawArgs,
    };
    merged.rootDir = path.resolve(String(merged.rootDir || ROOT));
    merged.mode = String(merged.mode || "audit").trim().toLowerCase();
    merged.commandName = String(merged.commandName || "auto-hermes-security").trim() || "auto-hermes-security";
    merged.outputDir = String(merged.outputDir || ".ai-sync/security-reports").trim() || ".ai-sync/security-reports";
    merged.tasks = String(merged.tasks || "TASKS.md").trim() || "TASKS.md";
    merged.runtimeBaseUrl = String(merged.runtimeBaseUrl || "").trim();
    merged.write = merged.write === true;
    merged.writeTasks = merged.writeTasks === true;
    merged.aggressive = merged.aggressive === true;
    merged.json = merged.json === true;
    Object.assign(args, merged);
  }
  const runtime = parseRuntimeTarget(args.runtimeBaseUrl);
  const runId = makeRunId(args.commandName);
  const generatedAt = nowIso();
  let activeProbes = makeActiveProbeState({
    coverage: args.mode === "attack" ? attackProbeCoverage(Boolean(args.aggressive)) : [],
  });
  let cleanup = makeCleanupReport();

  if (args.mode === "attack" && runtime.provided && !runtime.localDev) {
    activeProbes = makeActiveProbeState({
      skipped: true,
      reason: "Active attack simulation is limited to local/dev targets. The supplied runtime target is not local/dev eligible.",
      coverage: attackProbeCoverage(Boolean(args.aggressive)),
    });
    cleanup = makeCleanupReport({
      status: "not-needed",
      notes: ["No active probes were run because the runtime target was blocked by the local/dev safety gate."],
    });
    const report = {
      runId,
      generatedAt,
      commandName: args.commandName,
      mode: args.mode,
      aggressive: Boolean(args.aggressive),
      status: "blocked",
      summary: "Active attack simulation is limited to local/dev targets. The supplied runtime target is not local/dev eligible.",
      runtime,
      activeProbes,
      cleanup,
      inventory: {
        tables: [],
        endpoints: [],
        forms: [],
        configFiles: [],
      },
      findings: [],
      taskWriteback: {
        attempted: false,
        ids: [],
      },
    };

    const artifacts = args.write ? writeArtifacts(args.rootDir, args.outputDir, report) : null;
    if (artifacts) report.artifacts = artifacts;

    return {
      report,
      exitCode: 1,
      output: args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report),
    };
    }

  const inventory = discoverSecurityInventory(args.rootDir);
  const staticFindings = sortFindings([
    ...runRlsAuditor(inventory),
    ...runIdorHunter(args.rootDir, inventory),
    ...runSecretAndPiiHunter(args.rootDir),
    ...runPiiLeakHunter(args.rootDir, inventory),
    ...runDosVectorFinder(args.rootDir, inventory),
    ...runAuthBypassProber(inventory),
    ...runInjectionHunter(args.rootDir),
    ...runLeakDetector(inventory),
    ...runConfigChecker(args.rootDir, inventory),
  ]);

  let activeFindings = [];
  let activeSummary = "";
  if (args.mode === "attack" && runtime.provided && runtime.localDev) {
    const baseUrl = runtime.baseUrl.replace(/\/$/, "");
    const reachability = await checkRuntimeReachable(baseUrl);
    if (!reachability.reachable) {
      activeProbes = makeActiveProbeState({
        attempted: false,
        skipped: true,
        reason: `Local/dev runtime at ${baseUrl} was unreachable; active probes were skipped and the run stayed static/code-config only.`,
        coverage: attackProbeCoverage(Boolean(args.aggressive)),
        runtimeReachable: false,
      });
      cleanup = makeCleanupReport({
        status: "not-needed",
        notes: ["No active probes ran, so no tagged test state was created."],
      });
      activeSummary = "Active probes skipped: local/dev runtime was unreachable. ";
    } else {
      activeProbes = makeActiveProbeState({
        attempted: true,
        skipped: false,
        reason: args.aggressive
          ? "Local/dev runtime reachable; standard and aggressive active probes were run."
          : "Local/dev runtime reachable; standard active probes were run.",
        coverage: attackProbeCoverage(Boolean(args.aggressive)),
        runtimeReachable: true,
      });
      cleanup = makeCleanupReport({
        status: "manual-review-required",
        notes: [
          "Active probes use tagged local/dev test state only.",
          "No authenticated cleanup contract is available to this command, so persisted tagged state must be reviewed in local/dev data after the run.",
        ],
      });
    console.error(`[attack] Probing ${baseUrl} — active attack simulation starting...`);
    const probeResults = await Promise.allSettled([
      runActiveAuthBypassProbe(baseUrl),
      runActiveDataLeakProbe(baseUrl),
      runActiveIdorProbe(baseUrl),
      runActiveInjectionProbe(baseUrl),
      runActiveMassAssignmentProbe(baseUrl),
      runActiveWebhookAbuseProbe(baseUrl),
      runActiveCorsProbe(baseUrl),
      runActiveRateLimitProbe(baseUrl),
      runActiveSecurityHeadersProbe(baseUrl),
      runActiveAuthBypassUrlsProbe(baseUrl),
      ...(args.aggressive ? [
        runActiveAdminEnumerationProbe(baseUrl, args.rootDir),
        runActiveAdminCredentialStuffingProbe(baseUrl),
        runActiveAdminDataExfilProbe(baseUrl),
      ] : []),
    ]);
    for (const result of probeResults) {
      if (result.status === "fulfilled" && Array.isArray(result.value)) {
        activeFindings.push(...result.value);
      } else if (result.status === "rejected") {
        console.error(`[attack] Probe failed: ${result.reason}`);
      }
    }
    activeFindings = sortFindings(activeFindings);
    const runtimeVerifiedCount = activeFindings.filter((f) => f.verification === "runtime-verified").length;
    const criticalCount = activeFindings.filter((f) => f.severity === "CRITICAL").length;
    const highCount = activeFindings.filter((f) => f.severity === "HIGH").length;
    activeSummary = `Active probes: ${runtimeVerifiedCount} runtime-verified findings (${criticalCount} CRITICAL, ${highCount} HIGH). `;
    }
  }

  const allFindings = sortFindings([...staticFindings, ...activeFindings]);

  const runtimeFindingsCount = allFindings.filter((f) => f.verification === "runtime-verified").length;
  let summary = "";
  if (args.mode === "attack") {
    summary = `Attack simulation completed. ${allFindings.length} total findings (${runtimeFindingsCount} runtime-verified). ${activeSummary}`;
  } else if (runtime.provided) {
    summary = runtime.localDev
      ? "Repo-aware security review completed with local/dev runtime eligibility."
      : "Repo-aware security review completed without active runtime probing.";
  } else {
    summary = "Repo-aware security review completed in static/code-config mode because no runtime target was provided.";
  }

  const report = {
    runId,
    generatedAt,
    commandName: args.commandName,
    mode: args.mode,
    aggressive: Boolean(args.aggressive),
    status: "completed",
    summary,
    runtime,
    activeProbes,
    cleanup,
    inventory,
    findings: allFindings,
    taskWriteback: {
      attempted: Boolean(args.writeTasks),
      ids: [],
    },
  };

  if (args.writeTasks) {
    const tasksPath = resolveFromRoot(args.rootDir, args.tasks);
    report.taskWriteback.ids = addFindingsToTasks(tasksPath, allFindings, report);
  }

  if (args.write) {
    report.artifacts = writeArtifacts(args.rootDir, args.outputDir, report);
  }

  return {
    report,
    output: args.json ? `${JSON.stringify(report, null, 2)}\n` : renderMarkdown(report),
  };
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === __filename;
if (isDirectRun) {
  runAutoHermesSecurity(process.argv.slice(2)).then(({ output }) => {
    process.stdout.write(output);
  }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
