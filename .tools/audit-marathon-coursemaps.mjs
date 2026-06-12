#!/usr/bin/env node
// Audits the race-page marathon course-map inventory against either the admin
// API used by the portal or the local H2 course-map table. This is
// intentionally stricter than a smoke test: a generic synthetic route,
// hand-corrected sidecar, missing source image, or runtime-rejected distance
// ratio is not "clean" for the official admin reupload workflow.
//
// Run from repo root:
//   node .tools/audit-marathon-coursemaps.mjs
//   HERMES_ADMIN_TOKEN=... node .tools/audit-marathon-coursemaps.mjs --source api

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(REPO_ROOT, "frontend", "src", "data", "worldRaceCatalog.json");
const FULL_MARATHON_DISTANCE_KM = 42.195;
const ARGS = parseArgs(process.argv.slice(2));
const AUDIT_SOURCE = (ARGS.source || process.env.HERMES_COURSE_MAP_AUDIT_SOURCE || (process.env.HERMES_ADMIN_TOKEN ? "api" : "h2")).toLowerCase();
const API_BASE_URL = (ARGS["api-base"] || process.env.HERMES_API_BASE_URL || "http://localhost:8080").replace(/\/+$/, "");
const API_TOKEN = ARGS.token || process.env.HERMES_ADMIN_TOKEN || "";

const H2_JAR_PATH = firstExistingPath(
  path.join(REPO_ROOT, ".m2repo", "com", "h2database", "h2", "2.4.240", "h2-2.4.240.jar"),
  path.join(
    process.env.USERPROFILE || process.env.HOME || "",
    ".m2",
    "repository",
    "com",
    "h2database",
    "h2",
    "2.4.240",
    "h2-2.4.240.jar",
  ),
);
const DB_URL = "jdbc:h2:file:./backend/hermes_db_v2;AUTO_SERVER=TRUE";

const TRUSTED_OFFICIAL_WAYPOINT_SOURCES = new Set([
  "nyc-official-course",
  "tokyo-official-course",
  "la-official-course",
  "osaka-official-course",
  "athens-official-course",
]);

function parseArgs(argv) {
  const parsed = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const withoutPrefix = arg.slice(2);
    const equalsIndex = withoutPrefix.indexOf("=");
    if (equalsIndex >= 0) {
      parsed[withoutPrefix.slice(0, equalsIndex)] = withoutPrefix.slice(equalsIndex + 1);
    } else {
      const next = argv[i + 1];
      if (next && !next.startsWith("--")) {
        parsed[withoutPrefix] = next;
        i += 1;
      } else {
        parsed[withoutPrefix] = "true";
      }
    }
  }
  return parsed;
}

function firstExistingPath(...candidates) {
  return candidates.find((candidate) => candidate && fs.existsSync(candidate)) || candidates[0];
}

function runSql(sql) {
  return execFileSync(
    "java",
    ["-cp", H2_JAR_PATH, "org.h2.tools.Shell", "-url", DB_URL, "-user", "sa", "-password", ""],
    { input: sql, encoding: "utf8", cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 },
  );
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.headers || {}),
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`HTTP ${response.status} from ${url}: ${body.slice(0, 300)}`);
  }
  return response.json();
}

function loadCatalogMarathons() {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  return catalog
    .filter((race) => Math.abs(Number(race?.distanceKm || 0) - FULL_MARATHON_DISTANCE_KM) < 0.5)
    .map((race) => ({
      id: race.id,
      raceName: race.name,
      city: race.city,
      country: race.country,
      officialWebsite: race.officialWebsite || "",
      latitude: race.lat,
      longitude: race.lng,
      distanceKm: Number(race.distanceKm),
    }));
}

function parseRaceIds(raw) {
  const raceIds = [];
  for (const rawLine of raw.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || /^(RACE_ID|sql>|Welcome|Exit|Commands|help|list|maxwidth|autocommit|history|quit|Type|\[|\(|-+\s*$|Aborted|Connection)/i.test(line)) {
      continue;
    }
    const match = line.match(/^([a-z0-9][a-z0-9_-]+)$/);
    if (match) raceIds.push(match[1]);
  }
  return raceIds;
}

async function loadAllAssetRows() {
  if (AUDIT_SOURCE === "api") return loadAllAssetRowsFromApi();
  if (AUDIT_SOURCE !== "h2") {
    throw new Error(`Unsupported audit source "${AUDIT_SOURCE}". Use "api" or "h2".`);
  }
  return loadAllAssetRowsFromH2();
}

async function loadAllAssetRowsFromApi() {
  if (!API_TOKEN) {
    throw new Error("HERMES_ADMIN_TOKEN or --token is required when --source api is used.");
  }
  const rows = await fetchJson(`${API_BASE_URL}/api/admin/race-course-maps`, {
    headers: {
      Authorization: `Bearer ${API_TOKEN}`,
    },
  });
  if (!Array.isArray(rows)) {
    throw new Error("Admin course-map API returned a non-array response.");
  }
  return rows.map(rowFromAdminApi);
}

function rowFromAdminApi(item) {
  const live = item?.live || null;
  return {
    race_id: item?.raceId,
    race_name: item?.raceName,
    city: item?.city,
    country: item?.country,
    official_website: "",
    latitude: null,
    longitude: null,
    distance_km: null,
    live_image_url: live?.imageUrl || "",
    live_overlay_bounds_json: live?.overlayBounds ? JSON.stringify(live.overlayBounds) : "",
    live_confidence: live?.confidence ?? null,
    live_source: live?.source || "",
    live_updated_at: live?.updatedAt || null,
    updated_at: item?.updatedAt || null,
    live_route_points_json: JSON.stringify(Array.isArray(live?.routePoints) ? live.routePoints : []),
  };
}

function loadAllAssetRowsFromH2() {
  const idsRaw = runSql("SELECT race_id FROM race_course_map_asset ORDER BY race_id;");
  const raceIds = parseRaceIds(idsRaw);
  const rows = [];

  for (const raceId of raceIds) {
    const safe = raceId.replace(/'/g, "''");
    const sql =
      "maxwidth 2000000;\n" +
      `SELECT race_id, race_name, city, country, official_website, latitude, longitude, distance_km, live_image_url, live_overlay_bounds_json, live_confidence, live_source, live_updated_at, updated_at, live_route_points_json FROM race_course_map_asset WHERE race_id = '${safe}';`;
    const raw = runSql(sql);
    const row = parseSingleH2Row(raw);
    if (row) rows.push(row);
  }

  return rows;
}

function parseSingleH2Row(raw) {
  const lines = raw.split(/\r?\n/).filter((line) => line.includes("|"));
  let header = null;
  let data = null;
  for (const line of lines) {
    const cleaned = line.replace(/^\s*sql>\s*/, "");
    const cols = cleaned.split("|").map((part) => part.trim());
    if (!header && cols.some((col) => /^RACE_ID$/i.test(col))) {
      header = cols;
      continue;
    }
    if (header && cols.length >= header.length) {
      data = cols;
      break;
    }
  }
  if (!header || !data) return null;

  // live_route_points_json is deliberately the last selected column. If H2
  // output splitting sees a pipe inside JSON label text, merge it back there.
  while (data.length > header.length) {
    data[header.length - 1] = data.slice(header.length - 1).join("|");
    data.length = header.length;
  }

  const row = {};
  for (let i = 0; i < header.length; i++) {
    row[header[i].toLowerCase()] = data[i];
  }
  return row;
}

function safeNumber(value) {
  if (value == null || value === "null" || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function nonBlank(value) {
  return value != null && value !== "null" && String(value).trim() !== "";
}

function cleanString(value) {
  return nonBlank(value) ? String(value).trim() : "";
}

function parseJsonField(value) {
  if (!nonBlank(value)) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

const EARTH_RADIUS_KM = 6371.0;

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineKm(points) {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return total;
}

function maxDistanceFromAnchor(points, anchorLat, anchorLng) {
  let max = 0;
  for (const point of points) {
    max = Math.max(max, haversineKm(point.lat, point.lng, anchorLat, anchorLng));
  }
  return max;
}

function expectedDistanceRatioWindow(distanceKm, routePointCount) {
  if (distanceKm != null && distanceKm >= 40.0) {
    if (routePointCount >= 18) return { minRatio: 0.78, maxRatio: 1.22 };
    if (routePointCount >= 14) return { minRatio: 0.65, maxRatio: 1.35 };
    return { minRatio: 0.55, maxRatio: 1.45 };
  }
  if (routePointCount >= 16) return { minRatio: 0.6, maxRatio: 1.4 };
  return { minRatio: 0.45, maxRatio: 1.7 };
}

function minimumRoutePointCountForSource(source) {
  return source != null && (source.startsWith("admin-") || source.startsWith("published-live")) ? 5 : 12;
}

function normalizePoints(rawPoints, flags) {
  const points = Array.isArray(rawPoints) ? rawPoints : [];
  const normalized = points
    .map((point) => ({ lat: safeNumber(point?.lat), lng: safeNumber(point?.lng), label: point?.label ?? null }))
    .filter((point) => point.lat != null && point.lng != null);
  if (normalized.length !== points.length) flags.push("non-numeric-waypoints");
  return normalized;
}

function auditCatalogRace(catalogRace, row) {
  const flags = [];
  const source = cleanString(row?.live_source).toLowerCase();
  const liveImageUrl = cleanString(row?.live_image_url);
  const rawPoints = parseJsonField(row?.live_route_points_json);
  const points = normalizePoints(rawPoints, flags);
  const routePointMinimum = minimumRoutePointCountForSource(source);
  const latitude = safeNumber(row?.latitude) ?? safeNumber(catalogRace.latitude);
  const longitude = safeNumber(row?.longitude) ?? safeNumber(catalogRace.longitude);
  const distanceKm = safeNumber(row?.distance_km) ?? safeNumber(catalogRace.distanceKm);

  if (!row) flags.push("missing-backend-record");
  if (!source) flags.push("missing-live-source");
  if (!nonBlank(liveImageUrl)) flags.push("missing-live-source-map-image");
  if (points.length === 0) flags.push("missing-live-route");
  if (points.length > 0 && points.length < routePointMinimum) {
    flags.push(`sparse-${points.length}-waypoints-need-${routePointMinimum}`);
  }

  if (source.includes("synthetic")) flags.push("synthetic-route");
  if (source.includes("hand-corrected")) flags.push("hand-corrected-route-needs-official-upload");
  if (source.includes("auto-acquire")) flags.push("auto-acquired-route-needs-visual-review");
  if (TRUSTED_OFFICIAL_WAYPOINT_SOURCES.has(source) && !nonBlank(liveImageUrl)) {
    flags.push("official-waypoints-without-uploaded-map");
  }

  if (latitude != null && longitude != null && points.length > 0) {
    const farthest = maxDistanceFromAnchor(points, latitude, longitude);
    if (farthest > 60) flags.push(`anchor-far-${Math.round(farthest)}km`);
  } else if (points.length > 0) {
    flags.push("missing-city-anchor");
  }

  let routeKm = null;
  let ratio = null;
  let expectedWindow = null;
  if (points.length >= 2) {
    routeKm = polylineKm(points);
    if (distanceKm != null && distanceKm > 0) {
      ratio = routeKm / distanceKm;
      expectedWindow = expectedDistanceRatioWindow(distanceKm, points.length);
      if (ratio < expectedWindow.minRatio || ratio > expectedWindow.maxRatio) {
        flags.push(`polyline-outside-runtime-window-${ratio.toFixed(2)}x`);
      }
    }
  }

  let startFinishKm = null;
  if (points.length >= 2) {
    startFinishKm = haversineKm(points[0].lat, points[0].lng, points[points.length - 1].lat, points[points.length - 1].lng);
  }

  return {
    raceId: catalogRace.id,
    raceName: cleanString(row?.race_name) || catalogRace.raceName,
    city: cleanString(row?.city) || catalogRace.city,
    country: cleanString(row?.country) || catalogRace.country,
    officialWebsite: cleanString(row?.official_website) || catalogRace.officialWebsite,
    catalogOfficialWebsite: catalogRace.officialWebsite,
    liveImageUrl: liveImageUrl || null,
    source: source || null,
    liveUpdatedAt: cleanString(row?.live_updated_at) || null,
    updatedAt: cleanString(row?.updated_at) || null,
    distanceKmDeclared: distanceKm,
    expectedDistanceRatioWindow: expectedWindow,
    polylineKm: routeKm == null ? null : round1(routeKm),
    polylineRatio: ratio == null ? null : round2(ratio),
    startFinishKm: startFinishKm == null ? null : round1(startFinishKm),
    waypointCount: points.length,
    confidence: safeNumber(row?.live_confidence),
    flags: [...new Set(flags)],
    severity: severityForFlags(flags),
  };
}

function auditBackendOnlyRow(row) {
  const catalogRace = {
    id: row.race_id,
    raceName: row.race_name,
    city: row.city,
    country: row.country,
    officialWebsite: cleanString(row.official_website),
    latitude: safeNumber(row.latitude),
    longitude: safeNumber(row.longitude),
    distanceKm: safeNumber(row.distance_km),
  };
  const audit = auditCatalogRace(catalogRace, row);
  return { ...audit, backendOnly: true };
}

function severityForFlags(flags) {
  let score = 0;
  for (const flag of flags) {
    if (flag.startsWith("missing-backend") || flag.startsWith("missing-live-route")) score = Math.max(score, 100);
    else if (flag.startsWith("missing-live-source-map-image")) score = Math.max(score, 90);
    else if (flag.includes("synthetic")) score = Math.max(score, 85);
    else if (flag.includes("hand-corrected")) score = Math.max(score, 80);
    else if (flag.startsWith("polyline-outside-runtime-window")) score = Math.max(score, 75);
    else if (flag.startsWith("sparse")) score = Math.max(score, 70);
    else if (flag.includes("auto-acquired")) score = Math.max(score, 50);
    else score = Math.max(score, 25);
  }
  return score + Math.min(flags.length, 10);
}

function round1(number) {
  return Math.round(number * 10) / 10;
}

function round2(number) {
  return Math.round(number * 100) / 100;
}

function histogramFlags(items) {
  const histogram = {};
  for (const item of items) {
    for (const flag of item.flags) {
      const family = flag
        .replace(/-[0-9.]+(km|x)?$/, "")
        .replace(/-waypoints-need-[0-9]+$/, "-waypoints");
      histogram[family] = (histogram[family] || 0) + 1;
    }
  }
  return histogram;
}

function histogramSources(items) {
  const histogram = {};
  for (const item of items) {
    const source = item.source || "(missing)";
    histogram[source] = (histogram[source] || 0) + 1;
  }
  return histogram;
}

async function main() {
  if (AUDIT_SOURCE === "h2" && !fs.existsSync(H2_JAR_PATH)) {
    process.stderr.write(`H2 jar not found at ${H2_JAR_PATH}. Aborting.\n`);
    process.exit(2);
  }
  const catalogMarathons = loadCatalogMarathons();
  const rows = await loadAllAssetRows();
  const rowsById = new Map(rows.map((row) => [row.race_id, row]));
  const catalogIds = new Set(catalogMarathons.map((race) => race.id));

  const audited = catalogMarathons
    .map((race) => auditCatalogRace(race, rowsById.get(race.id)))
    .sort((a, b) => b.severity - a.severity || a.raceId.localeCompare(b.raceId));
  const backendOnly = rows
    .filter((row) => !catalogIds.has(row.race_id))
    .map(auditBackendOnlyRow)
    .sort((a, b) => b.severity - a.severity || a.raceId.localeCompare(b.raceId));
  const needsWork = audited.filter((item) => item.flags.length > 0);
  const clean = audited.filter((item) => item.flags.length === 0);

  const summary = {
    catalogMarathons: catalogMarathons.length,
    dataSource: AUDIT_SOURCE,
    apiBaseUrl: AUDIT_SOURCE === "api" ? API_BASE_URL : null,
    persistedAssetRows: rows.length,
    auditedCatalogMarathons: audited.length,
    marathonsNeedingWork: needsWork.length,
    marathonsClean: clean.length,
    backendOnlyRoutes: backendOnly.length,
    topPriority: needsWork.slice(0, 25),
    flagHistogram: histogramFlags(needsWork),
    sourceHistogram: histogramSources(audited),
    cleanIds: clean.map((item) => item.raceId),
  };

  process.stdout.write(JSON.stringify({ summary, all: audited, backendOnly }, null, 2) + "\n");
}

main().catch((error) => {
  process.stderr.write(`${error?.stack || error?.message || error}\n`);
  process.exit(1);
});
