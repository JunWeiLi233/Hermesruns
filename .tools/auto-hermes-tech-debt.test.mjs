import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-tech-debt-"));
  const write = (relPath, content) => {
    const target = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  write("TASKS.md", `# Hermes Tasks

## Active Tasks

## Blocked Tasks

## Suggested Next Tasks

## Tech Debt Tasks
### Frontend Debt
### Backend Debt
### Docs / Automation Debt

## Daily Log
`);

  const bigFrontendBody = Array.from({ length: 760 }, (_, index) => `  const section${index} = "segment-${index}";`).join("\n");
  write("frontend/src/pages/MassiveDashboard.jsx", `export default function MassiveDashboard() {
${bigFrontendBody}
  return <main>{section0}</main>;
}
`);

  const raceDetailBody = Array.from({ length: 860 }, (_, index) => `  const lane${index} = "route-${index}";`).join("\n");
  write("frontend/src/pages/RacesDetail.jsx", `import L from "leaflet";

export default function RacesDetail() {
${raceDetailBody}
  return <div>{lane0}</div>;
}
`);

  write("backend/src/main/java/com/hermes/backend/service/AiUsageService.java", `package com.hermes.backend.service;

public class AiUsageService {
  public boolean tryConsumeQuota(int remainingQuota, int requestedAmount) {
    if (requestedAmount <= 0) {
      return false;
    }
    return remainingQuota >= requestedAmount;
  }
}
`);

  write(".tools/queue-audit.mjs", `function scoreQueueActivity(taskCount) {
  return taskCount > 0;
}

function formatQueueStatus(active) {
  return active ? "active" : "empty";
}

export function runQueueAudit(taskCount) {
  return formatQueueStatus(scoreQueueActivity(taskCount));
}
`);

  return { dir };
}

function check(name, fn) {
  Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`PASS ${name}`);
    })
    .catch((error) => {
      console.error(`FAIL ${name}`);
      console.error(error instanceof Error ? error.stack : error);
      process.exitCode = 1;
    });
}

const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-tech-debt.mjs")).href;

check("collects bounded candidates across frontend, backend, and docs/automation slices", async () => {
  const { runAutoHermesTechDebt } = await import(moduleUrl);
  const fixture = makeFixture();

  const { report } = runAutoHermesTechDebt({
    rootDir: fixture.dir,
    write: false,
    maxTasks: 5,
    commandName: "auto-hermes-tech-debt",
  });

  assert.equal(report.commandName, "auto-hermes-tech-debt");
  assert.ok(report.candidates.some((candidate) => candidate.kind === "oversized-file" && candidate.category === "Frontend Debt"));
  assert.ok(report.candidates.some((candidate) => candidate.kind === "missing-focused-tests" && candidate.category === "Backend Debt"));
  assert.ok(report.candidates.some((candidate) => candidate.kind === "missing-focused-tests" && candidate.category === "Docs / Automation Debt"));
  assert.ok(report.selectedTasks.length >= 3);
  assert.equal(
    report.candidates.some((candidate) => candidate.id === "frontend/src/pages/RacesDetail.jsx:oversized-file"),
    false,
    "RacesDetail.jsx should not be re-queued as a generic oversized-file tech-debt task because the race map surface is workflow-protected.",
  );
});

check("writeback inserts step-by-step tasks into TASKS.md and skips duplicates on rerun", async () => {
  const { runAutoHermesTechDebt } = await import(moduleUrl);
  const fixture = makeFixture();

  const firstRun = runAutoHermesTechDebt({
    rootDir: fixture.dir,
    write: true,
    maxTasks: 5,
    commandName: "auto-hermes-tech-debt",
  });

  assert.ok(firstRun.report.taskWriteback.ids.length >= 3);

  const tasksContent = fs.readFileSync(path.join(fixture.dir, "TASKS.md"), "utf8");
  assert.match(tasksContent, /### Frontend Debt[\s\S]*MassiveDashboard\.jsx/);
  assert.match(tasksContent, /### Backend Debt[\s\S]*AiUsageService/);
  assert.match(tasksContent, /### Docs \/ Automation Debt[\s\S]*queue-audit\.mjs/);
  assert.match(tasksContent, /Steps:\s*\n\s*1\./);
  assert.match(tasksContent, /Done when:/);
  assert.match(tasksContent, /Verify:/);

  const secondRun = runAutoHermesTechDebt({
    rootDir: fixture.dir,
    write: true,
    maxTasks: 5,
    commandName: "auto-hermes-tech-debt",
  });

  assert.equal(secondRun.report.taskWriteback.ids.length, 0);
});

check("runtime adapters, plugin wiring, and installer wiring expose auto-hermes-tech-debt", async () => {
  const requiredFiles = [
    ".codex/commands/auto-hermes-tech-debt.md",
    ".claude/commands/auto-hermes-tech-debt.md",
    ".opencode/commands/auto-hermes-tech-debt.md",
    ".gemini/commands/auto-hermes-tech-debt.toml",
    ".codex/workflows/auto-hermes-tech-debt-contract.md",
  ];

  for (const relPath of requiredFiles) {
    assert.equal(fs.existsSync(path.resolve(relPath)), true, `${relPath} should exist`);
  }

  const opencodePlugin = fs.readFileSync(path.resolve(".opencode/hermes-plugin.ts"), "utf8");
  const installer = fs.readFileSync(path.resolve(".tools/install-hermes-codex-commands.ps1"), "utf8");
  const antigravity = fs.readFileSync(path.resolve(".claude/agents/antigravity.md"), "utf8");

  assert.match(opencodePlugin, /auto-hermes-tech-debt/);
  assert.match(installer, /auto-hermes\*\.md/);
  assert.match(installer, /\.codex\\commands/);
  assert.doesNotMatch(installer, /sourcePluginDir/);
  assert.doesNotMatch(installer, /\.codex-plugin/);
  assert.match(antigravity, /auto-hermes-tech-debt/i);
});
