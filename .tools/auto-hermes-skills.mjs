#!/usr/bin/env node
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const HOME = os.homedir();

function skillFile(...parts) {
  return path.join(...parts, "SKILL.md");
}

const FRONTEND_DESIGN_STACK = [
  {
    name: "hermes-dev",
    required: true,
    phase: "repo-baseline",
    use: "Hermes workflow, preservation rules, and runtime proof gates.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "hermes-dev"),
      skillFile(ROOT, ".codex", "skills", "hermes-dev"),
    ],
  },
  {
    name: "design-taste-frontend",
    required: true,
    phase: "design-review",
    use: "Anti-generic UI bar: asymmetric layouts, calibrated color, typography, motion, and responsive/performance constraints.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "taste-skill"),
      skillFile(ROOT, ".codex", "skills", "taste-skill"),
    ],
  },
  {
    name: "frontend-design",
    required: true,
    phase: "concept-to-implementation",
    use: "Distinctive production-grade frontend execution for pages, components, dashboards, and restyles.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "frontend-design"),
      skillFile(ROOT, ".codex", "skills", "frontend-design"),
    ],
  },
  {
    name: "ui-ux-pro-max",
    required: false,
    phase: "supplemental-research",
    use: "Supporting UX/design database only after design.md is read; reject suggestions that conflict with Hermes.",
    candidates: [
      skillFile(ROOT, ".codex", "skills", "ui-ux-pro-max"),
      skillFile(HOME, ".codex", "skills", "ui-ux-pro-max"),
    ],
  },
  {
    name: "browser",
    required: true,
    phase: "visual-verification",
    use: "Live route verification. Prefer in-app Browser when exposed; use browser-harness fallback when Browser execution is unavailable.",
    candidates: [
      skillFile(HOME, ".codex", "plugins", "cache", "openai-bundled", "browser", "0.1.0-alpha2", "skills", "browser"),
      skillFile(HOME, ".codex", "skills", "browser-harness"),
    ],
  },
  {
    name: "hermes-translation-sync",
    required: "when-copy-changes",
    phase: "copy-and-i18n",
    use: "Required when user-visible copy, labels, buttons, notices, headings, or helper text changes.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "hermes-translation-sync"),
      skillFile(ROOT, ".codex", "skills", "hermes-translation-sync"),
    ],
  },
  {
    name: "accesslint",
    required: "when-accessibility-risk",
    phase: "accessibility",
    use: "Use for forms, ARIA, focus, labels, keyboard behavior, and accessibility-sensitive UI changes.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "accesslint"),
      skillFile(ROOT, ".codex", "skills", "accesslint"),
    ],
  },
  {
    name: "vercel-web-interface-guidelines",
    required: "when-interface-quality-risk",
    phase: "interaction-quality",
    use: "Use for nuanced web interaction quality, content handling, motion, layout, and performance checks.",
    candidates: [
      skillFile(HOME, ".codex", "skills", "vercel-web-interface-guidelines"),
      skillFile(ROOT, ".codex", "skills", "vercel-web-interface-guidelines"),
    ],
  },
];

function resolveSkill(entry) {
  const found = entry.candidates.find((candidate) => fs.existsSync(candidate));
  return {
    name: entry.name,
    required: entry.required,
    phase: entry.phase,
    use: entry.use,
    available: Boolean(found),
    path: found || null,
  };
}

export function buildAutoHermesSkillsManifest() {
  const stack = FRONTEND_DESIGN_STACK.map(resolveSkill);
  return {
    schema: "auto-hermes-skills/v1",
    generatedAt: new Date().toISOString(),
    authority: {
      file: "design.md",
      path: path.join(ROOT, "design.md"),
      rule: "design.md is the final Hermes visual authority; skills sharpen execution but do not override it.",
    },
    frontendDesign: {
      trigger: "Non-trivial frontend rounds: layout, hierarchy, visual redesign, mimic/reference implementation, theme, responsive, empty/loading/error state, copy, or interaction treatment.",
      stack,
      unavailableRequired: stack.filter((skill) => skill.required === true && !skill.available).map((skill) => skill.name),
      commandNotes: [
        "Read design.md before meaningful UI edits.",
        "Use design-taste-frontend and frontend-design as the default quality lenses.",
        "Use ui-ux-pro-max only as supplemental research that is filtered through design.md.",
        "Verify touched routes with Browser or browser-harness fallback before claiming live design success.",
      ],
    },
  };
}

function renderMarkdown(manifest) {
  const lines = [
    "# Auto-Hermes Skills Manifest",
    "",
    `Generated: ${manifest.generatedAt}`,
    `Authority: ${manifest.authority.file}`,
    "",
    "## Frontend Design Stack",
    "",
  ];
  for (const skill of manifest.frontendDesign.stack) {
    lines.push(`- ${skill.name}: ${skill.available ? "available" : "missing"} | required: ${skill.required} | phase: ${skill.phase}`);
    lines.push(`  Use: ${skill.use}`);
    if (skill.path) lines.push(`  Path: ${skill.path}`);
  }
  if (manifest.frontendDesign.unavailableRequired.length) {
    lines.push("");
    lines.push(`Missing required: ${manifest.frontendDesign.unavailableRequired.join(", ")}`);
  }
  return `${lines.join("\n")}\n`;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const manifest = buildAutoHermesSkillsManifest();
  if (process.argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(manifest, null, 2)}\n`);
  } else {
    process.stdout.write(renderMarkdown(manifest));
  }
}
