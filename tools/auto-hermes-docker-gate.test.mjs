import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const gatePath = path.join(here, "auto-hermes-docker-gate.mjs");

assert.throws(
  () => execFileSync(process.execPath, [gatePath, "--command", "exit /b 1"], { encoding: "utf8" }),
  (error) => error.status !== 0,
  "Docker gate must exit non-zero when the Docker command fails",
);

console.log("PASS Docker gate propagates failed build status");
