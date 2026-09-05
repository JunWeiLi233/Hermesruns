import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const configPath = path.join(rootDir, ".coderabbit.yaml");

assert.equal(
  fs.existsSync(configPath),
  true,
  "CodeRabbit config should exist at .coderabbit.yaml.",
);

const content = fs.readFileSync(configPath, "utf8");

const requiredSnippets = [
  "$schema=https://coderabbit.ai/integrations/schema.v2.json",
  'language: "en-US"',
  "reviews:",
  'profile: "chill"',
  "auto_review:",
  "enabled: true",
  "drafts: false",
];

for (const snippet of requiredSnippets) {
  assert.match(
    content,
    new RegExp(snippet.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    `.coderabbit.yaml should contain ${snippet}`,
  );
}

console.log("[PASS] CodeRabbit config guard passed.");
