import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

function makeFixture() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "install-hermes-codex-commands-"));
  const codexHome = path.join(dir, ".codex-home");
  fs.mkdirSync(codexHome, { recursive: true });
  fs.writeFileSync(
    path.join(codexHome, "config.toml"),
    [
      'model = "gpt-5.4"',
      "",
      '[plugins."github@openai-curated"]',
      "enabled = true",
      "",
      '[plugins."hermes-workflows@local"]',
      "enabled = true",
      "",
    ].join("\r\n"),
    "utf8",
  );
  fs.mkdirSync(path.join(codexHome, ".tmp", "plugins", ".agents", "plugins"), { recursive: true });
  fs.writeFileSync(
    path.join(codexHome, ".tmp", "plugins", ".agents", "plugins", "marketplace.json"),
    JSON.stringify({
      plugins: [
        {
          name: "hermes-workflows",
          source: { source: "local", path: "./plugins/hermes-workflows" },
        },
      ],
    }, null, 2),
    "utf8",
  );
  fs.mkdirSync(path.join(codexHome, "plugins", "cache", "local", "hermes-workflows", "1.0.0"), { recursive: true });
  fs.mkdirSync(path.join(codexHome, ".tmp", "plugins", "plugins", "hermes-workflows"), { recursive: true });
  return { dir, codexHome };
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

check("installer only syncs ~/.codex/commands and does not wire the deprecated plugin path", async () => {
  const fixture = makeFixture();
  const installerPath = path.resolve(".tools/install-hermes-codex-commands.ps1");

  execFileSync(
    "powershell",
    [
      "-NoProfile",
      "-ExecutionPolicy",
      "Bypass",
      "-File",
      installerPath,
      "-WindowsCodexHome",
      fixture.codexHome,
      "-SkipWsl",
    ],
    {
      cwd: path.resolve("."),
      stdio: "pipe",
      encoding: "utf8",
    },
  );

  assert.equal(fs.existsSync(path.join(fixture.codexHome, "commands", "auto-hermes.md")), true);
  assert.equal(fs.existsSync(path.join(fixture.codexHome, "commands", "auto-hermes-max.md")), true);
  assert.equal(fs.existsSync(path.join(fixture.codexHome, "plugins", "cache", "local", "hermes-workflows")), false);
  assert.equal(fs.existsSync(path.join(fixture.codexHome, ".tmp", "plugins", "plugins", "hermes-workflows")), false);

  const config = fs.readFileSync(path.join(fixture.codexHome, "config.toml"), "utf8");
  const marketplace = fs.readFileSync(
    path.join(fixture.codexHome, ".tmp", "plugins", ".agents", "plugins", "marketplace.json"),
    "utf8",
  );

  assert.doesNotMatch(config, /hermes-workflows@local/);
  assert.doesNotMatch(marketplace, /hermes-workflows/);
});
