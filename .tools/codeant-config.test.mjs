import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const rootDir = process.cwd();
const configPath = path.join(rootDir, ".codeant", "configuration.json");

assert.equal(
  fs.existsSync(configPath),
  true,
  "CodeAnt repository config should exist at .codeant/configuration.json.",
);

const content = fs.readFileSync(configPath, "utf8");
const config = JSON.parse(content);

assert.equal(config.code_analysis?.enabled, true, "CodeAnt code_analysis.enabled should be true.");
assert.equal(
  config.file_filters?.config?.exclude_files,
  "node_modules/**,frontend/node_modules/**,frontend/dist/**,backend/target/**,.git/**",
  "CodeAnt exclude_files should match repo build and dependency artifacts.",
);

const requiredFeatures = [
  "sast_analysis",
  "secrets_analysis",
  "sca_analysis",
  "iac_analysis",
];

for (const feature of requiredFeatures) {
  assert.equal(
    config.code_analysis?.features?.[feature],
    "enabled",
    `CodeAnt feature ${feature} should be enabled.`,
  );
}

console.log("[PASS] CodeAnt config guard passed.");
