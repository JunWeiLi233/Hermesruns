import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const insightSource = readFileSync(path.join(here, "../AnalysisInsightDetail.jsx"), 'utf8');
const styleSource = readFileSync(
  path.join(here, "../../../styles/analysis-load-balance-profile-alignment.css"),
  'utf8',
);
const generatedStyleSource = readFileSync(
  path.join(here, "../../../styles/style.generated.css"),
  'utf8',
);

const chartStart = insightSource.indexOf('className="analysis-load-command-chart-svg"');
const chartEnd = chartStart >= 0 ? insightSource.indexOf('</svg>', chartStart) + '</svg>'.length : -1;
const chartSource = chartStart >= 0 && chartEnd > chartStart
  ? [insightSource.slice(insightSource.lastIndexOf('<svg', chartStart), chartEnd)]
  : null;
assert.ok(chartSource, 'Load Balance must render the interactive chart SVG.');

const clippedPlot = chartSource[0].match(
  /<g clipPath="url\(#loadChartClip\)">([\s\S]*?)<\/g>\s*\{loadScrubber &&/,
);
assert.ok(
  clippedPlot,
  'Load Balance chart paths should stay inside the plot clip while hover markers use a separate layer.',
);
assert.doesNotMatch(
  clippedPlot[1],
  /loadScrubber\.acuteCy|loadScrubber\.chronicCy/,
  'Hover markers must not be clipped at the zero baseline.',
);

const markerLayer = chartSource[0].match(
  /<g className="analysis-load-command-chart-markers">([\s\S]*?)<\/g>/,
);
assert.ok(markerLayer, 'Load Balance hover markers must have a dedicated SVG layer.');
assert.match(
  markerLayer[1],
  /loadScrubber\.acuteCy[\s\S]*loadScrubber\.chronicCy/,
  'The dedicated marker layer must render both acute and chronic hover points.',
);

const tooltipRule = styleSource.match(
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip\s*\{([\s\S]*?)\}/,
);
assert.ok(tooltipRule, 'Load Balance tooltip must have a route-scoped visual rule.');
assert.match(
  tooltipRule[1],
  /\bbackground:\s*#fff\s*;/,
  'Load Balance tooltip must explicitly use the light surface treatment.',
);
assert.match(
  tooltipRule[1],
  /\bcolor:\s*var\(--load-profile-ink\)\s*;/,
  'Load Balance tooltip must explicitly use the profile ink foreground on its light surface.',
);

const tooltipTextRule = styleSource.match(
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip-head > span\s*\{([\s\S]*?)\}/,
);
assert.ok(tooltipTextRule, 'Load Balance tooltip date text must have an explicit route-scoped color.');
assert.match(
  tooltipTextRule[1],
  /color:\s*var\(--load-profile-muted\)\s*;/,
  'Load Balance tooltip date text must remain readable against the light tooltip background.',
);
assert.match(
  generatedStyleSource,
  /\.analysis-insight-detail-page\.is-load-balance \.analysis-load-command-chart-tooltip-head > span\s*\{[^}]*color:\s*var\(--load-profile-muted\)\s*;/,
  'The generated compatibility stylesheet must preserve the muted Load Balance tooltip date color.',
);

assert.match(
  insightSource,
  /analysis-load-command-chart-tooltip-metric is-acute[\s\S]*?load_chart_acute_short[\s\S]*?Math\.round\(loadScrubber\.acute\)/,
  'The acute tooltip row must render its shared label and current value.',
);
assert.match(
  insightSource,
  /analysis-load-command-chart-tooltip-metric is-chronic[\s\S]*?load_chart_chronic_short[\s\S]*?Math\.round\(loadScrubber\.chronic\)/,
  'The chronic tooltip row must render its shared label and current value.',
);

console.log('[PASS] Load Balance chart interaction guardrails passed.');
