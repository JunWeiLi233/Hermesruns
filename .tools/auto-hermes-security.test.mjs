import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "auto-hermes-security-"));
  const write = (relPath, content) => {
    const target = path.join(dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
    return target;
  };

  write("TASKS.md", `# Hermes Tasks

## Active Tasks

## Tech Debt Tasks

## Suggested Next Tasks
`);

  write("backend/src/main/java/com/hermes/backend/Runner.java", `package com.hermes.backend;

import jakarta.persistence.Entity;
import jakarta.persistence.Table;

@Entity
@Table(name = "runner")
public class Runner {}
`);

  write("backend/src/main/java/com/hermes/backend/RunnerController.java", `package com.hermes.backend;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/runners")
public class RunnerController {
  @GetMapping
  public String list() {
    return "ok";
  }
}
`);

  write("backend/src/main/java/com/hermes/backend/DangerousQueryService.java", `package com.hermes.backend;

public class DangerousQueryService {
  public String build(String email) {
    return "select * from runner where email = '" + email + "'";
  }
}
`);

  write("backend/src/main/java/com/hermes/backend/SecurityHeadersFilter.java", `package com.hermes.backend;

public class SecurityHeadersFilter {
  public void apply(jakarta.servlet.http.HttpServletResponse response) {
    response.setHeader("X-Frame-Options", "DENY");
  }
}
`);

  write("frontend/src/pages/Login.jsx", `export default function Login() {
  async function submit(event) {
    event.preventDefault();
    await fetch('/api/auth/login', { method: 'POST' });
  }

  return (
    <form onSubmit={submit}>
      <input type="email" name="email" />
      <input type="password" name="password" />
      <button type="submit">Login</button>
    </form>
  );
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

const moduleUrl = pathToFileURL(path.resolve(".tools/auto-hermes-security.mjs")).href;

check("audit mode discovers repo targets and writes markdown/json reports", async () => {
  const { runAutoHermesSecurity } = await import(moduleUrl);
  const fixture = makeFixture();

  const { report } = await runAutoHermesSecurity({
    rootDir: fixture.dir,
    mode: "audit",
    commandName: "auto-hermes-security",
    write: true,
    outputDir: ".ai-sync/security-reports",
    tasks: "TASKS.md",
  });

  assert.equal(report.commandName, "auto-hermes-security");
  assert.equal(report.mode, "audit");
  assert.ok(report.inventory.tables.some((table) => table.name === "runner"));
  assert.ok(report.inventory.endpoints.some((endpoint) => endpoint.path === "/api/runners"));
  assert.ok(report.inventory.forms.some((form) => form.file.endsWith("frontend/src/pages/Login.jsx")));
  assert.ok(report.findings.some((finding) => finding.checker === "injection-hunter"));
  assert.equal(fs.existsSync(path.join(fixture.dir, ".ai-sync/security-reports", `${report.runId}.md`)), true);
  assert.equal(fs.existsSync(path.join(fixture.dir, ".ai-sync/security-reports", `${report.runId}.json`)), true);
});

check("attack mode blocks non-local targets before running active probes", async () => {
  const { runAutoHermesSecurity } = await import(moduleUrl);
  const fixture = makeFixture();

  const { report } = await runAutoHermesSecurity({
    rootDir: fixture.dir,
    mode: "attack",
    commandName: "auto-hermes-attack",
    runtimeBaseUrl: "https://staging.hermes.example",
    write: false,
    outputDir: ".ai-sync/security-reports",
    tasks: "TASKS.md",
  });

  assert.equal(report.status, "blocked");
  assert.match(report.summary, /local\/dev/i);
});

check("writeback gate only promotes verified HIGH/CRITICAL findings", async () => {
  const { shouldWriteFindingToTasks } = await import(moduleUrl);

  assert.equal(
    shouldWriteFindingToTasks({
      severity: "HIGH",
      verification: "runtime-verified",
      duplicate: false,
    }),
    true,
  );

  assert.equal(
    shouldWriteFindingToTasks({
      severity: "MEDIUM",
      verification: "runtime-verified",
      duplicate: false,
    }),
    false,
  );

  assert.equal(
    shouldWriteFindingToTasks({
      severity: "CRITICAL",
      verification: "static-only",
      duplicate: false,
    }),
    false,
  );
});

check("secret scan skips local artifacts but still scans source files", async () => {
  const { runAutoHermesSecurity } = await import(moduleUrl);
  const fixture = makeFixture();
  const write = (relPath, content) => {
    const target = path.join(fixture.dir, relPath);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content, "utf8");
  };

  write(".ai-sync/AGENT_SYNC.md", "Junwei local state with sk-" + "a".repeat(40));
  write(".claude/worktrees/agent-a/frontend/node_modules/pkg/index.js", "const token = 'sk-" + "b".repeat(40) + "';");
  write("backend/src/main/resources/static/assets/index-generated.js", "const token = 'sk-" + "c".repeat(40) + "';");
  write("frontend/src/sourceLeak.js", "const token = 'sk-" + "d".repeat(40) + "';");

  const { report } = await runAutoHermesSecurity({
    rootDir: fixture.dir,
    mode: "audit",
    commandName: "auto-hermes-security",
    write: false,
    outputDir: ".ai-sync/security-reports",
    tasks: "TASKS.md",
  });

  const secretFindings = report.findings.filter((finding) => finding.checker === "secret-pii-hunter");
  assert.equal(secretFindings.some((finding) => finding.file.startsWith(".ai-sync/")), false);
  assert.equal(secretFindings.some((finding) => finding.file.startsWith(".claude/worktrees/")), false);
  assert.equal(secretFindings.some((finding) => finding.file.startsWith("backend/src/main/resources/static/")), false);
  assert.equal(secretFindings.some((finding) => finding.file === "frontend/src/sourceLeak.js"), true);
});

check("auth prober accepts controllers that read Authorization from HttpServletRequest", async () => {
  const { runAutoHermesSecurity } = await import(moduleUrl);
  const fixture = makeFixture();
  const target = path.join(fixture.dir, "backend/src/main/java/com/hermes/backend/RequestAuthController.java");
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, `package com.hermes.backend;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/request-auth")
public class RequestAuthController {
  @GetMapping
  public String show(HttpServletRequest request) {
    return request.getHeader("Authorization");
  }
}
`, "utf8");

  const { report } = await runAutoHermesSecurity({
    rootDir: fixture.dir,
    mode: "audit",
    commandName: "auto-hermes-security",
    write: false,
    outputDir: ".ai-sync/security-reports",
    tasks: "TASKS.md",
  });

  const authFindings = report.findings.filter((finding) => finding.checker === "auth-bypass-prober");
  assert.equal(authFindings.some((finding) => finding.target.includes("/api/request-auth")), false);
});

check("command surfaces and installer wiring include the security commands", async () => {
  const installer = fs.readFileSync(path.resolve(".tools/install-hermes-codex-commands.ps1"), "utf8");

  assert.match(installer, /\.codex\\commands/);
  assert.match(installer, /auto-hermes\*\.md/);
  assert.equal(fs.existsSync(path.resolve(".codex/commands/auto-hermes-security.md")), true);
  assert.equal(fs.existsSync(path.resolve(".codex/commands/auto-hermes-attack.md")), true);
  assert.doesNotMatch(installer, /sourcePluginDir/);
  assert.doesNotMatch(installer, /\.codex-plugin/);
});
