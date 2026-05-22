import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const removeBackground = fs.readFileSync(path.resolve("frontend/src/utils/removeBackground.js"), "utf8");
const shoeImageController = fs.readFileSync(path.resolve("backend/src/main/java/com/hermes/backend/ShoeImageController.java"), "utf8");

assert.match(
  removeBackground,
  /apiFetch\('\/api\/shoes\/render-source',\s*\{\s*method:\s*'POST'/s,
  "removeBackground should proxy remote images through a POST render-source request instead of a fragile GET query call.",
);

assert.match(
  shoeImageController,
  /@PostMapping\("\/render-source"\)/,
  "ShoeImageController should expose a POST /api/shoes/render-source endpoint for remote image proxying.",
);

assert.match(
  shoeImageController,
  /private ResponseEntity<\?> renderSourceInternal\(/,
  "ShoeImageController should centralize render-source handling so GET/POST wrappers cannot drift.",
);

console.log("PASS shoe render-source contract");
