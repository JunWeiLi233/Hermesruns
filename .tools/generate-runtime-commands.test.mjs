#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(join(root, "docs/ai/runtime-command-manifest.json"), "utf8"));

if (manifest.canonicalRuntime !== "codex") throw new Error("Codex must remain the canonical runtime.");
if (!existsSync(join(root, manifest.editingContract))) throw new Error("The shared editing contract is missing.");
for (const runtime of ["claude", "gemini", "opencode"]) {
  if (!manifest.runtimes[runtime]) throw new Error(`Missing runtime configuration: ${runtime}`);
}

for (const command of manifest.commands) {
  if (!existsSync(join(root, manifest.canonicalCommandsDirectory, `${command}.md`))) {
    throw new Error(`Missing canonical command: ${command}`);
  }
  for (const config of Object.values(manifest.runtimes)) {
    const destination = join(root, config.directory, `${command}${config.extension}`);
    if (!existsSync(destination)) throw new Error(`Missing generated adapter: ${destination}`);
    const content = readFileSync(destination, "utf8");
    if (!content.includes(manifest.editingContract)) {
      throw new Error(`Generated adapter does not reference the editing contract: ${destination}`);
    }
  }
}

execFileSync(process.execPath, [".tools/generate-runtime-commands.mjs", "--check"], {
  cwd: root,
  stdio: "inherit",
});
