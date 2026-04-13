import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return "";
  return args[index + 1].trim();
}

function readList(name) {
  const value = readArg(name);
  if (!value) return [];
  return value
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function nowIso() {
  return new Date().toISOString();
}

function compactKey(value) {
  return (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function normalizeKey(value, surface, task) {
  const raw = (value || "").trim();
  if (!raw || raw === task || /^Task:/i.test(raw)) {
    return compactKey(`${surface || ""} ${task || ""}`);
  }
  return raw;
}

function dedupe(values) {
  return [...new Set(values.filter(Boolean))];
}

const command = (args[0] || "").toLowerCase();
const filePath = path.resolve(".ai-sync/AGENT_SYNC.json");
const mdPath = path.resolve(".ai-sync/AGENT_SYNC.md");
const humanLoopPath = path.resolve(".ai-sync/HUMAN_LOOP.md");

function emptyState() {
  return {
    updatedAt: nowIso(),
    activeClaims: [],
    recentlyCompleted: [],
    mustFixQueue: [],
    humanInbox: [],
  };
}

function extractMarkdownSection(text, heading) {
  const escaped = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^## ${escaped}\\r?\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
  const match = text.match(pattern);
  return match ? match[1].trimEnd() : "";
}

function parseMdItems(sectionText) {
  if (!sectionText || /^\s*-\s*none\s*$/im.test(sectionText)) return [];
  return sectionText
    .split(/\n(?=- Key: )/g)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      const readLine = (label) => {
        const match = block.match(new RegExp(`^\\s*(?:-\\s*)?${label}:[ \\t]*(.+)$`, "m"));
        return match ? match[1].trim() : "";
      };
      const splitList = (value) =>
        value
          .split("|")
          .map((item) => item.trim())
          .filter(Boolean);

      const task = readLine("Task");
      const surface = readLine("Surface");

      return {
        key: normalizeKey(readLine("Key"), surface, task),
        task,
        surface,
        agent: readLine("Agent"),
        owner: readLine("Owner"),
        status: readLine("Status"),
        startedAt: readLine("Started"),
        completedAt: readLine("Completed"),
        verify: splitList(readLine("Verify")),
        files: splitList(readLine("Files")),
        rollbackTarget: readLine("Rollback Target"),
        rollbackFiles: splitList(readLine("Rollback Files")),
        review: readLine("Review"),
        note: readLine("Note"),
        next: readLine("Next"),
      };
    });
}

function loadFromMarkdown() {
  if (!fs.existsSync(mdPath)) return emptyState();
  try {
    const md = fs.readFileSync(mdPath, "utf8");
    const updatedAt = (md.match(/^Updated:\s*(.+)$/m) || [])[1]?.trim() || nowIso();
    return {
      updatedAt,
      activeClaims: parseMdItems(extractMarkdownSection(md, "Active Claims")),
      recentlyCompleted: parseMdItems(extractMarkdownSection(md, "Recently Completed")),
      mustFixQueue: parseMdItems(extractMarkdownSection(md, "Must-Fix Queue")),
      humanInbox: parseMdItems(extractMarkdownSection(md, "Human Inbox")),
    };
  } catch {
    return emptyState();
  }
}

function loadState() {
  const jsonExists = fs.existsSync(filePath);
  const mdExists = fs.existsSync(mdPath);

  if (!jsonExists && !mdExists) return emptyState();

  const jsonMtime = jsonExists ? fs.statSync(filePath).mtimeMs : -1;
  const mdMtime = mdExists ? fs.statSync(mdPath).mtimeMs : -1;

  if (mdMtime > jsonMtime) {
    return loadFromMarkdown();
  }

  if (jsonExists) {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      const normalizeItem = (item) => ({
        ...item,
        key: normalizeKey(item?.key, item?.surface || "", item?.task || ""),
      });
      return {
        updatedAt: parsed.updatedAt || nowIso(),
        activeClaims: Array.isArray(parsed.activeClaims)
          ? parsed.activeClaims.map(normalizeItem)
          : [],
        recentlyCompleted: Array.isArray(parsed.recentlyCompleted)
          ? parsed.recentlyCompleted.map(normalizeItem)
          : [],
        mustFixQueue: Array.isArray(parsed.mustFixQueue)
          ? parsed.mustFixQueue.map(normalizeItem)
          : [],
        humanInbox: Array.isArray(parsed.humanInbox) ? parsed.humanInbox.map(normalizeItem) : [],
      };
    } catch {
      return loadFromMarkdown();
    }
  }

  return loadFromMarkdown();
}

function saveState(state) {
  state.updatedAt = nowIso();
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(state, null, 2), "utf8");
  fs.writeFileSync(mdPath, renderMarkdown(state), "utf8");
  ensureHumanLoopFile();
}

function toBullet(items, fallback = "- none") {
  return items.length ? items.map((item) => `- ${item}`) : [fallback];
}

function renderItem(item) {
  const lines = [];
  lines.push(`- Key: ${item.key}`);
  if (item.task) lines.push(`  Task: ${item.task}`);
  if (item.surface) lines.push(`  Surface: ${item.surface}`);
  if (item.agent) lines.push(`  Agent: ${item.agent}`);
  if (item.owner) lines.push(`  Owner: ${item.owner}`);
  if (item.status) lines.push(`  Status: ${item.status}`);
  if (item.startedAt) lines.push(`  Started: ${item.startedAt}`);
  if (item.completedAt) lines.push(`  Completed: ${item.completedAt}`);
  if (item.verify?.length) lines.push(`  Verify: ${item.verify.join(" | ")}`);
  if (item.files?.length) lines.push(`  Files: ${item.files.join(" | ")}`);
  if (item.rollbackTarget) lines.push(`  Rollback Target: ${item.rollbackTarget}`);
  if (item.rollbackFiles?.length) lines.push(`  Rollback Files: ${item.rollbackFiles.join(" | ")}`);
  if (item.review) lines.push(`  Review: ${item.review}`);
  if (item.note) lines.push(`  Note: ${item.note}`);
  if (item.next) lines.push(`  Next: ${item.next}`);
  return lines.join("\n");
}

function renderMarkdown(state) {
  const lines = [
    "# Cross-Agent Sync",
    "",
    `Updated: ${state.updatedAt || nowIso()}`,
    "",
    "Use this file as the shared cross-platform coordination layer for Codex, Claude, and other Hermes-capable agents.",
    "",
    "## Rules",
    "- Read this file before starting queue work, resuming a checkpoint, or reclaiming a user-visible task.",
    "- Claim a task before implementation when the work unit is not trivially local.",
    "- Do not re-pick recently completed work unless there is a recorded must-fix, regression, or explicit user request.",
    "- Reviewer must-fix items outrank fresh speculative ideas.",
    "- Before self-generated follow-up rounds, also read `.ai-sync/HUMAN_LOOP.md` for human steering, pause, or reversal requests.",
    "- Keep entries short and overwrite stale claims instead of appending long history.",
    "",
    "## Active Claims",
  ];

  if (state.activeClaims.length) {
    state.activeClaims.forEach((item) => {
      lines.push(renderItem(item));
      lines.push("");
    });
  } else {
    lines.push("- none");
    lines.push("");
  }

  lines.push("## Recently Completed");
  if (state.recentlyCompleted.length) {
    state.recentlyCompleted.forEach((item) => {
      lines.push(renderItem(item));
      lines.push("");
    });
  } else {
    lines.push("- none");
    lines.push("");
  }

  lines.push("## Must-Fix Queue");
  if (state.mustFixQueue.length) {
    state.mustFixQueue.forEach((item) => {
      lines.push(renderItem(item));
      lines.push("");
    });
  } else {
    lines.push("- none");
    lines.push("");
  }

  lines.push("## Human Inbox");
  if (state.humanInbox.length) {
    state.humanInbox.forEach((item) => {
      lines.push(renderItem(item));
      lines.push("");
    });
  } else {
    lines.push("- none");
    lines.push("");
  }

  return `${lines.join("\n").trimEnd()}\n`;
}

function ensureHumanLoopFile() {
  if (fs.existsSync(humanLoopPath)) return;
  const content = [
    "# Human Loop",
    "",
    "This is the single human interaction point for Hermes auto loops.",
    "",
    "Agents should read this file before starting a new self-generated round.",
    "Humans can steer, pause, approve, reject, or reverse the loop here without editing workflow files.",
    "",
    "## Current Status",
    "- Status: active",
    "",
    "## Human Requests",
    "- none",
    "",
    "## Reversal Requests",
    "- none",
    "",
    "## Priority Overrides",
    "- none",
    "",
    "## Ideas To Consider",
    "- none",
    "",
    "## Notes For Reviewer",
    "- If you ask for a rollback, name the target commit, design version, or surface.",
    "",
  ].join("\n");
  fs.writeFileSync(humanLoopPath, content, "utf8");
}

function baseItem() {
  const task = readArg("task");
  const surface = readArg("surface");
  const key = readArg("key") || compactKey(`${surface} ${task}`);
  return {
    key,
    task,
    surface,
    agent: readArg("agent") || "unknown",
    owner: readArg("owner") || "",
    files: dedupe(readList("files")),
    verify: dedupe(readList("verify")),
    rollbackTarget: readArg("rollback"),
    rollbackFiles: dedupe(readList("rollback-files")),
    review: readArg("review"),
    note: readArg("note"),
    next: readArg("next"),
    status: readArg("status") || "",
  };
}

function prune(state) {
  state.activeClaims = state.activeClaims.slice(-20);
  state.recentlyCompleted = state.recentlyCompleted.slice(-20);
  state.mustFixQueue = state.mustFixQueue.slice(-20);
  state.humanInbox = state.humanInbox.slice(-20);
}

const state = loadState();

if (command === "init") {
  saveState(state);
  process.stdout.write(`${mdPath}\n${humanLoopPath}\n`);
  process.exit(0);
}

if (command === "claim") {
  const item = baseItem();
  item.status = "claimed";
  item.startedAt = nowIso();
  state.activeClaims = state.activeClaims.filter((entry) => entry.key !== item.key);
  state.activeClaims.push(item);
  prune(state);
  saveState(state);
  process.stdout.write(`${mdPath}\n`);
  process.exit(0);
}

if (command === "finish") {
  const item = baseItem();
  item.status = "completed";
  item.completedAt = nowIso();
  state.activeClaims = state.activeClaims.filter((entry) => entry.key !== item.key);
  state.mustFixQueue = state.mustFixQueue.filter((entry) => entry.key !== item.key);
  state.recentlyCompleted = state.recentlyCompleted.filter((entry) => entry.key !== item.key);
  state.recentlyCompleted.unshift(item);
  prune(state);
  saveState(state);
  process.stdout.write(`${mdPath}\n`);
  process.exit(0);
}

if (command === "must-fix") {
  const item = baseItem();
  item.status = "must-fix";
  item.startedAt = nowIso();
  state.mustFixQueue = state.mustFixQueue.filter((entry) => entry.key !== item.key);
  state.mustFixQueue.unshift(item);
  prune(state);
  saveState(state);
  process.stdout.write(`${mdPath}\n`);
  process.exit(0);
}

if (command === "human-note") {
  const item = baseItem();
  item.status = readArg("status") || "human-note";
  item.startedAt = nowIso();
  state.humanInbox = state.humanInbox.filter((entry) => entry.key !== item.key);
  state.humanInbox.unshift(item);
  prune(state);
  saveState(state);
  process.stdout.write(`${mdPath}\n${humanLoopPath}\n`);
  process.exit(0);
}

if (command === "ack-human") {
  const key = readArg("key") || compactKey(`${readArg("surface")} ${readArg("task")}`);
  state.humanInbox = state.humanInbox.filter((entry) => entry.key !== key);
  saveState(state);
  process.stdout.write(`${mdPath}\n${humanLoopPath}\n`);
  process.exit(0);
}

if (command === "release") {
  const key = readArg("key") || compactKey(`${readArg("surface")} ${readArg("task")}`);
  state.activeClaims = state.activeClaims.filter((entry) => entry.key !== key);
  saveState(state);
  process.stdout.write(`${mdPath}\n`);
  process.exit(0);
}

if (command === "status") {
  saveState(state);
  process.stdout.write(
    `${fs.readFileSync(mdPath, "utf8")}\n${fs.readFileSync(humanLoopPath, "utf8")}`,
  );
  process.exit(0);
}

console.error(
  "Unknown command. Use one of: init, claim, finish, must-fix, human-note, ack-human, release, status.",
);
process.exit(1);
