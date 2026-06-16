import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const configPath = path.join(rootDir, ".github", "dependabot.yml");
const cleanupWorkflowPath = path.join(
  rootDir,
  ".github",
  "workflows",
  "delete-merged-dependabot-branch.yml",
);

assert.equal(
  fs.existsSync(configPath),
  true,
  "Dependabot config should exist at .github/dependabot.yml.",
);

const content = fs.readFileSync(configPath, "utf8");

const requiredSnippets = [
  "version: 2",
  'package-ecosystem: "github-actions"',
  'package-ecosystem: "npm"',
  'package-ecosystem: "maven"',
  'package-ecosystem: "docker"',
  'directory: "/"',
  'directory: "/frontend"',
  'directory: "/backend"',
  'schedule:',
  'interval: "weekly"',
];

for (const snippet of requiredSnippets) {
  assert.match(
    content,
    new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `.github/dependabot.yml should contain ${snippet}`,
  );
}

console.log("[PASS] Dependabot config guard passed.");

assert.equal(
  fs.existsSync(cleanupWorkflowPath),
  true,
  "Dependabot branch cleanup workflow should exist.",
);

const cleanupWorkflow = fs.readFileSync(cleanupWorkflowPath, "utf8");

const cleanupSnippets = [
  "pull_request:",
  "types: [closed]",
  "contents: write",
  "if: >",
  "github.event.pull_request.merged == true",
  "dependabot[bot]",
  "pull_request.head.ref",
  "git/refs/heads/",
];

for (const snippet of cleanupSnippets) {
  assert.match(
    cleanupWorkflow,
    new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `delete-merged-dependabot-branch.yml should contain ${snippet}`,
  );
}

console.log("[PASS] Dependabot cleanup workflow guard passed.");
