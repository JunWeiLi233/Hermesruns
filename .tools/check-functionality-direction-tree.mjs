#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const defaultRootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const manifestRelativePath = "docs/ai/functionality-direction-tree.json";
const guideRelativePath = "docs/ai/FUNCTIONALITY_DIRECTION_TREE.md";
const fileGroups = {
  frontend: ["entrypoints", "supporting", "styles", "tests"],
  backend: ["entrypoints", "services", "persistence", "tests"],
};

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function addError(errors, message) {
  errors.push(message);
}

function validateStringArray(errors, value, label, { required = false } = {}) {
  if (!Array.isArray(value)) {
    addError(errors, `${label} must be an array`);
    return;
  }
  if (required && value.length === 0) {
    addError(errors, `${label} must not be empty`);
  }
  for (const item of value) {
    if (typeof item !== "string" || item.trim() === "") {
      addError(errors, `${label} must contain only non-empty strings`);
      break;
    }
  }
}

function validateAllowedFields(errors, value, allowed, label) {
  if (!isObject(value)) return;
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) addError(errors, `${label}.${key} is not allowed`);
  }
}

function validateRepoPath(errors, rootDir, relativePath, label) {
  if (path.isAbsolute(relativePath) || relativePath.includes("\\") || /[*?]/.test(relativePath)) {
    addError(errors, `${label} must be an exact repo-relative path using forward slashes: ${relativePath}`);
    return;
  }

  const resolved = path.resolve(rootDir, relativePath);
  const relative = path.relative(rootDir, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    addError(errors, `${label} escapes the repository: ${relativePath}`);
    return;
  }
  if (!existsSync(resolved)) {
    addError(errors, `${label} does not exist: ${relativePath}`);
  }
}

function validateFileGroup(errors, rootDir, owner, groupName, label) {
  if (!isObject(owner)) {
    addError(errors, `${label} must be an object`);
    return;
  }
  validateAllowedFields(errors, owner, new Set(fileGroups[groupName]), label);

  for (const field of fileGroups[groupName]) {
    const paths = owner[field];
    if (paths === undefined) {
      addError(errors, `${label}.${field} must be present`);
      continue;
    }
    validateStringArray(errors, paths, `${label}.${field}`, { required: field === "entrypoints" });
    if (!Array.isArray(paths)) continue;
    for (const relativePath of paths) {
      if (typeof relativePath === "string" && relativePath.trim() !== "") {
        validateRepoPath(errors, rootDir, relativePath, `${label}.${field}`);
      }
    }
  }
}

function validateVerifyCommands(errors, rootDir, commands, label) {
  if (!Array.isArray(commands)) return;
  for (const [index, command] of commands.entries()) {
    if (typeof command !== "string") continue;
    const workingDirectory = command.match(/(?:^|&&\s*)cd\s+([^&|;\s]+)/)?.[1] || ".";
    const commandRoot = path.resolve(rootDir, workingDirectory);
    if (!existsSync(commandRoot)) addError(errors, `${label}[${index}] working directory does not exist: ${workingDirectory}`);
    const references = new Set();
    for (const match of command.matchAll(/(?:^|\s)([^\s&|;]+\.(?:mjs|cjs|js|tsx|ts|jsx|json|xml|properties))\b/g)) references.add(match[1]);
    const nodeMatch = command.match(/\bnode(?:\.exe)?\s+(?:--check\s+)?([^\s&|;]+)/);
    if (nodeMatch) references.add(nodeMatch[1]);
    const wrapperMatch = command.match(/(?:^|\s)(\.\/?mvnw(?:\.cmd)?)\b/);
    if (wrapperMatch) references.add(wrapperMatch[1]);
    for (const reference of references) {
      if (reference.includes("*") || path.isAbsolute(reference)) {
        addError(errors, `${label}[${index}] must use exact repo-relative paths: ${reference}`);
        continue;
      }
      const resolved = path.resolve(commandRoot, reference.replace(/^\.\//, ""));
      if (!existsSync(resolved)) {
        addError(errors, `${label}[${index}] referenced path does not exist: ${reference}`);
        continue;
      }
      if (/\.(?:mjs|cjs|js)$/.test(resolved) && /\bnode(?:\.exe)?\s+/.test(command)) {
        try {
          execFileSync(process.execPath, ["--check", resolved], { stdio: "ignore" });
        } catch {
          addError(errors, `${label}[${index}] Node script has invalid syntax: ${reference}`);
        }
      }
    }
  }
}

function guideBlock(guide, marker) {
  const start = guide.indexOf(marker);
  if (start < 0) return "";
  const rest = guide.slice(start + marker.length);
  const next = rest.search(/<!-- (?:feature|concern):/);
  return next < 0 ? rest : rest.slice(0, next);
}

function registerSearchTerms(errors, searchTerms, ownerId, values, label) {
  if (!Array.isArray(values)) return;
  for (const value of values) {
    if (typeof value !== "string") continue;
    const normalized = value.trim().toLowerCase();
    if (!normalized) continue;
    const existing = searchTerms.get(normalized);
    if (existing && existing !== ownerId) {
      addError(errors, `${label} duplicates search term "${value}" from ${existing}`);
    } else {
      searchTerms.set(normalized, ownerId);
    }
  }
}

export function validateDirectionTree({ rootDir = defaultRootDir, manifest }) {
  const errors = [];
  if (!isObject(manifest)) return ["manifest must be an object"];
  validateAllowedFields(errors, manifest, new Set(["schemaVersion", "purpose", "diagnosisOrder", "features", "sharedConcerns"]), "manifest");
  if (manifest.schemaVersion !== 1) addError(errors, "manifest.schemaVersion must be 1");
  if (typeof manifest.purpose !== "string" || manifest.purpose.trim() === "") addError(errors, "manifest.purpose must be a non-empty string");
  validateStringArray(errors, manifest.diagnosisOrder, "manifest.diagnosisOrder", { required: true });

  if (!Array.isArray(manifest.features) || manifest.features.length === 0) {
    addError(errors, "manifest.features must be a non-empty array");
    return errors;
  }
  if (!Array.isArray(manifest.sharedConcerns)) {
    addError(errors, "manifest.sharedConcerns must be an array");
  }

  const ids = new Set();
  const searchTerms = new Map();
  const guidePath = path.resolve(rootDir, guideRelativePath);
  const guide = existsSync(guidePath) ? readFileSync(guidePath, "utf8") : "";
  if (!guide) addError(errors, `${guideRelativePath} does not exist or is empty`);

  for (const [index, feature] of manifest.features.entries()) {
    const label = `features[${index}]`;
    if (!isObject(feature)) {
      addError(errors, `${label} must be an object`);
      continue;
    }
    validateAllowedFields(errors, feature, new Set(["id", "label", "aliases", "routes", "apiPrefixes", "contracts", "frontend", "backend", "verify", "routingNotes"]), label);
    if (typeof feature.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(feature.id)) {
      addError(errors, `${label}.id must be a kebab-case string`);
      continue;
    }
    if (ids.has(feature.id)) addError(errors, `${label}.id is duplicated: ${feature.id}`);
    ids.add(feature.id);
    if (typeof feature.label !== "string" || feature.label.trim() === "") {
      addError(errors, `${label}.label must be a non-empty string`);
    }
    validateStringArray(errors, feature.aliases, `${label}.aliases`, { required: true });
    validateStringArray(errors, feature.routes, `${label}.routes`, { required: true });
    validateStringArray(errors, feature.apiPrefixes, `${label}.apiPrefixes`, { required: true });
    validateStringArray(errors, feature.contracts, `${label}.contracts`, { required: true });
    validateStringArray(errors, feature.verify, `${label}.verify`, { required: true });
    if (typeof feature.routingNotes !== "string" || feature.routingNotes.trim() === "") addError(errors, `${label}.routingNotes must be a non-empty string`);
    registerSearchTerms(errors, searchTerms, feature.id, [feature.id, feature.label], `${label}.label`);
    registerSearchTerms(errors, searchTerms, feature.id, feature.aliases, `${label}.aliases`);
    validateFileGroup(errors, rootDir, feature.frontend, "frontend", `${label}.frontend`);
    validateFileGroup(errors, rootDir, feature.backend, "backend", `${label}.backend`);
    validateVerifyCommands(errors, rootDir, feature.verify, `${label}.verify`);
    const featureBlock = guideBlock(guide, `<!-- feature:${feature.id} -->`);
    if (guide && !featureBlock) {
      addError(errors, `${guideRelativePath} is missing feature marker ${feature.id}`);
    } else if (featureBlock) {
      for (const evidence of [feature.label, feature.routes[0], feature.apiPrefixes[0], feature.frontend.entrypoints[0], feature.backend.entrypoints[0]]) {
        if (!featureBlock.includes(evidence)) addError(errors, `${guideRelativePath} feature ${feature.id} is missing evidence: ${evidence}`);
      }
    }
  }

  for (const [index, concern] of (manifest.sharedConcerns || []).entries()) {
    const label = `sharedConcerns[${index}]`;
    if (!isObject(concern)) {
      addError(errors, `${label} must be an object`);
      continue;
    }
    validateAllowedFields(errors, concern, new Set(["id", "label", "aliases", "readFirst", "thenCheck", "verify"]), label);
    if (typeof concern.id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(concern.id)) {
      addError(errors, `${label}.id must be a kebab-case string`);
      continue;
    }
    if (ids.has(concern.id)) addError(errors, `${label}.id is duplicated: ${concern.id}`);
    ids.add(concern.id);
    validateStringArray(errors, concern.aliases, `${label}.aliases`, { required: true });
    if (typeof concern.label !== "string" || concern.label.trim() === "") addError(errors, `${label}.label must be a non-empty string`);
    validateStringArray(errors, concern.readFirst, `${label}.readFirst`, { required: true });
    validateStringArray(errors, concern.thenCheck, `${label}.thenCheck`, { required: true });
    validateStringArray(errors, concern.verify, `${label}.verify`, { required: true });
    validateVerifyCommands(errors, rootDir, concern.verify, `${label}.verify`);
    registerSearchTerms(errors, searchTerms, concern.id, [concern.id, concern.label], `${label}.label`);
    registerSearchTerms(errors, searchTerms, concern.id, concern.aliases, `${label}.aliases`);
    for (const field of ["readFirst", "thenCheck"]) {
      for (const relativePath of concern[field] || []) {
        if (typeof relativePath === "string" && relativePath.trim() !== "") {
          validateRepoPath(errors, rootDir, relativePath, `${label}.${field}`);
        }
      }
    }
    const concernBlock = guideBlock(guide, `<!-- concern:${concern.id} -->`);
    if (guide && !concernBlock) {
      addError(errors, `${guideRelativePath} is missing concern marker ${concern.id}`);
    } else if (concernBlock) {
      for (const evidence of [concern.label, concern.readFirst[0], concern.thenCheck[0]]) {
        if (!concernBlock.includes(evidence)) addError(errors, `${guideRelativePath} concern ${concern.id} is missing evidence: ${evidence}`);
      }
    }
  }

  const overlaps = new Map();
  for (const feature of manifest.features) {
    for (const kind of ["routes", "apiPrefixes"]) {
      for (const value of feature[kind] || []) {
        const key = `${kind}:${value}`;
        const owners = overlaps.get(key) || [];
        owners.push(feature);
        overlaps.set(key, owners);
      }
    }
  }
  for (const [key, owners] of overlaps) {
    if (owners.length > 1) for (const owner of owners) if (typeof owner.routingNotes !== "string" || !owner.routingNotes.trim()) addError(errors, `overlap ${key} requires routingNotes on ${owner.id}`);
  }

  return errors;
}

export function loadDirectionTree(rootDir = defaultRootDir) {
  return JSON.parse(readFileSync(path.resolve(rootDir, manifestRelativePath), "utf8"));
}

function main() {
  let manifest;
  try {
    manifest = loadDirectionTree(defaultRootDir);
  } catch (error) {
    process.stderr.write(`Functionality direction tree check failed: ${error.message}\n`);
    process.exitCode = 1;
    return;
  }

  const errors = validateDirectionTree({ rootDir: defaultRootDir, manifest });
  if (errors.length > 0) {
    for (const error of errors) process.stderr.write(`Functionality direction tree check failed: ${error}\n`);
    process.exitCode = 1;
    return;
  }

  process.stdout.write(
    `Functionality direction tree: ${manifest.features.length} features and ${manifest.sharedConcerns.length} shared concerns valid.\n`,
  );
}

const invokedPath = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (invokedPath === import.meta.url) main();
