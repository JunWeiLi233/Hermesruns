import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) {
    return "";
  }
  return args[index + 1].trim();
}

function readList(name) {
  const value = readArg(name);
  if (!value) {
    return [];
  }
  return value
    .split("||")
    .map((item) => item.trim())
    .filter(Boolean);
}

function toBulletBlock(items) {
  if (!items.length) {
    return ["- none"];
  }
  return items.map((item) => `- ${item}`);
}

const agent = readArg("agent").toLowerCase();
const status = (readArg("status") || "active").toLowerCase();

const checkpointTargets = {
  codex: ".ai-codex/CODEX_CHECKPOINT.md",
  claude: ".claude/CLAUDE_CHECKPOINT.md",
  antigravity: ".claude/checkpoints/ANTIGRAVITY_CHECKPOINT.md",
};

if (!checkpointTargets[agent]) {
  console.error(
    "Unknown or missing --agent. Expected one of: codex, claude, antigravity.",
  );
  process.exit(1);
}

const checkpointPath = path.resolve(checkpointTargets[agent]);
fs.mkdirSync(path.dirname(checkpointPath), { recursive: true });

const timestamp = new Date().toISOString();

let content;

if (status === "clear") {
  content = [
    "Status: clear",
    `Updated: ${timestamp}`,
    `Agent: ${agent}`,
    "",
    "Task:",
    "- none",
    "",
    "Files:",
    "- none",
    "",
    "Completed:",
    "- none",
    "",
    "Next Step:",
    "- none",
    "",
    "Pending Verify:",
    "- none",
    "",
    "Blocker:",
    "- none",
    "",
  ].join("\n");
} else {
  content = [
    `Status: ${status}`,
    `Updated: ${timestamp}`,
    `Agent: ${agent}`,
    "",
    "Task:",
    ...toBulletBlock(readList("task")),
    "",
    "Files:",
    ...toBulletBlock(readList("files")),
    "",
    "Completed:",
    ...toBulletBlock(readList("completed")),
    "",
    "Next Step:",
    ...toBulletBlock(readList("next")),
    "",
    "Pending Verify:",
    ...toBulletBlock(readList("verify")),
    "",
    "Blocker:",
    ...toBulletBlock(readList("blocker")),
    "",
  ].join("\n");
}

fs.writeFileSync(checkpointPath, content, "utf8");
process.stdout.write(`${checkpointPath}\n`);
