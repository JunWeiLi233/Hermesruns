import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);

function readArg(name) {
  const flag = `--${name}`;
  const index = args.indexOf(flag);
  if (index === -1 || index === args.length - 1) return "";
  return args[index + 1].trim();
}

function readList(name) {
  const raw = readArg(name);
  if (!raw) return [];
  return raw.split("||").map((item) => item.trim()).filter(Boolean);
}

function statIfExists(filePath) {
  if (!fs.existsSync(filePath)) return null;
  return fs.statSync(filePath);
}

function newestFileMtime(rootDir) {
  if (!fs.existsSync(rootDir)) return null;
  let newest = null;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      const stat = fs.statSync(full);
      if (!newest || stat.mtimeMs > newest.mtimeMs) {
        newest = { path: full, mtimeMs: stat.mtimeMs };
      }
    }
  }

  walk(rootDir);
  return newest;
}

const workspace = process.cwd();
const frontendFiles = readList("files")
  .map((item) => path.resolve(workspace, item))
  .filter((item) => item.includes(`${path.sep}frontend${path.sep}`));

const backendStaticAssetsDir = path.resolve(workspace, "backend/src/main/resources/static/assets");
const backendLiveAssetsDir = path.resolve(workspace, "backend/target/classes/static/assets");

const newestSource = frontendFiles
  .map((filePath) => ({ path: filePath, stat: statIfExists(filePath) }))
  .filter((entry) => entry.stat)
  .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0] || null;

const newestBuiltStatic = newestFileMtime(backendStaticAssetsDir);
const newestBuiltLive = newestFileMtime(backendLiveAssetsDir);

const errors = [];
const notes = [];

if (!frontendFiles.length) {
  errors.push("No frontend source files were provided. Pass --files with edited frontend paths.");
}

if (!newestBuiltStatic) {
  errors.push("No backend static assets were found under backend/src/main/resources/static/assets.");
}

if (!newestBuiltLive) {
  errors.push("No live backend static assets were found under backend/target/classes/static/assets.");
}

if (newestSource && newestBuiltStatic && newestBuiltStatic.mtimeMs < newestSource.stat.mtimeMs) {
  errors.push(
    `Backend static bundle is stale. ${path.relative(workspace, newestSource.path)} is newer than ${path.relative(workspace, newestBuiltStatic.path)}.`,
  );
}

if (newestSource && newestBuiltLive && newestBuiltLive.mtimeMs < newestSource.stat.mtimeMs) {
  errors.push(
    `Live backend bundle is stale. ${path.relative(workspace, newestSource.path)} is newer than ${path.relative(workspace, newestBuiltLive.path)}.`,
  );
}

if (newestSource) {
  notes.push(`Newest frontend source: ${path.relative(workspace, newestSource.path)}`);
  notes.push(`Source updated: ${new Date(newestSource.stat.mtimeMs).toISOString()}`);
}

if (newestBuiltStatic) {
  notes.push(`Newest backend static asset: ${path.relative(workspace, newestBuiltStatic.path)}`);
  notes.push(`Static asset updated: ${new Date(newestBuiltStatic.mtimeMs).toISOString()}`);
}

if (newestBuiltLive) {
  notes.push(`Newest live backend asset: ${path.relative(workspace, newestBuiltLive.path)}`);
  notes.push(`Live asset updated: ${new Date(newestBuiltLive.mtimeMs).toISOString()}`);
}

if (errors.length) {
  process.stdout.write("FAIL\n");
  errors.forEach((line) => process.stdout.write(`${line}\n`));
  if (notes.length) {
    process.stdout.write("\n");
    notes.forEach((line) => process.stdout.write(`${line}\n`));
  }
  process.exit(1);
}

process.stdout.write("PASS\n");
notes.forEach((line) => process.stdout.write(`${line}\n`));
