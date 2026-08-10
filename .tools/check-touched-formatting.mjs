#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function option(name) {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
}

function changedFiles(base, head) {
  return execFileSync("git", ["diff", "--name-only", base, head], {
    cwd: root,
    encoding: "utf8",
  })
    .split(/\r?\n/)
    .map((file) => file.trim())
    .filter(Boolean);
}

function run(command, commandArgs, cwd) {
  execFileSync(command, commandArgs, { cwd, stdio: "inherit" });
}

const base = option("--base");
const head = option("--head") ?? "HEAD";
if (!base) {
  process.stderr.write("Usage: node .tools/check-touched-formatting.mjs --base <sha> [--head <sha>]\n");
  process.exit(2);
}

const files = changedFiles(base, head);
const frontendFiles = files
  .filter((file) => /^frontend\/.+\.(?:js|jsx|css|mjs|cjs|json|md)$/.test(file))
  .map((file) => file.slice("frontend/".length))
  .filter((file) => existsSync(resolve(root, "frontend", file)));
const javaFiles = files
  .filter((file) => /^backend\/src\/(?:main|test)\/java\/.+\.java$/.test(file))
  .map((file) => file.slice("backend/".length))
  .filter((file) => existsSync(resolve(root, "backend", file)));

if (frontendFiles.length > 0) {
  run("npm", ["exec", "--", "prettier", "--check", ...frontendFiles], resolve(root, "frontend"));
}
if (javaFiles.length > 0) {
  run(
    "./mvnw",
    ["-q", `-DspotlessFiles=${javaFiles.join(",")}`, "spotless:check"],
    resolve(root, "backend"),
  );
}

process.stdout.write(
  `Formatting checked: ${frontendFiles.length} frontend file(s), ${javaFiles.length} Java file(s).\n`,
);
