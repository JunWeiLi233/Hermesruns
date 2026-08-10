import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const readme = read("README.md");
const generator = read(".tools/update-readme-activity.mjs");

assert.match(
  readme,
  /\[!\[Hermes GitHub commit activity\]\(docs\/github-commit-activity\.svg\)\]\(https:\/\/github\.com\/JunWeiLi233\/Hermesruns\/graphs\/commit-activity\)/,
  "The README activity diagram must open the public Hermesruns commit history.",
);
assert.match(
  generator,
  /"log",\s*\/\/[^\n]*\n\s*\/\/[^\n]*\n\s*"HEAD"/,
  "The activity generator must count the checked-out repository branch.",
);
assert.doesNotMatch(
  generator,
  /"--all"/,
  "The activity generator must not include unrelated remote-tracking refs.",
);

console.log("[PASS] README activity chart targets the public repository and current branch.");
