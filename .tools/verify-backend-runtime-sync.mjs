import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import https from "node:https";

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

function requestStatus(urlString) {
  const url = new URL(urlString);
  const client = url.protocol === "https:" ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.request(
      url,
      { method: "GET", timeout: 5000 },
      (response) => {
        response.resume();
        resolve(response.statusCode ?? 0);
      },
    );

    request.on("timeout", () => {
      request.destroy(new Error("Request timed out."));
    });
    request.on("error", reject);
    request.end();
  });
}

const workspace = process.cwd();
const backendFiles = readList("files")
  .map((item) => path.resolve(workspace, item))
  .filter((item) => item.includes(`${path.sep}backend${path.sep}`));
const runtimeUrl = readArg("url") || "http://localhost:8080";

const backendClassesDir = path.resolve(workspace, "backend/target/classes");

const newestSource =
  backendFiles
    .map((filePath) => ({ path: filePath, stat: statIfExists(filePath) }))
    .filter((entry) => entry.stat)
    .sort((a, b) => b.stat.mtimeMs - a.stat.mtimeMs)[0] || null;

const newestCompiled = newestFileMtime(backendClassesDir);

const errors = [];
const notes = [];

if (!backendFiles.length) {
  errors.push("No backend source files were provided. Pass --files with edited backend paths.");
}

if (!newestCompiled) {
  errors.push("No compiled backend output was found under backend/target/classes.");
}

if (newestSource && newestCompiled && newestCompiled.mtimeMs < newestSource.stat.mtimeMs) {
  errors.push(
    `Compiled backend output is stale. ${path.relative(workspace, newestSource.path)} is newer than ${path.relative(workspace, newestCompiled.path)}.`,
  );
}

if (newestSource) {
  notes.push(`Newest backend source: ${path.relative(workspace, newestSource.path)}`);
  notes.push(`Source updated: ${new Date(newestSource.stat.mtimeMs).toISOString()}`);
}

if (newestCompiled) {
  notes.push(`Newest compiled backend output: ${path.relative(workspace, newestCompiled.path)}`);
  notes.push(`Compiled output updated: ${new Date(newestCompiled.mtimeMs).toISOString()}`);
}

let statusCode = 0;

try {
  statusCode = await requestStatus(runtimeUrl);
  notes.push(`Runtime status: ${runtimeUrl} -> ${statusCode}`);
  if (statusCode !== 200) {
    errors.push(`Local Hermes runtime did not return 200. Got ${statusCode} from ${runtimeUrl}.`);
  }
} catch (error) {
  errors.push(`Local Hermes runtime check failed for ${runtimeUrl}: ${error.message}`);
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
