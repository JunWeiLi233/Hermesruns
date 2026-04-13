#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function parseArgs(argv) {
  const args = {
    write: false,
    json: false,
    commit: false,
    task: "",
    summary: "",
    surface: "",
    message: "",
    files: "",
    verify: "",
    outputJson: ".ai-sync/AUTO_HERMES_FINISH.json",
    outputMd: ".ai-sync/AUTO_HERMES_FINISH.md",
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--commit") args.commit = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[++i] || args[key];
    }
  }
  return args;
}

function resolveFromRoot(relPath) {
  return path.isAbsolute(relPath) ? relPath : path.resolve(ROOT, relPath);
}

function splitList(value) {
  return String(value || "")
    .split("||")
    .flatMap((item) => item.split(","))
    .map((item) => item.trim().replace(/^`|`$/g, ""))
    .filter(Boolean);
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

function nowIso() {
  return new Date().toISOString();
}

function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function changedPathsFromStatus() {
  const status = runGit(["status", "--short", "--untracked-files=all"]);
  if (!status) return [];
  return dedupe(
    status
      .split(/\r?\n/)
      .map((line) => line.slice(3).trim())
      .filter(Boolean)
  );
}

function buildMessage(args) {
  if (args.message.trim()) return args.message.trim();
  const base = [args.task, args.surface, args.summary]
    .map((value) => String(value || "").trim())
    .find(Boolean) || "auto-hermes round";
  return base
    .replace(/\s+/g, " ")
    .replace(/[`"]/g, "")
    .slice(0, 72);
}

function renderMarkdown(result) {
  const lines = [
    "# Auto-Hermes Finish",
    "",
    `Generated: ${result.generatedAt}`,
    "",
    `Decision: ${result.eligible ? "auto-commit ready" : "not ready"}`,
    `Message: ${result.message}`,
    `Command: ${result.command}`,
    `Reason: ${result.reason}`,
    "",
    "## Files",
  ];

  if (result.files.length) {
    result.files.forEach((file) => lines.push(`- ${file}`));
  } else {
    lines.push("- none");
  }

  if (result.verify.length) {
    lines.push("", "## Verification");
    result.verify.forEach((item) => lines.push(`- ${item}`));
  }

  if (result.commitResult) {
    lines.push("", "## Commit Result", result.commitResult);
  }

  return `${lines.join("\n")}\n`;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = dedupe(splitList(args.files).length ? splitList(args.files) : changedPathsFromStatus());
  const message = buildMessage(args);
  const commandParts = [
    "powershell",
    "-File",
    ".tools/auto-commit.ps1",
    "-Message",
    `"${message}"`,
  ];
  if (files.length) {
    commandParts.push("-Paths", files.map((file) => `"${file}"`).join(","));
  }

  const result = {
    generatedAt: nowIso(),
    eligible: files.length > 0,
    message,
    surface: args.surface,
    task: args.task,
    summary: args.summary,
    files,
    verify: splitList(args.verify),
    reason: files.length > 0
      ? "Product-file changes were detected and can be passed through the repo auto-commit helper."
      : "No changed files were detected for the finish helper to stage/commit.",
    command: commandParts.join(" "),
    commitResult: "",
  };

  if (args.commit && result.eligible) {
    const psArgs = ["-File", resolveFromRoot(".tools/auto-commit.ps1"), "-Message", message];
    if (files.length) {
      psArgs.push("-Paths", ...files);
    }
    result.commitResult = execFileSync("powershell", psArgs, { cwd: ROOT, encoding: "utf8" }).trim();
  }

  if (args.write) {
    fs.writeFileSync(resolveFromRoot(args.outputJson), JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(resolveFromRoot(args.outputMd), renderMarkdown(result), "utf8");
  }

  if (args.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(renderMarkdown(result));
}

main();
