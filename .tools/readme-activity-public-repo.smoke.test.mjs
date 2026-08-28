import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relativePath) => fs.readFileSync(path.join(ROOT, relativePath), "utf8");
const readme = read("README.md");
const generator = read(".tools/update-readme-activity.mjs");
const workflow = read(".github/workflows/update-readme-activity.yml");

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
assert.doesNotMatch(
  workflow,
  /\n\s+push:\s*\n\s+branches:/,
  "The activity workflow must not run after every protected-main push.",
);
assert.match(
  workflow,
  /ACTIVITY_BRANCH:\s*automation\/readme-activity/,
  "Generated activity graphs must be published to a review branch.",
);
assert.match(
  workflow,
  /git push --force-with-lease origin "HEAD:refs\/heads\/\$ACTIVITY_BRANCH"/,
  "The workflow must update the review branch instead of pushing to main.",
);
assert.match(
  workflow,
  /git commit --author="JunWeiLi233 <70492516\+JunWeiLi233@users\.noreply\.github\.com>" -m "docs: refresh readme activity graph"/,
  "Automated graph commits must retain the approved repository-owner author identity.",
);
assert.doesNotMatch(
  workflow,
  /^\s*git push\s*$/m,
  "The workflow must not use a bare push that targets protected main.",
);

console.log("[PASS] README activity chart targets the public repository and current branch.");
