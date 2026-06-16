import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const configPath = path.join(rootDir, ".github", "dependabot.yml");

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
