import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const wrapperPath = path.resolve("backend/mvnw.cmd");
const wrapper = fs.readFileSync(wrapperPath, "utf8");

assert.doesNotMatch(
  wrapper,
  /\(Get-Item \$MAVEN_M2_PATH\)\.Target\[0\]/,
  "Windows Maven wrapper must not index a null directory junction target.",
);
assert.match(
  wrapper,
  /\$MAVEN_M2_TARGET\s*=\s*\(Get-Item \$MAVEN_M2_PATH\)\.Target/,
  "Windows Maven wrapper should normalize the optional directory junction target before use.",
);
assert.match(
  wrapper,
  /\$MAVEN_M2_TARGET\s*=\s*@\(\$MAVEN_M2_TARGET\)\s*\|\s*Select-Object -First 1/,
  "Windows Maven wrapper must normalize both scalar and array junction targets safely.",
);
assert.match(
  wrapper,
  /if \(-not \$MAVEN_M2_TARGET\)\s*\{\s*\$MAVEN_WRAPPER_DISTS = "\$MAVEN_M2_PATH\/wrapper\/dists"\s*\}\s*else\s*\{\s*\$MAVEN_WRAPPER_DISTS = \$MAVEN_M2_TARGET \+ "\/wrapper\/dists"/,
  "Missing targets must use the ordinary directory; junctions must use the resolved target.",
);

console.log("PASS Windows Maven wrapper handles ordinary directories without null indexing");
