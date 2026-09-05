import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

export function shellQuote(value) {
  const escaped = String(value ?? "").replace(/'/g, process.platform === "win32" ? "''" : "'\"'\"'");
  return `'${escaped}'`;
}

export function runShellCommand(command, options = {}) {
  if (process.platform === "win32") {
    const powershell = path.join(process.env.SystemRoot || "C:\\Windows", "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
    return execFileSync(powershell, ["-NoProfile", "-NonInteractive", "-Command", command], options);
  }
  return execFileSync("/bin/sh", ["-c", command], options);
}

export function runExecutable(file, args, options = {}) {
  // Windows command shims need a shell; native executables retain literal argv.
  if (process.platform === "win32" && /\.(?:cmd|bat|ps1)$/i.test(file)) {
    return runShellCommand(`& ${[file, ...args].map(shellQuote).join(" ")}`, options);
  }
  return execFileSync(file, args, options);
}

function applyTemplate(template, values) {
  return template.replace(/\{([a-zA-Z0-9]+)\}/g, (match, key) => Object.hasOwn(values, key) ? values[key] : match);
}

export function runExecutorCommand(executor, values, options = {}) {
  if (executor.file) {
    return runExecutable(executor.file, executor.args.map((arg) => applyTemplate(arg, values)), options);
  }
  const quotedValues = Object.fromEntries(Object.entries(values).map(([key, value]) => [key,
    typeof value === "number" ? String(value) : shellQuote(value),
  ]));
  return runShellCommand(applyTemplate(executor.command, quotedValues), options);
}

export function resolveCommandFromPath(commandName) {
  const raw = String(commandName || "").trim();
  if (!raw) return "";
  const isExecutable = (candidate) => {
    try {
      if (!fs.statSync(candidate).isFile()) return false;
      fs.accessSync(candidate, process.platform === "win32" ? fs.constants.F_OK : fs.constants.X_OK);
      return true;
    } catch {
      return false;
    }
  };
  if (raw.includes("\\") || raw.includes("/")) return isExecutable(raw) ? raw : "";
  const extensions = process.platform === "win32" && !/\.[^./\\]+$/.test(raw)
    ? String(process.env.PATHEXT || ".COM;.EXE;.BAT;.CMD;.PS1").split(";").filter(Boolean)
    : [];
  for (const dir of String(process.env.PATH || "").split(path.delimiter).filter(Boolean)) {
    for (const name of [raw, ...extensions.map((ext) => `${raw}${ext}`)]) {
      const candidate = path.join(dir, name);
      if (isExecutable(candidate)) return candidate;
    }
  }
  return "";
}
