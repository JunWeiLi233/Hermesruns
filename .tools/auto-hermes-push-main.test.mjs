import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { HERMES_REPOSITORY, HERMES_REPOSITORY_URL } from "./hermes-repository.mjs";

const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-push-main.mjs")).href;
const {
  buildAutoHermesPushMainPlan,
  isPublishBlockingFinding,
  loadDryRunGitMetadata,
  runAutoHermesPushMain,
} = await import(moduleUrl);

const normalizeRemoteUrlForTest = (value) => String(value || "")
  .trim()
  .replace(/\\/g, "/")
  .replace(/\.git$/i, "")
  .replace(/\/+$/g, "")
  .toLowerCase();

{
  const metadata = loadDryRunGitMetadata(process.cwd(), "origin");
  assert.equal(normalizeRemoteUrlForTest(metadata.remoteUrl), normalizeRemoteUrlForTest(HERMES_REPOSITORY_URL));
  assert.equal(typeof metadata.sourceBranch, "string");
  assert.match(metadata.sourceHead, /^[0-9a-f]{40}$/);
}

{
  const plan = buildAutoHermesPushMainPlan({
    sourceRef: "HEAD",
    remoteName: "origin",
    targetRemoteUrl: HERMES_REPOSITORY_URL,
    expectedUserName: "runner-bot",
    expectedUserEmail: "runner-bot@example.invalid",
    targetBranch: "main",
    backupBranch: "save-old-version",
    message: "publish profile cleanup",
  });

  const commandText = plan.steps.map((step) => step.command || step.description).join("\n");
  assert.match(commandText, /refresh-architecture-diagrams\.mjs --write --force/);
  assert.match(commandText, /auto-hermes-security\.mjs --mode audit --write --json/);
  assert.match(commandText, /auto-commit\.ps1 -Message "publish profile cleanup"/);
  assert.match(commandText, /git branch --show-current/);
  assert.match(commandText, /git fetch origin main/);
  assert.match(commandText, /git push origin HEAD/);
  assert.match(commandText, new RegExp(`gh pr create --repo ${HERMES_REPOSITORY} --base main`));
  assert.doesNotMatch(commandText, /git checkout -B save-old-version/);
  assert.doesNotMatch(commandText, /git reset --hard/);
  assert.doesNotMatch(commandText, /git cherry-pick/);
  assert.doesNotMatch(commandText, /git push origin main/);
}

{
  const plan = buildAutoHermesPushMainPlan({ draft: true, targetBranch: "main" });
  const commandText = plan.steps.map((step) => step.command || step.description).join("\n");
  assert.match(commandText, new RegExp(`gh pr create --repo ${HERMES_REPOSITORY} --base main --head \\$\\(git branch --show-current\\) --draft`));
}

{
  assert.equal(isPublishBlockingFinding({ severity: "CRITICAL", checker: "secret-and-pii-hunter" }), true);
  assert.equal(isPublishBlockingFinding({ severity: "HIGH", checker: "secret-and-pii-hunter" }), true);
  assert.equal(isPublishBlockingFinding({ severity: "HIGH", checker: "active-data-leak" }), true);
  assert.equal(isPublishBlockingFinding({ severity: "MEDIUM", checker: "secret-and-pii-hunter" }), false);
  assert.equal(isPublishBlockingFinding({ severity: "MEDIUM", checker: "pii-leak-hunter" }), false);
  assert.equal(isPublishBlockingFinding({ severity: "HIGH", checker: "rate-limit" }), false);
}

{
  assert.equal(fs.existsSync(path.resolve(".codex/commands/auto-hermes-push-main.md")), true);
  assert.equal(fs.existsSync(path.resolve(".github/prompts/auto-hermes-push-main.prompt.md")), true);
  const githubPrompt = fs.readFileSync(path.resolve(".github/prompts/auto-hermes-push-main.prompt.md"), "utf8");
  assert.match(githubPrompt, /pull request into `main`/i);
  assert.doesNotMatch(githubPrompt, /cherry-pick current change/i);
  assert.doesNotMatch(githubPrompt, /save-old-version/i);
  assert.doesNotMatch(githubPrompt, /pushing the new `main`/i);
  const localCommitPolicy = fs.readFileSync(path.resolve(".tools/auto-commit.ps1"), "utf8");
  assert.match(localCommitPolicy, /https:\/\/github\.com\/JunWeiLi233\/Hermesruns\.git/);
  assert.match(localCommitPolicy, /\.railway\//);
  assert.match(fs.readFileSync(path.resolve(".tools/auto-hermes-finish.mjs"), "utf8"), /auto-hermes-push-main\\\.\(mjs\|test\\\.mjs\)/);
}

{
  const commands = [];
  const { result } = await runAutoHermesPushMain({
    rootDir: process.cwd(),
    execute: true,
    skipChecks: true,
    runCommand: (command, args) => {
      commands.push([command, ...args].join(" "));
      if (command === "git" && args.join(" ") === "config --get remote.origin.url") {
        return "https://github.com/not-the-repo/run.git";
      }
      if (command === "git" && args.join(" ") === "rev-parse --is-inside-work-tree") {
        return "true";
      }
      if (command === "git" && args.join(" ") === "branch --show-current") {
        return "feature";
      }
      if (command === "git" && args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      if (command === "git" && args.join(" ") === "status --short --untracked-files=all") {
        return "";
      }
      return "";
    },
  });

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /remote.*does not match/i);
  assert.ok(!commands.some((command) => /push origin main/.test(command)));
}

{
  const commands = [];
  const { result } = await runAutoHermesPushMain({
    rootDir: process.cwd(),
    execute: true,
    skipChecks: true,
    runCommand: (command, args) => {
      commands.push([command, ...args].join(" "));
      if (command === "git" && args.join(" ") === "config --get remote.origin.url") {
        return HERMES_REPOSITORY_URL;
      }
      if (command === "git" && args.join(" ") === "rev-parse --is-inside-work-tree") {
        return "true";
      }
      if (command === "git" && args.join(" ") === "branch --show-current") {
        return "main";
      }
      if (command === "git" && args.join(" ") === "rev-parse HEAD") {
        return "abc123";
      }
      if (command === "git" && args.join(" ") === "config user.name") {
        return "runner-bot";
      }
      if (command === "git" && args.join(" ") === "config user.email") {
        return "runner-bot@example.invalid";
      }
      return "";
    },
  });

  assert.equal(result.status, "blocked");
  assert.match(result.reason, /Cannot create a PR from main into itself/i);
  assert.ok(!commands.some((command) => /auto-commit|push origin|gh pr create/.test(command)));
}

{
  const commands = [];
  const { result } = await runAutoHermesPushMain({
    rootDir: process.cwd(),
    execute: true,
    skipChecks: true,
    runCommand: (command, args) => {
      const invocation = [command, ...args].join(" ");
      commands.push(invocation);
      const key = args.join(" ");
      if (command === "git" && key === "rev-parse --is-inside-work-tree") return "true";
      if (command === "git" && key === "config --get remote.origin.url") return HERMES_REPOSITORY_URL;
      if (command === "git" && key === "branch --show-current") return "feature";
      if (command === "git" && key === "rev-parse HEAD") return "abc123";
      if (command === "git" && key === "status --short --untracked-files=all") return "";
      if (command === "gh" && args[0] === "pr" && args[1] === "create") return "https://github.com/JunWeiLi233/Hermesruns/pull/1";
      return "";
    },
  });

  assert.equal(result.status, "completed");
  assert.ok(commands.some((command) => command.includes(`gh pr create --repo ${HERMES_REPOSITORY} --base main --head feature`)));
}

console.log("PASS auto-hermes-push-main");
{
  const launcher = fs.readFileSync(path.resolve("start_hermes.bat"), "utf8");
  const noListenerStart = launcher.indexOf('"if ($listenerPids.Count -eq 0) {"');
  const liveListenerStart = launcher.indexOf('"$owner = $null;"', noListenerStart);
  assert.notEqual(noListenerStart, -1, "start_hermes.bat should expose a no-listener runtime-marker branch");
  assert.notEqual(liveListenerStart, -1, "start_hermes.bat should keep a live-listener ownership branch");
  const noListenerBranch = launcher.slice(noListenerStart, liveListenerStart);
  assert.match(
    noListenerBranch,
    /Remove-Item \$marker -Force -ErrorAction SilentlyContinue/,
    "a stale marker should be removed when port 8080 is free",
  );
  assert.doesNotMatch(noListenerBranch, /exit 3/, "a free port must not be blocked by a stale marker");
  assert.doesNotMatch(launcher, /if errorlevel 3 goto :guard_stale_marker/);
  assert.match(launcher, /if \(\$owner\)[\s\S]*exit 2/, "live foreign listeners stay protected");
  assert.match(launcher, /if errorlevel 2 goto :guard_cross_tree/);
}
