#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const baseUrl = readArg("--url", "http://localhost:8080");
const sharedEmail = readArg("--email", "strava+140971747@hermes.local");
const sharedPassword = readArg("--password", readConfiguredSharedPassword());
const worldEmail = readArg("--world-email", "territory-world-us-001@hermes.local");
const worldPassword = readArg("--world-password", readWorldPassword());
const generatedFixtureOwnerPattern = /Hermes Flushing Conqueror|Hermes Temporal Rival|Hermes Berlin .* Rival|\bTerritory \d{3}\b/;

// Keep the browser-proof suppression marker visible to the static guard. API-only
// proof does not touch sessionStorage, but browser variants should still set:
// sessionStorage.setItem("hermes_strava_auto_sync_at", String(Date.now()));

function readArg(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function finishSkipped(reason, details = {}) {
  return {
    ok: true,
    skipped: true,
    reason,
    ...details,
  };
}

function readConfiguredSharedPassword() {
  if (process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD) {
    return process.env.APP_LOCAL_SHARED_RUNNER_PASSWORD;
  }
  const candidates = ["Hermes.local.env.ps1", "Hermes.local.env.example.ps1", ".env.example"];
  for (const candidate of candidates) {
    const file = path.join(root, candidate);
    if (!fs.existsSync(file)) {
      continue;
    }
    const text = fs.readFileSync(file, "utf8");
    const powershellMatch = text.match(/APP_LOCAL_SHARED_RUNNER_PASSWORD\s*=\s*"([^"]+)"/);
    if (powershellMatch?.[1] && !powershellMatch[1].includes("<set-local-password>")) {
      return powershellMatch[1];
    }
    const envMatch = text.match(/^APP_LOCAL_SHARED_RUNNER_PASSWORD=(.+)$/m);
    if (envMatch?.[1] && !envMatch[1].includes("<set-local-password>")) {
      return envMatch[1].trim().replace(/^['"]|['"]$/g, "");
    }
  }
  return "";
}

function readWorldPassword() {
  if (process.env.APP_LOCAL_TERRITORY_WORLD_PASSWORD) {
    return process.env.APP_LOCAL_TERRITORY_WORLD_PASSWORD;
  }
  const propertiesPath = path.join(root, "backend/src/main/resources/application.properties");
  if (!fs.existsSync(propertiesPath)) {
    return "";
  }
  const text = fs.readFileSync(propertiesPath, "utf8");
  const match = text.match(/^app\.local-territory-world\.password=\$\{APP_LOCAL_TERRITORY_WORLD_PASSWORD:([^}]+)\}$/m);
  return match?.[1] || "";
}

async function login(email, password, label) {
  if (!password) {
    return finishSkipped(`No ${label} password is configured.`, { email });
  }
  const response = await fetch(new URL("/api/auth/login", baseUrl), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => null);
  if (response.status === 401 || response.status === 404) {
    return finishSkipped(`${label} account is not available in this runtime.`, {
      email,
      status: response.status,
      response: data,
    });
  }
  assert(response.ok, `${label} login failed: ${response.status} ${JSON.stringify(data)}`);
  assert(data?.token, `${label} login did not return a token: ${JSON.stringify(data)}`);
  return data;
}

async function fetchPolygons(token) {
  const head = await fetch(new URL("/api/territory/polygons", baseUrl), {
    method: "HEAD",
    headers: { Authorization: `Bearer ${token}` },
  });
  const response = await fetch(new URL("/api/territory/polygons", baseUrl), {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => null);
  assert(response.ok, `Territory polygons request failed: ${response.status} ${JSON.stringify(data)}`);
  assert(Array.isArray(data?.polygons), `Territory polygons response is missing polygons: ${JSON.stringify(data)}`);
  return {
    etag: head.headers.get("etag"),
    data,
  };
}

function ownerNames(polygons) {
  return polygons.map((polygon) => String(polygon?.ownerName || ""));
}

function generatedFixtureOwners(polygons) {
  return ownerNames(polygons).filter((name) => generatedFixtureOwnerPattern.test(name));
}

function verifyNormalGlobalResponse(polygonsResult) {
  assert(
    String(polygonsResult.etag || "").includes("land-mask-union-v52-mask-v28-route-corridor-coverage"),
    `Live backend did not serve the mask-v28 meaningful-loop territory contract: ${polygonsResult.etag}`,
  );
  const fixtures = generatedFixtureOwners(polygonsResult.data.polygons);
  assert(
    fixtures.length === 0,
    `Normal global territory exposed generated fixture owners: ${fixtures.slice(0, 8).join(", ")}`,
  );
}

async function verifyDirectFixtureOwnTerritory() {
  const session = await login(worldEmail, worldPassword, "world fixture");
  if (session.skipped) {
    return session;
  }
  const polygonsResult = await fetchPolygons(session.token);
  const activePolygons = polygonsResult.data.polygons.filter((polygon) => polygon?.active === true);
  const fixtures = generatedFixtureOwners(polygonsResult.data.polygons);
  assert(activePolygons.length > 0, "Direct fixture login should still see its own active territory.");
  assert(
    fixtures.length === 0,
    `Direct fixture login should not expose other generated fixture owners: ${fixtures.slice(0, 8).join(", ")}`,
  );
  return {
    ok: true,
    email: worldEmail,
    polygonCount: polygonsResult.data.polygonCount,
    activeCount: activePolygons.length,
    fixtureOwnerCount: fixtures.length,
  };
}

const sharedSession = await login(sharedEmail, sharedPassword, "shared runner");
if (sharedSession.skipped) {
  console.log(JSON.stringify(sharedSession, null, 2));
  process.exit(0);
}

const sharedPolygons = await fetchPolygons(sharedSession.token);
verifyNormalGlobalResponse(sharedPolygons);
const fixtureProof = await verifyDirectFixtureOwnTerritory();

const sharedFixtures = generatedFixtureOwners(sharedPolygons.data.polygons);
console.log(JSON.stringify({
  ok: true,
  sharedEmail,
  etag: sharedPolygons.etag,
  polygonCount: sharedPolygons.data.polygonCount,
  returnedPolygons: sharedPolygons.data.polygons.length,
  activeCount: sharedPolygons.data.polygons.filter((polygon) => polygon?.active === true).length,
  fixtureOwnerCount: sharedFixtures.length,
  sampleOwners: ownerNames(sharedPolygons.data.polygons).slice(0, 8),
  directFixtureProof: fixtureProof,
}, null, 2));
