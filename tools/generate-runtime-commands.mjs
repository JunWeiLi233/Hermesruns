#!/usr/bin/env node

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifestPath = join(root, "docs/ai/runtime-command-manifest.json");
const mode = process.argv.includes("--check") ? "check" : "write";

function readManifest() {
  try {
    return JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch (error) {
    throw new Error(`Cannot read ${relative(root, manifestPath)}: ${error.message}`);
  }
}

function generatedMarkdown(runtime, command, source, contract, adapterSource) {
  return [
    `<!-- GENERATED FILE: edit ${adapterSource || ".codex/commands"} and run node tools/generate-runtime-commands.mjs. -->`,
    `<!-- Runtime: ${runtime}; command: /${command}; contract: ${contract} -->`,
    "",
    source.trimEnd(),
    "",
  ].join("\n");
}

function tomlLiteral(value) {
  if (value.includes("'''")) {
    throw new Error("Gemini command source contains a TOML literal-string delimiter.");
  }
  return `'''\n${value.trimEnd()}\n'''`;
}

function generatedGemini(command, source, contract, adapterSource) {
  const body = [
    `<!-- Generated from ${adapterSource || `.codex/commands/${command}.md`}. Do not edit this adapter directly. -->`,
    `<!-- Follow ${contract} for every code change. -->`,
    "",
    source.trimEnd(),
  ].join("\n");
  return [
    "# GENERATED FILE: edit .codex/commands and run node tools/generate-runtime-commands.mjs.",
    "",
    "[command]",
    `description = ${JSON.stringify(`Hermes workflow: /${command}`)}`,
    "",
    "[command.prompt]",
    `text = ${tomlLiteral(body)}`,
    "",
  ].join("\n");
}

function normalizeNewlines(content) {
  return content.replace(/\r\n/g, "\n");
}

function readCommandSource(sourcePath) {
  try {
    return normalizeNewlines(readFileSync(sourcePath, "utf8"));
  } catch {
    throw new Error(`Canonical command is missing: ${relative(root, sourcePath)}`);
  }
}

function expectedFiles(manifest) {
  if (manifest.schemaVersion !== 1 || manifest.canonicalRuntime !== "codex") {
    throw new Error("The manifest must declare schemaVersion 1 and Codex as canonicalRuntime.");
  }
  if (!Array.isArray(manifest.commands) || manifest.commands.length === 0) {
    throw new Error("The manifest must contain at least one canonical command.");
  }

  for (const [runtime, config] of Object.entries(manifest.runtimes)) {
    for (const [command, source] of Object.entries(config.commandSources || {})) {
      if (!manifest.commands.includes(command)) {
        throw new Error(`Unknown ${runtime} adapter command: ${command}`);
      }
      if (typeof source !== "string" || !source.startsWith(`${manifest.canonicalCommandsDirectory}/`) || source.includes("..") || source.includes("\\") || !source.endsWith(".md")) {
        throw new Error(`Invalid canonical adapter source for ${runtime}/${command}: ${String(source)}`);
      }
    }
  }

  const seen = new Set();
  const outputs = [];
  for (const command of manifest.commands) {
    if (typeof command !== "string" || !command || command.startsWith("/") || command.includes("..")) {
      throw new Error(`Invalid command identifier: ${String(command)}`);
    }
    if (seen.has(command)) throw new Error(`Duplicate command identifier: ${command}`);
    seen.add(command);

    const sourcePath = join(root, manifest.canonicalCommandsDirectory, `${command}.md`);
    const source = readCommandSource(sourcePath);

    for (const [runtime, config] of Object.entries(manifest.runtimes)) {
      const destination = join(root, config.directory, `${command}${config.extension}`);
      const adapterSource = config.commandSources?.[command];
      const runtimeSource = adapterSource ? readCommandSource(join(root, adapterSource)) : source;
      const content = runtime === "gemini"
        ? generatedGemini(command, runtimeSource, manifest.editingContract, adapterSource)
        : generatedMarkdown(runtime, command, runtimeSource, manifest.editingContract, adapterSource);
      outputs.push({ runtime, destination, content });
    }
  }
  return outputs;
}

function run() {
  const manifest = readManifest();
  const outputs = expectedFiles(manifest);
  const mismatches = [];

  for (const { destination, content } of outputs) {
    let actual = null;
    try {
      actual = normalizeNewlines(readFileSync(destination, "utf8"));
    } catch {}
    if (actual !== content) mismatches.push(relative(root, destination));
    if (mode === "write" && actual !== content) {
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, content, "utf8");
    }
  }

  if (mode === "check" && mismatches.length > 0) {
    process.stderr.write(`Generated command adapters are stale:\n${mismatches.map((file) => `- ${file}`).join("\n")}\n`);
    process.exitCode = 1;
    return;
  }

  if (mode === "write") {
    process.stdout.write(`Generated ${outputs.length} runtime command adapters.\n`);
  } else {
    process.stdout.write(`Runtime command adapters are current (${outputs.length} files).\n`);
  }
}

try {
  run();
} catch (error) {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
}
