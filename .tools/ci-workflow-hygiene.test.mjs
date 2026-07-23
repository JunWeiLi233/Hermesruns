import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const rootDir = process.cwd();

const workflowExpectations = [
  {
    file: ".github/workflows/ci.yml",
    required: [
      /actions\/checkout@v[67]/,
      /actions\/setup-node@v[67]/,
      "actions/setup-java@v5",
    ],
    banned: [
      "actions/checkout@v4",
      "actions/setup-node@v4",
      "actions/setup-java@v4",
    ],
  },
  {
    file: ".github/workflows/continuous-integration-extra.yml",
    required: [
      /actions\/checkout@v[67]/,
      /actions\/setup-node@v[67]/,
      "actions/setup-java@v5",
    ],
    banned: [
      "actions/checkout@v4",
      "actions/setup-node@v4",
      "actions/setup-java@v4",
    ],
  },
  {
    file: ".github/workflows/auto-hermes-self.yml",
    required: [
      /actions\/checkout@v[67]/,
      /actions\/setup-node@v[67]/,
      "actions/setup-java@v5",
    ],
    banned: [
      "actions/checkout@v4",
      "actions/setup-node@v4",
      "actions/setup-java@v4",
    ],
  },
];

for (const workflow of workflowExpectations) {
  const content = fs.readFileSync(path.join(rootDir, workflow.file), "utf8");
  for (const requirement of workflow.required) {
    const pattern = requirement instanceof RegExp
      ? requirement
      : new RegExp(requirement.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    assert.match(content, pattern, `${workflow.file} should pin ${requirement}`);
  }
  for (const snippet of workflow.banned) {
    assert.doesNotMatch(content, new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${workflow.file} should not keep ${snippet}`);
  }
}

const trackedWorktreesEnv = process.env.HERMES_GIT_LS_FILES_STAGE;
const trackedWorktrees = (
  trackedWorktreesEnv === "__EMPTY__"
    ? ""
    : trackedWorktreesEnv
      ?? execFileSync(
        "git",
        ["ls-files", "--stage", ".claude/worktrees"],
        { cwd: rootDir, encoding: "utf8" },
      )
).trim();

assert.equal(
  trackedWorktrees,
  "",
  "Tracked .claude/worktrees gitlinks break GitHub Actions cleanup and must stay untracked.",
);

console.log("[PASS] CI workflow hygiene guard passed.");
