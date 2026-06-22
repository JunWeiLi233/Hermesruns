import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { runAutoHermesFinish } from "./auto-hermes-finish.mjs";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-finish-"));
  fs.mkdirSync(path.join(dir, ".ai-sync"), { recursive: true });
  return dir;
}

{
  const finish = runAutoHermesFinish({
    json: true,
    task: "runtime sync helper",
    surface: "Runner shell",
    summary: "include shared runtime sync verifier",
    gitRunner: (args) => {
      const key = args.join(" ");
      if (key === "status --short --untracked-files=all") {
        return [
          "?? .tools/verify-frontend-runtime-sync.mjs",
          "?? .tools/verify-backend-runtime-sync.mjs",
        ].join("\n");
      }
      if (key === "branch --show-current") return "codex/test-runtime-sync-helper";
      return "";
    },
  }).result;

  [
    ".tools/verify-frontend-runtime-sync.mjs",
    ".tools/verify-backend-runtime-sync.mjs",
  ].forEach((file) => {
    assert.equal(finish.files.includes(file), true);
    assert.equal(
      finish.policies.find((policy) => policy.path === file)?.bucket,
      "publishable",
    );
  });
}

{
  const fixture = makeFixture();
  fs.writeFileSync(path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    passed: true,
    gitHead: "",
    statusSnapshot: "",
    command: "mock-pass",
    reason: "mock pass",
    output: "ok",
  }, null, 2));

  const finish = runAutoHermesFinish({
    json: true,
    task: "publishable round",
    surface: "Runner Profile",
    summary: "ready to publish",
    files: "frontend/src/pages/ProfileDashboard.jsx",
    push: true,
    dockerGateJson: path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"),
    dockerGateMd: path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.md"),
    dockerGateSkipRepoCheck: true,
  }).result;

  assert.equal(finish.eligible, true);
  assert.match(finish.command, /-Push/);
}

{
  const finish = runAutoHermesFinish({
    json: true,
    task: "true clean stop",
    surface: "auto-hermes-max",
    summary: "clean stop left unpublished local commits",
    push: true,
    autoPushWhenNeeded: true,
    remoteStatusOverride: {
      remoteName: "origin",
      targetUrl: "https://github.com/520HXC/run.git",
      actualUrl: "https://github.com/520HXC/run.git",
      matchesTarget: true,
      reason: "Git remote 'origin' matches the expected publish target.",
    },
    dockerGateStatusOverride: {
      path: ".ai-sync/AUTO_HERMES_DOCKER_GATE.json",
      present: true,
      passed: true,
      fresh: true,
      reason: "Docker gate artifact matches the current working tree.",
      artifact: {
        passed: true,
      },
    },
    gitRunner: (args) => {
      const key = args.join(" ");
      if (key === "status --short --untracked-files=all") return "";
      if (key === "branch --show-current") return "codex/test-clean-stop";
      if (key === "rev-parse --verify refs/remotes/origin/codex/test-clean-stop") return "abc123";
      if (key === "rev-list --count refs/remotes/origin/codex/test-clean-stop..HEAD") return "2";
      if (key === "rev-list --count HEAD..refs/remotes/origin/codex/test-clean-stop") return "0";
      throw new Error(`Unexpected git command: ${key}`);
    },
    pushExecutor: ({ branch }) => `Pushed branch: ${branch}`,
  }).result;

  assert.equal(finish.files.length, 0);
  assert.equal(finish.commitNeeded, false);
  assert.equal(finish.pushNeeded, true);
  assert.equal(finish.eligible, true);
  assert.equal(finish.branchPublishStatus.branch, "codex/test-clean-stop");
  assert.equal(finish.branchPublishStatus.hasUnpublishedCommits, true);
  assert.match(finish.command, /git push origin codex\/test-clean-stop/);
  assert.match(finish.reason, /unpublished local commits/i);
}

{
  let commitCalls = 0;
  const pushCalls = [];

  const finish = runAutoHermesFinish({
    json: true,
    commit: true,
    push: true,
    autoPushWhenNeeded: true,
    task: "true clean stop",
    surface: "auto-hermes-max",
    summary: "clean stop left unpublished local commits",
    remoteStatusOverride: {
      remoteName: "origin",
      targetUrl: "https://github.com/520HXC/run.git",
      actualUrl: "https://github.com/520HXC/run.git",
      matchesTarget: true,
      reason: "Git remote 'origin' matches the expected publish target.",
    },
    dockerGateStatusOverride: {
      path: ".ai-sync/AUTO_HERMES_DOCKER_GATE.json",
      present: true,
      passed: true,
      fresh: true,
      reason: "Docker gate artifact matches the current working tree.",
      artifact: {
        passed: true,
      },
    },
    gitRunner: (args) => {
      const key = args.join(" ");
      if (key === "status --short --untracked-files=all") return "";
      if (key === "branch --show-current") return "codex/test-clean-stop";
      if (key === "rev-parse --verify refs/remotes/origin/codex/test-clean-stop") return "abc123";
      if (key === "rev-list --count refs/remotes/origin/codex/test-clean-stop..HEAD") return "2";
      if (key === "rev-list --count HEAD..refs/remotes/origin/codex/test-clean-stop") return "0";
      return "";
    },
    commitExecutor: () => {
      commitCalls += 1;
      return "unexpected commit";
    },
    pushExecutor: ({ remoteName, branch }) => {
      pushCalls.push([remoteName, branch]);
      return `Pushed branch: ${branch}`;
    },
  }).result;

  assert.equal(commitCalls, 0);
  assert.deepEqual(pushCalls, [["origin", "codex/test-clean-stop"]]);
  assert.equal(finish.pushResult, "Pushed branch: codex/test-clean-stop");
  assert.equal(finish.commitResult, "");
}

{
  const fixture = makeFixture();
  fs.writeFileSync(path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"), JSON.stringify({
    generatedAt: new Date().toISOString(),
    passed: false,
    gitHead: "",
    statusSnapshot: "",
    command: "mock-fail",
    reason: "mock fail",
    output: "fail",
  }, null, 2));

  const finish = runAutoHermesFinish({
    json: true,
    task: "publishable round",
    surface: "Runner Profile",
    summary: "ready to publish",
    files: "frontend/src/pages/ProfileDashboard.jsx",
    push: true,
    dockerGateJson: path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.json"),
    dockerGateMd: path.join(fixture, ".ai-sync", "AUTO_HERMES_DOCKER_GATE.md"),
    dockerGateSkipRepoCheck: true,
  }).result;

  assert.equal(finish.eligible, false);
  assert.match(finish.reason, /Docker publish gate/i);
}

console.log("PASS auto-hermes-finish");
