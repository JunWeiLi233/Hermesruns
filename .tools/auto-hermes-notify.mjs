#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");

function nowIso() {
  return new Date().toISOString();
}

function parseArgs(argv = []) {
  const args = {
    write: false,
    json: false,
    shouldNotify: false,
    task: "",
    surface: "",
    summary: "",
    message: "",
    reason: "",
    files: "",
    verify: "",
    finishEligible: false,
    commitAttempted: false,
    commitResult: "",
    commitError: "",
    pushAttempted: false,
    outputJson: ".ai-sync/AUTO_HERMES_NOTIFY.json",
    outputMd: ".ai-sync/AUTO_HERMES_NOTIFY.md",
    notifyEnv: "",
    notifyTransport: "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--write") args.write = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--should-notify") args.shouldNotify = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, char) => char.toUpperCase());
      if (key in args) args[key] = argv[index + 1] || args[key];
      index += 1;
    }
  }

  return args;
}

function resolveFromRoot(filePath) {
  return path.isAbsolute(filePath) ? filePath : path.resolve(ROOT, filePath);
}

function truthy(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function envValue(source, key) {
  if (source && typeof source === "object" && !Array.isArray(source)) {
    return source[key] || "";
  }
  return process.env[key] || "";
}

function renderMarkdown(result) {
  return [
    "# Auto-Hermes Notify",
    "",
    `Generated: ${result.generatedAt}`,
    `Status: ${result.status}`,
    `Reason: ${result.reason}`,
    "",
    "## Message",
    `- task: ${result.task || "none"}`,
    `- surface: ${result.surface || "none"}`,
    `- summary: ${result.summary || "none"}`,
    `- commit attempted: ${result.commitAttempted ? "yes" : "no"}`,
    `- push attempted: ${result.pushAttempted ? "yes" : "no"}`,
  ].join("\n");
}

export function runAutoHermesNotify(options = {}) {
  const notifyEnv = options.notifyEnv && typeof options.notifyEnv === "object" ? options.notifyEnv : process.env;
  const enabled = truthy(envValue(notifyEnv, "AUTO_HERMES_NOTIFY_ENABLED")) || Boolean(options.notifyTransport);
  const shouldNotify = Boolean(options.shouldNotify);
  const recipient = envValue(notifyEnv, "AUTO_HERMES_NOTIFY_TO");
  const host = envValue(notifyEnv, "SPRING_MAIL_HOST");
  const from = envValue(notifyEnv, "APP_MAIL_FROM") || envValue(notifyEnv, "SPRING_MAIL_USERNAME");
  const transportName = typeof options.notifyTransport === "function"
    ? "custom"
    : options.notifyTransport || envValue(notifyEnv, "AUTO_HERMES_NOTIFY_TRANSPORT") || "disabled";
  const result = {
    generatedAt: nowIso(),
    status: "skipped",
    reason: !shouldNotify
      ? "Email notification skipped because this finish path is not a true clean stop."
      : "Email notification not configured.",
    recipient,
    from,
    host,
    port: Number(envValue(notifyEnv, "SPRING_MAIL_PORT") || 0),
    transport: transportName,
    deliveryId: "",
    subject: `Auto-Hermes: ${options.message || options.summary || "finish"}`,
    warning: "",
    task: options.task || "",
    surface: options.surface || "",
    summary: options.summary || "",
    message: options.message || "",
    finishEligible: Boolean(options.finishEligible),
    commitAttempted: Boolean(options.commitAttempted),
    commitResult: options.commitResult || "",
    commitError: options.commitError || "",
    pushAttempted: Boolean(options.pushAttempted),
    files: options.files || "",
    verify: options.verify || "",
  };

  const configured = Boolean(enabled && recipient && host);
  if (shouldNotify && !configured) {
    result.reason = "Email notification not configured: SMTP host and recipient are required.";
    result.warning = enabled && !recipient ? "AUTO_HERMES_NOTIFY_TO is empty." : "";
  } else if (shouldNotify && configured) {
    const payload = {
      to: recipient,
      from,
      host,
      port: result.port,
      subject: result.subject,
      body: [
        "Auto-Hermes finish notification",
        "",
        `Task: ${result.task || "none"}`,
        `Surface: ${result.surface || "none"}`,
        `Summary: ${result.summary || "none"}`,
        `Reason: ${options.reason || "none"}`,
        `Commit attempted: ${result.commitAttempted ? "yes" : "no"}`,
        result.commitResult ? `Commit result: ${result.commitResult}` : "",
        result.commitError ? `Commit error: ${result.commitError}` : "",
      ].filter(Boolean).join("\n"),
    };

    try {
      const delivery = typeof options.notifyTransport === "function"
        ? options.notifyTransport(payload)
        : { transport: transportName, deliveryId: "" };
      result.status = "sent";
      result.reason = "Email notification sent.";
      result.transport = delivery?.transport || transportName;
      result.deliveryId = delivery?.deliveryId || "";
    } catch (error) {
      result.status = "warning";
      result.reason = `Email notification failed: ${String(error?.message || error || "unknown error")}`;
      result.warning = String(error?.message || error || "unknown error");
    }
  }

  if (options.write) {
    fs.mkdirSync(path.dirname(resolveFromRoot(options.outputJson || ".ai-sync/AUTO_HERMES_NOTIFY.json")), { recursive: true });
    fs.writeFileSync(resolveFromRoot(options.outputJson || ".ai-sync/AUTO_HERMES_NOTIFY.json"), JSON.stringify(result, null, 2), "utf8");
    fs.writeFileSync(resolveFromRoot(options.outputMd || ".ai-sync/AUTO_HERMES_NOTIFY.md"), renderMarkdown(result), "utf8");
  }

  return { result };
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  const args = parseArgs(process.argv.slice(2));
  const output = runAutoHermesNotify(args);
  if (args.json) {
    process.stdout.write(`${JSON.stringify(output.result, null, 2)}\n`);
  } else {
    process.stdout.write(`${renderMarkdown(output.result)}\n`);
  }
}
