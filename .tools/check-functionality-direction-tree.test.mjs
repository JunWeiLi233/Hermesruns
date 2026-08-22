import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const rootDir = process.cwd();
const checkerPath = path.resolve(rootDir, ".tools/check-functionality-direction-tree.mjs");
const manifestPath = path.resolve(rootDir, "docs/ai/functionality-direction-tree.json");
const guidePath = path.resolve(rootDir, "docs/ai/FUNCTIONALITY_DIRECTION_TREE.md");

assert.equal(existsSync(checkerPath), true, "the direction-tree checker must exist");
assert.equal(existsSync(manifestPath), true, "the machine-readable direction tree must exist");
assert.equal(existsSync(guidePath), true, "the human-readable direction tree must exist");

const { validateDirectionTree } = await import(pathToFileURL(checkerPath).href);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const validationErrors = validateDirectionTree({ rootDir, manifest });

assert.deepEqual(validationErrors, []);
assert.ok(manifest.features.length >= 15, "the tree must cover the major Hermes product surfaces");
assert.ok(
  manifest.features.every((feature) => feature.frontend?.entrypoints?.length > 0),
  "every product surface must identify a frontend entrypoint",
);
assert.ok(
  manifest.features.every((feature) => feature.backend?.entrypoints?.length > 0),
  "every product surface must identify a backend entrypoint",
);

const agentGuide = readFileSync(path.resolve(rootDir, "AGENTS.md"), "utf8");
const claudeGuidePath = path.resolve(rootDir, "CLAUDE.md");
const claudeGuide = existsSync(claudeGuidePath) ? readFileSync(claudeGuidePath, "utf8") : "";
const projectMap = readFileSync(path.resolve(rootDir, "docs/PROJECT_MAP.md"), "utf8");
const contextSnapshot = readFileSync(path.resolve(rootDir, "docs/ai/CONTEXT_SNAPSHOT.md"), "utf8");
const toolingWorkflow = readFileSync(
  path.resolve(rootDir, ".github/workflows/continuous-integration-extra.yml"),
  "utf8",
);
assert.match(agentGuide, /docs\/ai\/FUNCTIONALITY_DIRECTION_TREE\.md/);
assert.match(agentGuide, /## Functionality Direction Tree/);
assert.match(agentGuide, /maintained.*routing tree/i);
if (claudeGuide) assert.match(claudeGuide, /docs\/ai\/FUNCTIONALITY_DIRECTION_TREE\.md/);
assert.match(projectMap, /docs\/ai\/FUNCTIONALITY_DIRECTION_TREE\.md/);
assert.match(contextSnapshot, /FUNCTIONALITY_DIRECTION_TREE\.md/);
assert.match(toolingWorkflow, /\.tools\/check-functionality-direction-tree\.test\.mjs/);

const invalidVerifyManifest = structuredClone(manifest);
invalidVerifyManifest.features[0].verify = [...invalidVerifyManifest.features[0].verify, "node frontend/src/pages/does-not-exist.mjs"];
assert.match(
  validateDirectionTree({ rootDir, manifest: invalidVerifyManifest }).join("\n"),
  /referenced path does not exist: frontend\/src\/pages\/does-not-exist\.mjs/,
  "verify commands must reference existing exact files",
);

const unknownFieldManifest = structuredClone(manifest);
unknownFieldManifest.features[0].unexpected = true;
assert.match(
  validateDirectionTree({ rootDir, manifest: unknownFieldManifest }).join("\n"),
  /features\[0\]\.unexpected is not allowed/,
  "feature schema must reject unknown fields",
);

const unknownNestedFieldManifest = structuredClone(manifest);
unknownNestedFieldManifest.features[0].frontend.unexpected = true;
assert.match(
  validateDirectionTree({ rootDir, manifest: unknownNestedFieldManifest }).join("\n"),
  /features\[0\]\.frontend\.unexpected is not allowed/,
  "nested file-group schemas must reject unknown fields",
);

const driftedGuideManifest = structuredClone(manifest);
driftedGuideManifest.features[0].label = "Changed authentication label";
assert.match(
  validateDirectionTree({ rootDir, manifest: driftedGuideManifest }).join("\n"),
  /feature authentication-access is missing evidence: Changed authentication label/,
  "the guide must carry manifest label evidence",
);

assert.ok(
  manifest.features
    .filter((feature) => ["runner-profile", "billing-subscriptions", "activities-runs", "activity-import", "settings-account", "integrations-sync", "rewards-cosmetics"].includes(feature.id))
    .every((feature) => typeof feature.routingNotes === "string" && feature.routingNotes.trim() !== ""),
  "overlapping feature branches must document routing boundaries",
);

process.stdout.write("Functionality direction tree tests passed.\n");
