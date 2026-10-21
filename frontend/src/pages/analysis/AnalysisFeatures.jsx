import { lazy, useMemo } from 'react';
import { useSearchParams } from 'react-router';
import InlineFeatureSection from '../../components/InlineFeatureSection';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { buildMetricTrend, METRICS, RUN_SETS, RANGES, LINES, DEFAULT_METRIC, DEFAULT_RUN_SET, DEFAULT_RANGE, DEFAULT_LINE } from '../../utils/metricTrend';
import { metricWords } from '../../utils/metricTrendWords';
import { formatPaceSeconds } from '../../utils/format';
import { paceForUnit, windowOf } from '../../utils/paceCurveChart';
import usePaceCurve from './usePaceCurve';

const Vo2maxEstimates = lazy(() => import('./Vo2maxEstimates'));
const MetricTrend = lazy(() => import('./MetricTrend'));
const PaceCurve = lazy(() => import('./PaceCurve'));

export default function AnalysisFeatures({ runs, vo2Value }) {
  const { t, lang, formatNumber } = useI18n();
  const { unit } = useUnit();
  const [params] = useSearchParams();
  const pick = (key, options, fallback) => options.includes(params.get(key)) ? params.get(key) : fallback;
  const metric = pick('metric', METRICS, DEFAULT_METRIC);
  const runSet = pick('runs', RUN_SETS, DEFAULT_RUN_SET);
  const range = pick('range', RANGES.map(item => item.key), DEFAULT_RANGE);
  const line = pick('line', LINES, DEFAULT_LINE);
  const trend = useMemo(() => buildMetricTrend(runs, { metric, runSet, range, line }), [runs, metric, runSet, range, line]);
  const words = metricWords(metric, { unit, lang, t, formatNumber });
  const paceResource = usePaceCurve(windowOf(params.get('days')).key);
  const model = paceResource.data?.model;
  const criticalPace = ['ok', 'rough'].includes(model?.status) && model.criticalPaceSecondsPerKm > 0
    ? `${formatPaceSeconds(paceForUnit(model.criticalPaceSecondsPerKm, unit))} ${t(unit === 'mile' ? 'trends.unit_pace_mile' : 'trends.unit_pace_km')}` : '—';
  return (
    <section className="analysis-deeper" aria-labelledby="analysis-deeper-title">
      <div className="analysis-deeper__head">
        <h2 id="analysis-deeper-title">{t('analysis.v3_deeper_title')}</h2>
        <p>{t('analysis.v3_deeper_basis')}</p>
      </div>
      <div className="analysis-inline-features">
      <InlineFeatureSection id="vo2max-estimates" title={t('vo2max_estimates.title')} description={t('analysis.v3_vo2_subtitle')} summaryValue={vo2Value > 0 ? vo2Value.toFixed(1) : '—'} defaultExpanded>
        <Vo2maxEstimates runs={runs} showHeader={false} compact />
      </InlineFeatureSection>
      <InlineFeatureSection id="analysis-trends" title={t('trends.title')} description={t('analysis.v3_trends_subtitle')} summaryValue={trend.stats ? words.value(trend.stats.median) : '—'}>
        <MetricTrend runs={runs} showHeader={false} />
      </InlineFeatureSection>
      <InlineFeatureSection id="pace-curve" title={t('pace_curve.title')} description={t('analysis.v3_curve_subtitle')} summaryValue={criticalPace}>
        <PaceCurve showHeader={false} resource={paceResource} />
      </InlineFeatureSection>
      </div>
    </section>
  );
}
