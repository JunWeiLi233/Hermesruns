import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import path from "node:path";

const finishModuleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-finish.mjs")).href;
const { runAutoHermesFinish } = await import(finishModuleUrl);

const finish = runAutoHermesFinish({
  files: [
    "README.md",
    "docs/architecture/ai-agents-workflow.svg",
    "docs/architecture/saas-architecture.html",
    ".tools/refresh-architecture-diagrams.mjs",
    ".codex/commands/auto-hermes.md",
    ".codex/skills/architecture-diagram-generator/SKILL.md",
  ].join("||"),
  commit: false,
  push: false,
  autoPushWhenNeeded: false,
  task: "refresh architecture docs",
  surface: "auto-hermes",
  summary: "diagram refresh",
});

assert.equal(finish.result.eligible, true);
assert.equal(
  finish.result.policies.every((policy) => policy.bucket === "publishable"),
  true,
);

console.log("PASS auto-hermes architecture finish helper");
