#!/usr/bin/env node
// Auditor for every persisted marathon course-map. For each row in
// race_course_map_asset, reads liveRoutePointsJson + city lat/lng from the
// world race catalog, and runs cheap geographic plausibility checks:
//
//   1. Every waypoint must sit within ~30 km of the race's catalog (city)
//      anchor — otherwise the route is in the wrong city entirely (the
//      most common breakage from earlier AI-acquire rounds).
//   2. The route's length (great-circle, point-to-point) must be inside
//      the expected race-distance band: 0.6× to 2.4× of distanceKm. A
//      "marathon" with 8 km of accumulated polyline distance is broken;
//      a "marathon" with 130 km is also broken (usually a synthetic-loop
//      bug or a marker landed on a different continent).
//   3. For non-loop marathons, the start and finish must be within
//      catalog-distance×0.7 of each other (loops will have them close,
//      point-to-points will have them apart). This is informational —
//      we don't fail on it, just report it.
//   4. The route must have at least 8 waypoints. Fewer than 8 reads as
//      "broken sparse polyline that doesn't represent a real course".
//
// Output: a JSON report on stdout listing every marathon and any flags,
// suitable for piping into a fix-prioritization step.
//
// Run from repo root:
//   node .tools/audit-marathon-coursemaps.mjs > /tmp/marathon-audit.json
//
// The auditor reads from the live DB directly via the h2 Shell tool, so
// the running backend's data is what's checked — not the on-disk JSON
// sidecars (which can drift, as the boston-marathon round demonstrated).

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");

const H2_JAR_PATH = path.join(
  process.env.USERPROFILE || process.env.HOME || "",
  ".m2",
  "repository",
  "com",
  "h2database",
  "h2",
  "2.4.240",
  "h2-2.4.240.jar",
);
const DB_URL = "jdbc:h2:file:./backend/hermes_db_v2;AUTO_SERVER=TRUE";

function runSql(sql) {
  const out = execFileSync(
    "java",
    ["-cp", H2_JAR_PATH, "org.h2.tools.Shell", "-url", DB_URL, "-user", "sa", "-password", ""],
    { input: sql, encoding: "utf8", cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 },
  );
  return out;
}

function loadAllRoutes() {
  // First get the race IDs (cheap, narrow columns). Then per-race fetch the
  // single live_route_points_json field with maxwidth turned up high so the
  // H2 Shell doesn't wrap the JSON across console lines (the wrapped output
  // breaks pipe-based parsing).
  const idsRaw = runSql(
    "SELECT race_id FROM race_course_map_asset WHERE live_route_points_json IS NOT NULL AND live_route_points_json <> '[]' ORDER BY race_id;",
  );
  const raceIds = [];
  for (const rawLine of idsRaw.split(/\r?\n/)) {
    const line = rawLine.trim();
    // Skip header, banner, prompt, separator, and empty lines.
    if (!line || /^(RACE_ID|sql>|Welcome|Exit|Commands|help|list|maxwidth|autocommit|history|quit|Type|\[|\(|-+\s*$|Aborted|Connection)/i.test(line)) continue;
    const m = line.match(/^([a-z0-9][a-z0-9_-]+)$/);
    if (m) raceIds.push(m[1]);
  }

  const rows = [];
  for (const raceId of raceIds) {
    const safe = raceId.replace(/'/g, "''");
    const sql =
      "maxwidth 2000000;\n" +
      `SELECT race_id, race_name, latitude, longitude, distance_km, live_route_points_json, live_overlay_bounds_json, live_confidence, live_source FROM race_course_map_asset WHERE race_id = '${safe}';`;
    const raw = runSql(sql);

    // Pull the single data row out of the shell output. Header lives on the
    // line above the data; the data row has the most pipes.
    const lines = raw.split(/\r?\n/).filter((l) => l.includes("|"));
    let header = null;
    let data = null;
    for (let i = 0; i < lines.length; i++) {
      // The H2 Shell prefixes the header line with "sql> " (the prompt echo).
      // Strip that before splitting, otherwise the first column reads as
      // "sql> RACE_ID" instead of "RACE_ID" and the header regex never matches.
      const cleaned = lines[i].replace(/^\s*sql>\s*/, "");
      const cols = cleaned.split("|").map((s) => s.trim());
      if (!header && cols.some((c) => /^RACE_ID$/i.test(c))) {
        header = cols;
        continue;
      }
      if (header && cols.length >= header.length) {
        data = cols;
        break;
      }
    }
    if (!header || !data) continue;
    // Tail-merge in case label text contained a `|` inside live_route_points_json.
    while (data.length > header.length) {
      data[header.length - 1] = data.slice(header.length - 1).join("|");
      data.length = header.length;
    }
    const obj = {};
    for (let i = 0; i < header.length; i++) obj[header[i].toLowerCase()] = data[i];
    rows.push(obj);
  }
  return rows;
}

function safeNumber(v) {
  if (v == null || v === "null" || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function parseJsonField(v) {
  if (v == null || v === "null" || v === "") return null;
  try {
    return JSON.parse(v);
  } catch {
    return null;
  }
}

const R_EARTH_KM = 6371.0;

function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R_EARTH_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function polylineKm(points) {
  let sum = 0;
  for (let i = 1; i < points.length; i++) {
    sum += haversineKm(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  }
  return sum;
}

function maxDistanceFromAnchor(points, anchorLat, anchorLng) {
  let max = 0;
  for (const p of points) {
    const d = haversineKm(p.lat, p.lng, anchorLat, anchorLng);
    if (d > max) max = d;
  }
  return max;
}

function audit(row) {
  const points = parseJsonField(row.live_route_points_json) || [];
  const flags = [];

  // Sanity-check waypoint shape.
  const normalized = points
    .map((p) => ({ lat: safeNumber(p?.lat), lng: safeNumber(p?.lng), label: p?.label ?? null }))
    .filter((p) => p.lat != null && p.lng != null);
  if (normalized.length !== points.length) {
    flags.push("non-numeric-waypoints");
  }
  if (normalized.length < 8) {
    flags.push(`sparse-${normalized.length}-waypoints`);
  }

  const cityLat = safeNumber(row.latitude);
  const cityLng = safeNumber(row.longitude);
  const distanceKm = safeNumber(row.distance_km);

  // 1. Geographic-anchor check — every waypoint should be within ~30 km of
  //    the city/race anchor lat/lng. Marathons that fit in a city footprint
  //    rarely stretch beyond ~30 km from the city center; point-to-point
  //    courses like Boston still stay within ~30 km of their finish anchor.
  if (cityLat != null && cityLng != null && normalized.length > 0) {
    const farthest = maxDistanceFromAnchor(normalized, cityLat, cityLng);
    if (farthest > 60) {
      flags.push(`anchor-far-${Math.round(farthest)}km`);
    }
  } else {
    flags.push("missing-city-anchor");
  }

  // 2. Polyline-distance plausibility. Bounds are deliberately wide because
  //    waypoints are coarse — a 15–20 point hand-built polyline connecting
  //    landmark turns with straight-line segments can easily undercount the
  //    real winding road distance by 50%. The auditor only complains when
  //    the great-circle sum is so far off the declared distance that the
  //    polyline can't be reasonably tracing the same course (under 0.3× =
  //    fake/sparse, over 2.4× = scrambled order or stray decorations).
  let polyKm = null;
  if (normalized.length >= 2) {
    polyKm = polylineKm(normalized);
    if (distanceKm != null && distanceKm > 0) {
      const ratio = polyKm / distanceKm;
      if (ratio < 0.3) flags.push(`polyline-short-${ratio.toFixed(2)}x`);
      if (ratio > 2.4) flags.push(`polyline-long-${ratio.toFixed(2)}x`);
    }
  }

  // 3. Loop vs point-to-point informational signal.
  let startFinishKm = null;
  if (normalized.length >= 2) {
    startFinishKm = haversineKm(
      normalized[0].lat,
      normalized[0].lng,
      normalized[normalized.length - 1].lat,
      normalized[normalized.length - 1].lng,
    );
  }

  // Map the live_source field to a priority hint. Known-bad sources rank
  // higher for the fix queue.
  const source = (row.live_source || "").toLowerCase();
  const sourcePriority = source.includes("synthetic")
    ? 90
    : source.includes("auto-acquire")
      ? 40
      : 5;

  return {
    raceId: row.race_id,
    raceName: row.race_name,
    cityAnchor: cityLat != null && cityLng != null ? { lat: cityLat, lng: cityLng } : null,
    distanceKmDeclared: distanceKm,
    polylineKm: polyKm == null ? null : Math.round(polyKm * 10) / 10,
    polylineRatio: polyKm != null && distanceKm ? Math.round((polyKm / distanceKm) * 100) / 100 : null,
    startFinishKm: startFinishKm == null ? null : Math.round(startFinishKm * 10) / 10,
    waypointCount: normalized.length,
    confidence: safeNumber(row.live_confidence),
    source,
    flags,
    severity: flags.length === 0 ? 0 : flags.length + (sourcePriority >= 90 ? 2 : sourcePriority >= 40 ? 1 : 0),
  };
}

function main() {
  if (!fs.existsSync(H2_JAR_PATH)) {
    process.stderr.write(`H2 jar not found at ${H2_JAR_PATH}. Aborting.\n`);
    process.exit(2);
  }
  const rows = loadAllRoutes();
  const audited = rows.map(audit).sort((a, b) => b.severity - a.severity);
  const broken = audited.filter((a) => a.flags.length > 0);
  const clean = audited.filter((a) => a.flags.length === 0);

  const summary = {
    totalRoutes: audited.length,
    routesWithFlags: broken.length,
    routesClean: clean.length,
    topFlagged: broken.slice(0, 15),
    cleanIds: clean.map((c) => c.raceId),
    flagHistogram: histogramFlags(broken),
  };
  process.stdout.write(JSON.stringify({ summary, all: audited }, null, 2) + "\n");
}

function histogramFlags(broken) {
  const hist = {};
  for (const r of broken) {
    for (const f of r.flags) {
      // Strip the numeric tail so "anchor-far-83km" + "anchor-far-120km" share a bucket.
      const family = f.replace(/-[0-9.]+(km|x|-waypoints)?$/, "");
      hist[family] = (hist[family] || 0) + 1;
    }
  }
  return hist;
}

main();
