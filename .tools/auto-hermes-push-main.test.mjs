import assert from "node:assert/strict";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import path from "node:path";

const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-push-main.mjs")).href;
const {
  buildAutoHermesPushMainPlan,
  isPublishBlockingFinding,
  runAutoHermesPushMain,
} = await import(moduleUrl);

{
  const plan = buildAutoHermesPushMainPlan({
    sourceRef: "HEAD",
    remoteName: "origin",
    targetRemoteUrl: "https://github.com/520HXC/run.git",
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
  assert.match(commandText, /gh pr create --base main/);
  assert.doesNotMatch(commandText, /git checkout -B save-old-version/);
  assert.doesNotMatch(commandText, /git reset --hard/);
  assert.doesNotMatch(commandText, /git cherry-pick/);
  assert.doesNotMatch(commandText, /git push origin main/);
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
  assert.match(fs.readFileSync(path.resolve(".tools/auto-commit.ps1"), "utf8"), /auto-hermes-push-main\\\.\(mjs\|test\\\.mjs\)/);
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
        return "https://github.com/520HXC/run.git";
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

console.log("PASS auto-hermes-push-main");
