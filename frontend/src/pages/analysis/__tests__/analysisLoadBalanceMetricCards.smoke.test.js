import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (relativePath) => fs.readFileSync(path.join(here, relativePath), 'utf8');

const source = read('../AnalysisInsightDetail.jsx');
const zhLocale = read('../../../i18n/locales/zh-CN/pages.js');
const enLocale = read('../../../i18n/locales/en/pages.js');
const styles = read('../../../styles/analysis-load-balance-profile-alignment.css');
const sharedGlassStyles = read('../../../styles/all-pages-liquid-glass.css');

const failures = [];
const requireCondition = (condition, message) => {
  if (!condition) failures.push(message);
};
const requirePattern = (value, pattern, message) => {
  requireCondition(pattern.test(value), message);
};

const definitionKeys = [
  'load_metric_acute_7d_definition',
  'load_metric_chronic_28d_definition',
  'load_metric_delta_definition',
  'load_metric_injury_definition',
];

const expectedDefinitionValues = {
  'zh-CN': {
    load_metric_acute_7d_definition: '近7天训练压力',
    load_metric_chronic_28d_definition: '近28天训练基准',
    load_metric_delta_definition: '近期负荷与基准的差距',
    load_metric_injury_definition: '估算伤病风险信号',
  },
  en: {
    load_metric_acute_7d_definition: 'Training stress from the last 7 days',
    load_metric_chronic_28d_definition: 'Longer-term training baseline',
    load_metric_delta_definition: 'Recent load compared with baseline',
    load_metric_injury_definition: 'Estimated injury-risk signal',
  },
};

const metricModelMatch = source.match(/metricCards:\s*\[[\s\S]*?\n\s*\],\s*\n\s*judgmentKicker:/);
const metricModel = metricModelMatch?.[0] || '';
requireCondition(Boolean(metricModelMatch), 'load metric model should remain addressable');

const metricCardLabels = metricModel.match(/label:\s*t\('analysisInsight\.[^']+'\)/g) || [];
requireCondition(metricCardLabels.length === 4, `load metric model should contain exactly four cards (found ${metricCardLabels.length})`);

const definitionCalls = metricModel.match(/definition:\s*t\(['"][^'"]+['"]\)/g) || [];
requireCondition(definitionCalls.length === 4, `load metric model should contain exactly four definition calls (found ${definitionCalls.length})`);
for (const key of definitionKeys) {
  requirePattern(
    metricModel,
    new RegExp(`definition:\\s*t\\('analysisInsight\\.${key}'\\)`),
    `load metric model should define ${key}`,
  );
}

const metricCardFor = (labelKey) => {
  const cardMatch = metricModel.match(
    new RegExp(`\\{\\s*label: t\\('analysisInsight\\.${labelKey}'\\),[\\s\\S]*?\\n\\s*\\},`),
  );
  return cardMatch?.[0] || '';
};

for (const contract of [
  {
    labelKey: 'load_metric_acute_7d',
    detail: "detail: `${acuteDeltaPct >= 0 ? '+' : ''}${acuteDeltaPct}% ${t('analysisInsight.load_metric_vs_prior')}`",
    tone: "tone: 'accent'",
  },
  {
    labelKey: 'load_metric_chronic_28d',
    detail: "detail: t('analysisInsight.load_metric_baseline')",
    tone: "tone: 'muted'",
  },
  {
    labelKey: 'load_metric_delta',
    detail: "detail: t('analysisInsight.load_metric_delta_desc')",
    tone: "tone: loadDelta > 40 ? 'risk' : loadDelta > 10 ? 'watch' : 'muted'",
  },
  {
    labelKey: 'load_metric_injury',
    detail: "detail: t(`analysis.stitch_injury_${snapshot.injury?.level || 'low'}`)",
    tone: "tone: snapshot.injury?.level === 'high' ? 'risk' : snapshot.injury?.level === 'moderate' ? 'watch' : 'accent'",
  },
]) {
  const card = metricCardFor(contract.labelKey);
  requireCondition(Boolean(card), `${contract.labelKey} metric card should remain addressable`);
  if (card) {
    requireCondition(card.includes(contract.detail), `${contract.labelKey} card should retain its detail expression`);
    requireCondition(card.includes(contract.tone), `${contract.labelKey} card should retain its tone mapping`);
  }
}

requirePattern(source, /Math\.round\(acute\)\.toString\(\)/, 'acute metric value expression should remain present');
requirePattern(source, /Math\.round\(chronic\)\.toString\(\)/, 'chronic metric value expression should remain present');
requirePattern(source, /Math\.round\(loadDelta\)/, 'load delta value expression should remain present');
requireCondition(
  source.includes("injuryScore != null ? `${injuryScore}` : '--'"),
  'injury metric value expression should remain present',
);

const metricRenderStart = source.indexOf('{loadDashboard.metricCards.map((metric) => (');
const metricRenderEnd = metricRenderStart >= 0 ? source.indexOf('</section>', metricRenderStart) : -1;
const metricRenderAddressable = metricRenderStart >= 0 && metricRenderEnd > metricRenderStart;
requireCondition(metricRenderAddressable, 'mapped load metric card render should remain addressable');
const metricRender = metricRenderAddressable ? source.slice(metricRenderStart, metricRenderEnd) : '';

if (metricRenderAddressable) {
  requirePattern(
    metricRender,
    /loadDashboard\.metricCards\.map\(\(metric\) => \(/,
    'mapped render should iterate over loadDashboard.metricCards',
  );
  requirePattern(
    metricRender,
    /<article\b[^>]*analysis-load-command-metric-card[^>]*>/,
    'mapped render should keep the metric card article wrapper',
  );
  for (const className of [
    'analysis-load-command-metric-card-label',
    'analysis-load-command-metric-card-definition',
    'analysis-load-command-metric-card-detail',
  ]) {
    requirePattern(metricRender, new RegExp(className), `mapped load metric render should contain ${className}`);
  }
  requirePattern(metricRender, /\{metric\.definition\}/, 'mapped load metric render should display metric definitions');
}

for (const [localeName, locale] of [['zh-CN', zhLocale], ['en', enLocale]]) {
  for (const key of definitionKeys) {
    const localeEntry = locale.match(new RegExp(`['"]${key}['"]\\s*:\\s*(?:"([^"]*)"|'([^']*)')`));
    const value = localeEntry?.[1] ?? localeEntry?.[2] ?? '';
    requireCondition(Boolean(value.trim()), `${localeName} locale should define a non-empty ${key}`);
    requireCondition(
      value === expectedDefinitionValues[localeName][key],
      `${localeName} locale ${key} should equal ${JSON.stringify(expectedDefinitionValues[localeName][key])}`,
    );
  }
}

const definitionStyleMatch = styles.match(
  /(?:^|\n)[^{}]*\.analysis-load-command-metric-card-definition(?![-\w])[^{}]*\{[^{}]*\}/,
);
requireCondition(Boolean(definitionStyleMatch), 'load-balance profile CSS should own a metric definition rule');

requirePattern(
  styles,
  /body #root \.analysis-insight-detail-page\.is-load-balance \.analysis-profile-v2--load \.analysis-load-command-metric-card\s*\{[^{}]*display:\s*grid;[^{}]*grid-template-rows:\s*auto auto auto 1fr;/s,
  'load-balance metric cards should reserve the same label, definition, value, and detail rows',
);

requireCondition(
  !/\.analysis-load-command-metric-card(?![-\w])[^{}]*:{1,2}before\b/.test(styles),
  'load-balance profile CSS should not use a metric-card :before/::before layer, including hover or descendant selectors',
);

for (const className of [
  'analysis-load-command-metric-card-label',
  'analysis-load-command-metric-card-definition',
  'analysis-load-command-metric-card-detail',
]) {
  requirePattern(
    sharedGlassStyles,
    new RegExp(`\\.${className}[^,}]*[,}]`),
    `shared liquid-glass cleanup should keep ${className} on the parent card surface`,
  );
}

if (failures.length > 0) {
  assert.fail([
    `Load Balance metric card source contract has ${failures.length} failure(s):`,
    ...failures.map((failure) => `- ${failure}`),
  ].join('\n'));
}

console.log('[PASS] Load Balance metric card source contract is present.');
