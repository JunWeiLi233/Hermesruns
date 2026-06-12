#!/usr/bin/env node
/**
 * auto-hermes-pull-main — safely sync the local repo with upstream GitHub.
 *
 * Mirror of `auto-hermes-push-main`, in the other direction. Inspects local
 * state, auto-stashes uncommitted work, fast-forwards (or merges / rebases on
 * feature branches), surfaces conflicts WITHOUT auto-resolving, and writes an
 * auditable artifact to `.ai-sync/AUTO_HERMES_PULL_MAIN.{json,md}`.
 *
 * Usage:
 *   node .tools/auto-hermes-pull-main.mjs               # dry-run, default
 *   node .tools/auto-hermes-pull-main.mjs --execute     # actually pull
 *   node .tools/auto-hermes-pull-main.mjs --execute --strategy rebase
 *   node .tools/auto-hermes-pull-main.mjs --execute --no-stash       # require clean tree
 *   node .tools/auto-hermes-pull-main.mjs --execute --target-branch main
 *   node .tools/auto-hermes-pull-main.mjs --execute --target-remote-url <url>
 */

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(__filename), "..");
const EXPECTED_REMOTE_URL = "https://github.com/520HXC/run.git";

function parseArgs(argv) {
  const args = {
    rootDir: ROOT,
    execute: false,
    json: false,
    write: false,
    targetBranch: "",          // "" = upstream of current branch; default falls back to main
    remoteName: "origin",
    targetRemoteUrl: EXPECTED_REMOTE_URL,
    strategy: "",               // "" = auto: ff-only on main, merge on feature
    autoStash: true,
    allowConflicts: false,
    outputJson: ".ai-sync/AUTO_HERMES_PULL_MAIN.json",
    outputMd: ".ai-sync/AUTO_HERMES_PULL_MAIN.md",
  };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--execute") args.execute = true;
    else if (arg === "--json") args.json = true;
    else if (arg === "--write") args.write = true;
    else if (arg === "--no-stash") args.autoStash = false;
    else if (arg === "--allow-conflicts") args.allowConflicts = true;
    else if (arg.startsWith("--")) {
      const key = arg.slice(2).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      if (key in args) args[key] = argv[++i] ?? args[key];
    }
  }
  args.rootDir = path.resolve(String(args.rootDir || ROOT));
  return args;
}

function normalizeRemoteUrl(value) {
  return String(value || "")
    .trim()
    .replace(/\\/g, "/")
    .replace(/\.git$/i, "")
    .replace(/\/+$/g, "")
    .toLowerCase();
}

function git(args, opts = {}) {
  try {
    const out = execFileSync("git", args, {
      cwd: opts.cwd || ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, stdout: String(out).trim(), stderr: "" };
  } catch (err) {
    return {
      ok: false,
      stdout: String(err.stdout || "").trim(),
      stderr: String(err.stderr || err.message || "").trim(),
      code: err.status ?? null,
    };
  }
}

function gitOrEmpty(args, opts) {
  const r = git(args, opts);
  return r.ok ? r.stdout : "";
}

const STEPS = [];
function step(name, status, detail) {
  STEPS.push({ name, status, detail: detail ?? "" });
}

function bail(reason, extra = {}) {
  return { ok: false, reason, steps: STEPS, ...extra };
}

function ensureRepo(rootDir) {
  if (!fs.existsSync(path.join(rootDir, ".git"))) {
    return bail("not-a-git-repo", { rootDir });
  }
  return { ok: true };
}

function gatherState(args) {
  const remoteUrl = gitOrEmpty(["remote", "get-url", args.remoteName]);
  const currentBranch = gitOrEmpty(["rev-parse", "--abbrev-ref", "HEAD"]);
  const headSha = gitOrEmpty(["rev-parse", "HEAD"]);
  const upstreamRef = gitOrEmpty(["rev-parse", "--abbrev-ref", "@{upstream}"]);
  const statusPorcelain = gitOrEmpty(["status", "--porcelain"]);
  const cleanTree = statusPorcelain.length === 0;
  return { remoteUrl, currentBranch, headSha, upstreamRef, statusPorcelain, cleanTree };
}

function resolveTargetRef(args, state) {
  if (args.targetBranch) return `${args.remoteName}/${args.targetBranch}`;
  if (state.upstreamRef) return state.upstreamRef;
  return `${args.remoteName}/main`;
}

function computeAheadBehind(targetRef) {
  const r = git(["rev-list", "--left-right", "--count", `HEAD...${targetRef}`]);
  if (!r.ok) return { ahead: null, behind: null, error: r.stderr };
  const [ahead, behind] = r.stdout.split(/\s+/).map((x) => Number(x));
  return { ahead, behind };
}

function resolveStrategy(args, state, targetBranchName) {
  if (args.strategy) return args.strategy;
  const onMain = state.currentBranch === "main";
  if (onMain) return "ff-only";
  if (targetBranchName === "main") return "merge"; // feature pulling main → merge
  return "merge";
}

function commitsBeingPulled(targetRef) {
  const r = git([
    "log",
    `HEAD..${targetRef}`,
    "--no-merges",
    "--pretty=format:%h%x09%an%x09%s",
    "--max-count=20",
  ]);
  if (!r.ok || !r.stdout) return [];
  return r.stdout.split("\n").map((line) => {
    const [sha, author, ...rest] = line.split("\t");
    return { sha, author, subject: rest.join("\t") };
  });
}

function filesChangedBetween(fromSha, toSha) {
  const r = git(["diff", "--name-status", `${fromSha}..${toSha}`]);
  if (!r.ok || !r.stdout) return [];
  return r.stdout.split("\n").map((line) => {
    const [status, ...parts] = line.split(/\t/);
    return { status, path: parts.join("\t") };
  });
}

function writeArtifact(args, payload) {
  if (!args.write) return;
  const jsonPath = path.resolve(args.rootDir, args.outputJson);
  const mdPath = path.resolve(args.rootDir, args.outputMd);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n");
  const md = renderMarkdown(payload);
  fs.writeFileSync(mdPath, md);
}

function renderMarkdown(p) {
  const lines = [];
  lines.push(`# Auto-Hermes Pull Main`);
  lines.push("");
  lines.push(`Generated: ${p.timestamp}`);
  lines.push(`Mode: ${p.execute ? "EXECUTE" : "DRY-RUN"}`);
  lines.push(`Outcome: ${p.outcome}`);
  lines.push("");
  lines.push(`- Remote: ${p.state?.remoteUrl || "(none)"}`);
  lines.push(`- Current branch: ${p.state?.currentBranch || "(detached)"}`);
  lines.push(`- Target ref: ${p.targetRef || "-"}`);
  lines.push(`- Strategy: ${p.strategy || "-"}`);
  lines.push(`- Ahead/Behind: ${p.aheadBehind?.ahead ?? "?"} / ${p.aheadBehind?.behind ?? "?"}`);
  lines.push(`- Clean tree: ${p.state?.cleanTree ?? "?"}`);
  lines.push(`- Auto-stash used: ${p.stashed ? "yes" : "no"}`);
  lines.push("");
  if (p.commitsPulled?.length) {
    lines.push(`## Commits pulled (${p.commitsPulled.length})`);
    for (const c of p.commitsPulled) lines.push(`- \`${c.sha}\` ${c.subject} _(${c.author})_`);
    lines.push("");
  }
  if (p.filesChanged?.length) {
    lines.push(`## Files changed (${p.filesChanged.length})`);
    for (const f of p.filesChanged.slice(0, 40)) lines.push(`- \`${f.status}\` ${f.path}`);
    if (p.filesChanged.length > 40) lines.push(`- … and ${p.filesChanged.length - 40} more`);
    lines.push("");
  }
  if (p.conflicts?.length) {
    lines.push(`## Conflicts (manual resolution required)`);
    for (const c of p.conflicts) lines.push(`- ${c}`);
    lines.push("");
  }
  lines.push(`## Steps`);
  for (const s of p.steps || []) {
    lines.push(`- [${s.status}] **${s.name}** ${s.detail ? `— ${s.detail}` : ""}`);
  }
  return lines.join("\n") + "\n";
}

async function main() {
  const argv = process.argv.slice(2);
  const args = parseArgs(argv);
  const timestamp = new Date().toISOString();

  const repo = ensureRepo(args.rootDir);
  if (!repo.ok) {
    console.error("FAIL: not a git repository at", args.rootDir);
    process.exit(2);
  }

  step("ensure-repo", "ok", args.rootDir);

  const state = gatherState(args);

  // Remote-url gate
  const expected = normalizeRemoteUrl(args.targetRemoteUrl);
  const actual = normalizeRemoteUrl(state.remoteUrl);
  if (expected && actual && expected !== actual) {
    step("remote-url-check", "fail", `${state.remoteUrl} ≠ ${args.targetRemoteUrl}`);
    const payload = {
      timestamp, execute: args.execute, outcome: "blocked-wrong-remote",
      state, steps: STEPS,
    };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else console.error(`FAIL: remote ${state.remoteUrl} does not match expected ${args.targetRemoteUrl}`);
    process.exit(3);
  }
  step("remote-url-check", "ok", state.remoteUrl);

  if (!state.currentBranch || state.currentBranch === "HEAD") {
    step("branch-check", "fail", "detached HEAD");
    const payload = { timestamp, execute: args.execute, outcome: "blocked-detached-head", state, steps: STEPS };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else console.error("FAIL: detached HEAD — checkout a branch first.");
    process.exit(4);
  }
  step("branch-check", "ok", state.currentBranch);

  // Fetch
  const fetchRes = git(["fetch", args.remoteName, "--prune"]);
  if (!fetchRes.ok) {
    step("fetch", "fail", fetchRes.stderr);
    const payload = { timestamp, execute: args.execute, outcome: "blocked-fetch-failed", state, steps: STEPS };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else console.error("FAIL: git fetch:", fetchRes.stderr);
    process.exit(5);
  }
  step("fetch", "ok", `${args.remoteName} --prune`);

  const targetRef = resolveTargetRef(args, state);
  const targetBranchName = targetRef.replace(`${args.remoteName}/`, "");
  const aheadBehind = computeAheadBehind(targetRef);
  const strategy = resolveStrategy(args, state, targetBranchName);

  step("inspect", "ok",
    `target=${targetRef} strategy=${strategy} ahead=${aheadBehind.ahead} behind=${aheadBehind.behind}`);

  // Already up to date
  if (aheadBehind.behind === 0) {
    step("pull", "skipped", "already up to date");
    const payload = {
      timestamp, execute: args.execute, outcome: "up-to-date",
      state, targetRef, strategy, aheadBehind, steps: STEPS,
    };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(`PASS: already up to date with ${targetRef}.`);
      if (aheadBehind.ahead > 0) console.log(`(local is ahead by ${aheadBehind.ahead} commit${aheadBehind.ahead === 1 ? "" : "s"} — push with /auto-hermes-push-main when ready)`);
    }
    return;
  }

  // Plan commits + files
  const fetchHead = gitOrEmpty(["rev-parse", targetRef]);
  const commitsPulled = commitsBeingPulled(targetRef);
  const filesChanged = filesChangedBetween(state.headSha, fetchHead);

  if (!args.execute) {
    step("pull", "dry-run", `would ${strategy} ${targetRef} into ${state.currentBranch}`);
    const payload = {
      timestamp, execute: false, outcome: "dry-run",
      state, targetRef, strategy, aheadBehind,
      commitsPulled, filesChanged,
      steps: STEPS,
    };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else {
      console.log(`DRY-RUN: ${state.currentBranch} is ${aheadBehind.behind} commit${aheadBehind.behind === 1 ? "" : "s"} behind ${targetRef}.`);
      console.log(`Strategy: ${strategy}`);
      if (commitsPulled.length) {
        console.log(`Commits to pull:`);
        for (const c of commitsPulled.slice(0, 10)) console.log(`  ${c.sha}  ${c.subject}  (${c.author})`);
        if (commitsPulled.length > 10) console.log(`  … and ${commitsPulled.length - 10} more`);
      }
      console.log(`Re-run with --execute to apply.`);
    }
    return;
  }

  // --- EXECUTE path ---

  // Auto-stash if dirty
  let stashed = false;
  let stashMsg = "";
  if (!state.cleanTree) {
    if (!args.autoStash) {
      step("stash", "fail", "uncommitted changes and --no-stash set");
      const payload = {
        timestamp, execute: true, outcome: "blocked-dirty-tree",
        state, targetRef, strategy, aheadBehind, steps: STEPS,
      };
      writeArtifact(args, payload);
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      else console.error("FAIL: working tree dirty and --no-stash set. Commit or stash first.");
      process.exit(6);
    }
    stashMsg = `auto-hermes-pull-main ${timestamp}`;
    const stashRes = git(["stash", "push", "-u", "-m", stashMsg]);
    if (!stashRes.ok) {
      step("stash", "fail", stashRes.stderr);
      const payload = {
        timestamp, execute: true, outcome: "blocked-stash-failed",
        state, targetRef, strategy, aheadBehind, steps: STEPS,
      };
      writeArtifact(args, payload);
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      else console.error("FAIL: git stash:", stashRes.stderr);
      process.exit(7);
    }
    stashed = true;
    step("stash", "ok", `pushed: ${stashMsg}`);
  }

  // Pull / merge / rebase
  let pullRes;
  if (strategy === "ff-only") {
    pullRes = git(["merge", "--ff-only", targetRef]);
  } else if (strategy === "rebase") {
    pullRes = git(["rebase", targetRef]);
  } else {
    pullRes = git(["merge", "--no-edit", targetRef]);
  }

  let conflicts = [];
  if (!pullRes.ok) {
    const conflictRes = git(["diff", "--name-only", "--diff-filter=U"]);
    if (conflictRes.ok && conflictRes.stdout) {
      conflicts = conflictRes.stdout.split("\n").filter(Boolean);
    }
    if (conflicts.length && !args.allowConflicts) {
      // Abort the merge/rebase and restore stash
      if (strategy === "rebase") git(["rebase", "--abort"]);
      else git(["merge", "--abort"]);
      step("pull", "aborted", `${conflicts.length} conflict(s) — aborted to keep tree clean`);
      if (stashed) {
        const popRes = git(["stash", "pop"]);
        step("stash-restore", popRes.ok ? "ok" : "fail", popRes.ok ? "" : popRes.stderr);
      }
      const payload = {
        timestamp, execute: true, outcome: "conflict-aborted",
        state, targetRef, strategy, aheadBehind, commitsPulled, filesChanged,
        conflicts, stashed, steps: STEPS,
      };
      writeArtifact(args, payload);
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      else {
        console.error(`FAIL: ${strategy} hit ${conflicts.length} conflict(s) — aborted.`);
        for (const c of conflicts) console.error(`  ${c}`);
        console.error(`Re-run with --allow-conflicts to leave the tree in the conflicted state.`);
      }
      process.exit(8);
    }
    if (conflicts.length && args.allowConflicts) {
      step("pull", "conflicted", `${conflicts.length} conflict(s) left for manual resolution`);
      const payload = {
        timestamp, execute: true, outcome: "conflict-manual",
        state, targetRef, strategy, aheadBehind, commitsPulled, filesChanged,
        conflicts, stashed, steps: STEPS,
      };
      writeArtifact(args, payload);
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      else {
        console.error(`PARTIAL: ${strategy} hit ${conflicts.length} conflict(s). Resolve, then:`);
        console.error(`  git add <files> && git ${strategy === "rebase" ? "rebase --continue" : "commit"}`);
        if (stashed) console.error(`  (your stash "${stashMsg}" is still on the stack — \`git stash pop\` after resolving)`);
      }
      process.exit(9);
    }
    // Some other error
    step("pull", "fail", pullRes.stderr);
    if (stashed) {
      const popRes = git(["stash", "pop"]);
      step("stash-restore", popRes.ok ? "ok" : "fail", popRes.ok ? "" : popRes.stderr);
    }
    const payload = {
      timestamp, execute: true, outcome: "pull-failed",
      state, targetRef, strategy, aheadBehind, steps: STEPS,
    };
    writeArtifact(args, payload);
    if (args.json) console.log(JSON.stringify(payload, null, 2));
    else console.error("FAIL:", pullRes.stderr);
    process.exit(10);
  }
  step("pull", "ok", `${strategy} ${targetRef} → ${state.currentBranch}`);

  // Restore stash
  if (stashed) {
    const popRes = git(["stash", "pop"]);
    if (!popRes.ok) {
      // Likely a conflict during pop
      const conflictRes = git(["diff", "--name-only", "--diff-filter=U"]);
      const stashConflicts = conflictRes.ok && conflictRes.stdout ? conflictRes.stdout.split("\n").filter(Boolean) : [];
      step("stash-restore", "conflicted", `${stashConflicts.length} conflict(s) restoring stash`);
      const payload = {
        timestamp, execute: true, outcome: "stash-restore-conflict",
        state, targetRef, strategy, aheadBehind, commitsPulled, filesChanged,
        conflicts: stashConflicts, stashed, steps: STEPS,
      };
      writeArtifact(args, payload);
      if (args.json) console.log(JSON.stringify(payload, null, 2));
      else {
        console.error(`PARTIAL: pulled successfully but \`git stash pop\` hit ${stashConflicts.length} conflict(s).`);
        for (const c of stashConflicts) console.error(`  ${c}`);
        console.error(`Resolve, then \`git add <files>\` and continue. Your stash entry is still on the stack.`);
      }
      process.exit(11);
    }
    step("stash-restore", "ok", "");
  }

  const newHead = gitOrEmpty(["rev-parse", "HEAD"]);
  const payload = {
    timestamp, execute: true, outcome: "pulled",
    state, targetRef, strategy, aheadBehind,
    commitsPulled, filesChanged,
    stashed,
    newHead,
    steps: STEPS,
  };
  writeArtifact(args, payload);
  if (args.json) console.log(JSON.stringify(payload, null, 2));
  else {
    console.log(`PASS: ${state.currentBranch} ${strategy === "ff-only" ? "fast-forwarded" : strategy + "d"} ${aheadBehind.behind} commit${aheadBehind.behind === 1 ? "" : "s"} from ${targetRef}.`);
    console.log(`  HEAD: ${state.headSha.slice(0, 8)} → ${newHead.slice(0, 8)}`);
    if (filesChanged.length) console.log(`  Files changed: ${filesChanged.length}`);
    if (stashed) console.log(`  Stash auto-restored.`);
  }
}

main().catch((err) => {
  console.error("FATAL:", err?.message || err);
  process.exit(99);
});
