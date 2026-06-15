import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DAYS = 45;
const OUT_PATH = path.join(ROOT, "docs", "github-commit-activity.svg");

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function runGit(args) {
  return execFileSync("git", args, { cwd: ROOT, encoding: "utf8" }).trim();
}

function collectCounts(start, end) {
  const output = runGit([
    "log",
    `--since=${isoDate(start)}T00:00:00Z`,
    `--until=${isoDate(end)}T23:59:59Z`,
    "--date=format:%Y-%m-%d",
    "--pretty=format:%cd",
    "--all",
  ]);
  const counts = new Map();
  if (!output) return counts;
  for (const line of output.split(/\r?\n/)) {
    const date = line.trim();
    if (!date) continue;
    counts.set(date, (counts.get(date) || 0) + 1);
  }
  return counts;
}

function buildSeries(today = new Date()) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = addDays(end, -(DAYS - 1));
  const counts = collectCounts(start, end);
  return Array.from({ length: DAYS }, (_, index) => {
    const date = addDays(start, index);
    const key = isoDate(date);
    return { date: key, commits: counts.get(key) || 0 };
  });
}

function pathForSeries(series, width, height, pad) {
  const max = Math.max(1, ...series.map((item) => item.commits));
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  return series
    .map((item, index) => {
      const x = pad.left + (plotWidth * index) / (series.length - 1);
      const y = pad.top + plotHeight - (plotHeight * item.commits) / max;
      return `${index === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");
}

function renderSvg(series) {
  const width = 900;
  const height = 300;
  const pad = { top: 54, right: 32, bottom: 68, left: 56 };
  const max = Math.max(1, ...series.map((item) => item.commits));
  const plotWidth = width - pad.left - pad.right;
  const plotHeight = height - pad.top - pad.bottom;
  const labels = series.filter((_, index) => index % 7 === 0 || index === series.length - 1);
  const points = series
    .map((item, index) => {
      const x = pad.left + (plotWidth * index) / (series.length - 1);
      const y = pad.top + plotHeight - (plotHeight * item.commits) / max;
      return `<circle cx="${x.toFixed(2)}" cy="${y.toFixed(2)}" r="3.5"><title>${escapeXml(item.date)}: ${item.commits} commits</title></circle>`;
    })
    .join("\n      ");
  const labelSvg = labels
    .map((item, index) => {
      const seriesIndex = series.indexOf(item);
      const x = pad.left + (plotWidth * seriesIndex) / (series.length - 1);
      const anchor = index === 0 ? "start" : index === labels.length - 1 ? "end" : "middle";
      return `<text x="${x.toFixed(2)}" y="${height - 24}" text-anchor="${anchor}">${escapeXml(item.date)}</text>`;
    })
    .join("\n      ");
  const yTicks = [0, Math.ceil(max / 2), max].filter((value, index, values) => values.indexOf(value) === index);
  const yTickSvg = yTicks
    .map((value) => {
      const y = pad.top + plotHeight - (plotHeight * value) / max;
      return `<line x1="${pad.left}" x2="${width - pad.right}" y1="${y.toFixed(2)}" y2="${y.toFixed(2)}" class="grid" />
      <text x="${pad.left - 10}" y="${(y + 4).toFixed(2)}" text-anchor="end">${value}</text>`;
    })
    .join("\n      ");
  const linePath = pathForSeries(series, width, height, pad);
  const areaPath = `${linePath} L ${width - pad.right} ${height - pad.bottom} L ${pad.left} ${height - pad.bottom} Z`;
  const total = series.reduce((sum, item) => sum + item.commits, 0);
  const start = series[0].date;
  const end = series.at(-1).date;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
  <title id="title">Hermes commit activity from ${escapeXml(start)} to ${escapeXml(end)}</title>
  <desc id="desc">A ${DAYS}-day commit activity chart generated from this repository's Git history. Total commits: ${total}. Dates are shown as ISO calendar dates.</desc>
  <style>
    text { fill: #64748b; font: 12px ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
    .title { fill: #334155; font: 600 16px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .subtitle { fill: #64748b; font: 12px ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .grid { stroke: #e2e8f0; stroke-width: 1; }
    .axis { stroke: #cbd5e1; stroke-width: 1.25; }
    .area { fill: #22c55e; opacity: 0.13; }
    .line { fill: none; stroke: #16a34a; stroke-width: 3; stroke-linecap: round; stroke-linejoin: round; }
    circle { fill: #0f766e; stroke: #ffffff; stroke-width: 2; }
  </style>
  <rect width="100%" height="100%" fill="#ffffff" />
  <text x="${width / 2}" y="24" text-anchor="middle" class="title">Hermes GitHub Commit Activity</text>
  <text x="${width / 2}" y="42" text-anchor="middle" class="subtitle">${escapeXml(start)} to ${escapeXml(end)} | ${total} commits from repository history</text>
  <g>
      ${yTickSvg}
      <line x1="${pad.left}" x2="${pad.left}" y1="${pad.top}" y2="${height - pad.bottom}" class="axis" />
      <line x1="${pad.left}" x2="${width - pad.right}" y1="${height - pad.bottom}" y2="${height - pad.bottom}" class="axis" />
      <path d="${areaPath}" class="area" />
      <path d="${linePath}" class="line" />
      ${points}
      ${labelSvg}
  </g>
</svg>
`;
}

function main() {
  const series = buildSeries();
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, renderSvg(series), "utf8");
  console.log(`Wrote ${path.relative(ROOT, OUT_PATH)} with ${series.length} calendar days.`);
}

main();
