import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { useI18n } from '../../contexts/I18nContext';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import AppIcon from '../../components/AppIcon';
import useChartWidth from '../../hooks/useChartWidth';
import { buildIntervalModel, intervalSavePayload, intervalUnitValues, validateIntervalDraft, validateIntervalResponse } from './intervalAnalysisModel';
import './RunIntervalAnalysis.css';

const BASE_KINDS = ['work', 'recovery', 'unknown'];

export function intervalRowsCsv(rows) {
  const fields = [['segment', 'index'], ['label', 'label'], ['classification', 'kind'], ['start_seconds', 'startSeconds'], ['end_seconds', 'endSeconds'], ['distance_meters', 'distanceMeters'], ['duration_seconds', 'durationSeconds'], ['pace_seconds_per_km', 'paceSecPerKm'], ['average_heart_rate', 'averageHeartRate'], ['hr_coverage_seconds', 'hrCoverageSeconds'], ['classification_source', 'provenance'], ['measurement_source', 'measurementProvenance']];
  const cell = value => {
    if (value == null) return '';
    const text = typeof value === 'string' && /^[=+\-@\t\r]/.test(value) ? `'${value}` : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
  };
  return [fields.map(([header]) => header).join(','), ...rows.map(row => fields.map(([, key]) => cell(row[key])).join(','))].join('\r\n');
}

function IntervalChart({ model, axis, showHr, t, time, pace, hr, activeId, setActiveId }) {
  const [chartRef, width] = useChartWidth(1000);
  const patternId = useId().replaceAll(':', '');
  const plotWidth = width;
  const paceValues = model.segments.map((row) => row.paceSecPerKm).filter((value) => value > 0);
  const maxSpeed = paceValues.length ? Math.max(...paceValues.map((value) => 1000 / value)) : 1;
  const heartRates = model.segments.map((row) => row.averageHeartRate).filter((value) => value != null);
  const minHr = heartRates.length ? Math.min(...heartRates) : 0;
  const maxHr = heartRates.length ? Math.max(...heartRates) : 0;
  const baseline = 190;
  const height = 216;
  const extent = model.extentSeconds || 1;
  const position = (row) => axis === 'elapsed'
    ? { x: (row.startSeconds || 0) / extent * plotWidth, width: Math.max(0, (row.endSeconds || 0) - (row.startSeconds || 0)) / extent * plotWidth }
    : { x: (row.index - 1) / Math.max(1, model.segments.length) * plotWidth, width: plotWidth / Math.max(1, model.segments.length) };
  const active = model.segments.find(row => row.id === activeId);
  const legendKinds = [...BASE_KINDS, ...(model.warmupCooldownSummary.count ? ['warmupCooldown'] : [])];
  const tickFractions = [0, 0.25, 0.5, 0.75, 1];
  const ticks = axis === 'elapsed'
    ? tickFractions.map(fraction => ({ x: fraction * plotWidth, label: time(fraction * extent), anchor: fraction === 1 ? 'end' : fraction === 0 ? 'start' : 'middle' }))
    : model.segments.length ? [...new Set(tickFractions.map(fraction => Math.round(fraction * (model.segments.length - 1))))]
      .map(index => ({ x: (index + .5) / model.segments.length * plotWidth, label: String(index + 1), anchor: 'middle' })) : [];
  return (
    <div className="run-interval__chart" ref={chartRef}>
      <svg viewBox={`0 0 ${width} ${height}`} role="group" aria-label={t('interval_analytics.chart')}>
        <defs><pattern id={patternId} width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" fill="var(--interval-unknown-soft)" /><rect width="3" height="7" fill="var(--interval-unknown)" /></pattern></defs>
        <line x1="0" x2={plotWidth} y1={baseline} y2={baseline} className="run-interval__baseline" />
        {model.segments.filter((row) => axis !== 'elapsed' || row.hasElapsedPlacement).map((row) => {
                const { x, width } = position(row);
                const barHeight = row.paceSecPerKm ? (1000 / row.paceSecPerKm) / maxSpeed * 145 : 8;
                const title = `${row.index} · ${row.label || t(`interval_analytics.${row.kind}`)} · ${time(row.startSeconds)}–${time(row.endSeconds)} · ${pace(row.paceSecPerKm)} · ${t('interval_analytics.hr')}: ${hr(row.averageHeartRate)}`;
                return (
                  <g key={row.id} role="button" tabIndex="0" aria-label={title} onMouseEnter={() => setActiveId(row.id)} onMouseLeave={() => setActiveId(null)} onFocus={() => setActiveId(row.id)} onBlur={() => setActiveId(null)} onClick={() => setActiveId(row.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setActiveId(row.id); } }}>
                    <rect data-segment-kind={row.kind} x={x + Math.min(1, width / 4)} y={baseline - barHeight} width={Math.max(0.1, width - Math.min(2, width / 2))} height={barHeight} rx="4" className={`run-interval__bar is-${row.kind}${row.paceSecPerKm == null ? ' is-unmeasured' : ''}${activeId === row.id ? ' is-active' : ''}`} style={row.kind === 'unknown' ? { fill: `url(#${patternId})` } : undefined}>
                      <title>{title}</title>
                    </rect>
                    {showHr && row.averageHeartRate != null ? (
                      <circle data-recorded-hr={row.averageHeartRate} cx={x + width / 2} cy={72 - (maxHr > minHr ? (row.averageHeartRate - minHr) / (maxHr - minHr) : .5) * 58} r="3.5" className="run-interval__hr-point">
                        <title>{`${t('interval_analytics.hr')}: ${hr(row.averageHeartRate)}`}</title>
                      </circle>
                    ) : null}
                  </g>
                );
        })}
        {ticks.map((tick) => (
          <text key={tick.x} x={tick.x} y={height - 5} textAnchor={tick.anchor} className="run-interval__tick">
            {tick.label}
          </text>
        ))}
      </svg>
      {active ? <div className="run-interval__tooltip" role="status"><strong>{active.label || t(`interval_analytics.${active.kind}`)}</strong><span>{time(active.startSeconds)}–{time(active.endSeconds)} · {pace(active.paceSecPerKm)} · {hr(active.averageHeartRate)}</span></div> : null}
      <div className="run-interval__legend">
        {legendKinds.map(kind => <span key={kind}><i className={`is-${kind}`} />{t(`interval_analytics.${kind}`)}</span>)}
        {showHr && heartRates.length ? <span className="run-interval__hr-legend">{t('interval_analytics.hrScaleShort', { min: Math.round(minHr), max: Math.round(maxHr) })}</span> : null}
        <span className="run-interval__legend-hint">{t('interval_analytics.tallerFaster')}</span>
      </div>
    </div>
  );
}

function IntervalAnalysisContent({ activityId, unitPreference = 'metric', refreshToken = 0, onAnalysisSaved }) {
  const { t, lang } = useI18n();
  const titleId = useId();
  const [units, setUnits] = useState(unitPreference === 'imperial' || unitPreference === 'mi' || unitPreference === 'mile' ? 'imperial' : 'metric');
  const [axis, setAxis] = useState('elapsed');
  const [showHr, setShowHr] = useState(true);
  const [showSources, setShowSources] = useState(false);
  const [activeId, setActiveId] = useState(null);
  const [result, setResult] = useState({ status: 'loading', data: null });
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [validation, setValidation] = useState([]);
  const [saveStatus, setSaveStatus] = useState('idle');
  const saveController = useRef(null);
  const mutationGeneration = useRef(0);
  const nextId = useRef(0);
  const url = `/api/activities/${encodeURIComponent(activityId)}/session-analysis`;
  const model = useMemo(() => buildIntervalModel(result.data || {}), [result.data]);

  useEffect(() => {
    const controller = new AbortController();
    const readGeneration = mutationGeneration.current;
    const isCurrentRead = () => !controller.signal.aborted && readGeneration === mutationGeneration.current;
    setResult({ status: 'loading', data: null });
    apiJson(url, { signal: controller.signal }).then((data) => {
      if (!isCurrentRead()) return;
      const validated = validateIntervalResponse(data, activityId);
      setResult({ status: 'ready', data: validated });
    }).catch(() => {
      if (isCurrentRead()) setResult({ status: 'error', data: null });
    });
    return () => controller.abort();
  }, [url, activityId, refreshToken, retry]);

  useEffect(() => () => saveController.current?.abort(), []);

  const number = (value, digits = 0) => new Intl.NumberFormat(lang === 'zh-CN' ? 'zh-CN' : 'en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(value);
  const unavailable = t('interval_analytics.unavailable');
  const time = (value) => value == null ? unavailable : formatDuration(value);
  const distance = (meters) => {
    const converted = intervalUnitValues({ distanceMeters: meters }, units);
    return converted.distance == null ? unavailable : `${number(converted.distance, 3)} ${converted.distanceUnit}`;
  };
  const pace = (seconds) => {
    const converted = intervalUnitValues({ paceSecPerKm: seconds }, units);
    return converted.paceSeconds == null ? unavailable : `${formatPaceSeconds(converted.paceSeconds)} ${converted.paceUnit}`;
  };
  const hr = (value) => value == null ? unavailable : `${number(value)} ${t('interval_analytics.hrUnit')}`;
  const coverage = (row) => `${time(row.hrCoverageSeconds)} / ${time(row.elapsedSeconds)}${row.hrCoverageFraction == null ? '' : ` (${number(row.hrCoverageFraction * 100)}%)`}`;
  const coveragePercent = row => row.hrCoverageFraction == null ? unavailable : `${number(row.hrCoverageFraction * 100)}%`;
  const provenance = (value) => t(`interval_analytics.${({ 'auto-detected': 'autoDetected', imported: 'imported', 'runner-declared': 'runnerDeclared', declared: 'runnerDeclared', unknown: 'unknown', 'source-lap': 'sourceLap', 'source-summary': 'sourceSummary', 'derived-stream': 'derivedStream', 'source-telemetry': 'telemetry', telemetry: 'telemetry', 'telemetry-boundaries': 'telemetry', derived: 'derived' })[value] || 'unavailable'}`);
  const exportRows = () => {
    const url = URL.createObjectURL(new Blob(['\uFEFF', intervalRowsCsv(model.segments)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `session-${activityId}-intervals.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  const edit = () => {
    setDraft(model.segments.map((row) => ({ id: row.id, kind: row.kind, startSeconds: row.startSeconds ?? '', endSeconds: row.endSeconds ?? '', label: row.label || '', targetPaceSecondsPerKm: row.targetPaceSecondsPerKm })));
    setValidation([]);
    setSaveStatus('idle');
    setEditing(true);
  };
  const update = (index, key, value) => {
    setDraft((rows) => rows.map((row, position) => position === index ? { ...row, [key]: value } : row));
    setValidation([]);
    setSaveStatus('idle');
  };
  const add = () => {
    const lastEnd = Number(draft.at(-1)?.endSeconds || 0);
    const sourceEnd = Math.floor(model.extentSeconds);
    let id;
    do { nextId.current += 1; id = `declared-${nextId.current}`; } while (draft.some((row) => row.id === id));
    setDraft((rows) => [...rows, { id, kind: 'unknown', startSeconds: lastEnd, endSeconds: sourceEnd > lastEnd ? sourceEnd : '', label: '', targetPaceSecondsPerKm: null }]);
    setValidation([]);
  };
  const save = async (event) => {
    event.preventDefault();
    if (saveStatus === 'saving') return;
    const errors = validateIntervalDraft(draft, model.extentSeconds);
    setValidation(errors);
    if (errors.length) return;
    const controller = new AbortController();
    // Edit is usable after PUT, so a later save must retire the earlier reload too.
    saveController.current?.abort();
    saveController.current = controller;
    const isCurrentSave = () => !controller.signal.aborted && saveController.current === controller;
    setSaveStatus('saving');
    let saved;
    try {
      saved = validateIntervalResponse(await apiJson(url, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(intervalSavePayload(draft)), signal: controller.signal,
      }), activityId);
    } catch {
      if (isCurrentSave()) setSaveStatus('error');
      return;
    }
    if (!isCurrentSave()) return;
    // Reads dispatched before this authoritative PUT cannot install data or errors.
    mutationGeneration.current += 1;
    setEditing(false);
    setResult({ status: 'ready', data: saved });
    setSaveStatus('saved');
    try {
      const reloaded = validateIntervalResponse(await apiJson(url, { signal: controller.signal }), activityId);
      if (!isCurrentSave()) return;
      setResult({ status: 'ready', data: reloaded });
      saved = reloaded;
    } catch {
      if (!isCurrentSave()) return;
      setSaveStatus('reloadError');
    }
    onAnalysisSaved?.(saved);
  };

  const hasTargets = model.segments.some((row) => row.targetPaceSecondsPerKm != null);
  const timerFallback = result.data?.source?.elapsedDurationSeconds == null;
  const missingPlacementCount = model.segments.filter((row) => !row.hasElapsedPlacement).length;
  const rules = result.data?.measurementRules;
  const hasIntegrationRule = rules?.heartRateIntegration === 'trapezoid-adjacent-valid-endpoints'
    && typeof rules.maximumIntegratedGapSeconds === 'number' && Number.isFinite(rules.maximumIntegratedGapSeconds) && rules.maximumIntegratedGapSeconds > 0;
  return (
    <section id="run-detail-intervals" className="run-detail-v2__card run-interval" aria-labelledby={titleId} aria-busy={result.status === 'loading' || saveStatus === 'saving'}>
      <header className="run-interval__head">
        <div><h2 id={titleId}>{t('interval_analytics.title')}</h2><p>{t('interval_analytics.subtitle')}</p></div>
        {result.data ? <button type="button" className="run-interval__edit-button" onClick={edit} disabled={editing || saveStatus === 'saving'}><AppIcon name="edit" />{t('interval_analytics.edit')}</button> : null}
      </header>
      {result.status === 'loading' ? <p role="status">{t('interval_analytics.loading')}</p> : null}
      {result.status === 'error' ? <div><p role="alert">{t('interval_analytics.error')}</p><button type="button" onClick={() => setRetry((value) => value + 1)}>{t('interval_analytics.retry')}</button></div> : null}
      {saveStatus === 'saved' ? <p role="status">{t('interval_analytics.saved')}</p> : null}
      {saveStatus === 'reloadError' ? <p role="alert">{t('interval_analytics.reloadError')} <button type="button" onClick={() => { setSaveStatus('idle'); setRetry((value) => value + 1); }}>{t('interval_analytics.retry')}</button></p> : null}
      {result.data ? (
        <>
          {model.segments.some(row => row.provenance === 'auto-detected') ? <p className="run-interval__notice">{t('interval_analytics.detectionNote')}</p> : null}
          <div className="run-interval__source">
            <h3 className="run-interval__sr-only">{t('interval_analytics.sourceTotals')}</h3>
            <dl>{[['distance', distance(model.sourceTotals.distanceMeters)], ['duration', time(model.sourceTotals.durationSeconds)], ['elapsed', time(model.sourceTotals.elapsedDurationSeconds)], ['moving', time(model.sourceTotals.movingTimeSeconds)]].map(([key, value]) => <div key={key}><dt>{t(`interval_analytics.${key}`)}</dt><dd>{value}</dd></div>)}</dl>
            {timerFallback ? <p>{t('interval_analytics.timerFallback')}</p> : null}
          </div>
          <div className="run-interval__controls">
            <div role="group" aria-label={t('interval_analytics.axis')}>
              {['elapsed', 'rep'].map((value) => <button type="button" key={value} aria-pressed={axis === value} onClick={() => setAxis(value)}>{t(`interval_analytics.${value === 'elapsed' ? timerFallback ? 'timerAxis' : 'elapsedAxis' : 'repAxis'}`)}</button>)}
            </div>
            <div role="group" aria-label={t('interval_analytics.units')}>
              {['metric', 'imperial'].map((value) => <button type="button" key={value} aria-pressed={units === value} onClick={() => setUnits(value)}>{value === 'metric' ? 'km' : 'mi'}</button>)}
            </div>
            <label className="run-interval__hr-toggle"><input type="checkbox" checked={showHr} onChange={(event) => setShowHr(event.target.checked)} />{t('interval_analytics.showHr')}</label>
            <button type="button" disabled={!model.segments.length} onClick={exportRows}>{t('training_integration.export_intervals')}</button>
          </div>
          {missingPlacementCount ? <p className="run-interval__note">{t('interval_analytics.missingPlacement', { count: missingPlacementCount })}</p> : null}
          {model.segments.length ? (
            <>
              <IntervalChart model={model} axis={axis} showHr={showHr} t={t} time={time} pace={pace} hr={hr} activeId={activeId} setActiveId={setActiveId} />
              <div className="run-interval__summaries">
                {[...BASE_KINDS, ...(model.warmupCooldownSummary.count ? ['warmupCooldown'] : [])].map((kind) => {
                  const row = kind === 'warmupCooldown' ? model.warmupCooldownSummary : model.summary[kind];
                  return <div key={kind} className={`is-${kind}`}><h3>{t(`interval_analytics.${kind}`)} <small>{t('interval_analytics.segmentCount', { count: row.count })}</small></h3>
                    <strong className="run-interval__summary-pace">{pace(row.paceSecPerKm)}</strong>
                    <p>{distance(row.distanceMeters)} · {time(row.durationSeconds)}</p>
                    <p>{hr(row.averageHeartRate)} · {coveragePercent(row)} {t('interval_analytics.coverage')}</p>
                    <p className={row.paceIsPartial ? 'run-interval__partial' : 'run-interval__sr-only'}>{t(`interval_analytics.${row.paceIsPartial ? 'pacePartialCoverage' : 'paceCoverage'}`, { count: row.paceSegmentCount, total: row.count })}</p>
                    <span className="run-interval__sr-only">{t('interval_analytics.elapsed')}: {time(row.elapsedSeconds)} · {coverage(row)}</span>
                  </div>;
                })}
              </div>
              <div className="run-interval__table-head"><span>{t('interval_analytics.segments')}</span><button type="button" aria-expanded={showSources} onClick={() => setShowSources(value => !value)}>{t(`interval_analytics.${showSources ? 'hideSources' : 'showSources'}`)}</button></div>
              <div className="run-interval__table-wrap" tabIndex="0" role="region" aria-label={t('interval_analytics.table')}>
                <table aria-label={t('interval_analytics.table')}><thead><tr>{['segment', 'classification', 'boundaries', 'distance', 'duration', 'pace', 'hr', 'coverage', ...(hasTargets ? ['target'] : []), ...(showSources ? ['elapsed', 'provenance', 'measurementSource'] : [])].map((key) => <th key={key} scope="col">{t(`interval_analytics.${key}`)}</th>)}</tr></thead>
                  <tbody>{model.segments.map((row) => <tr key={row.id} className={activeId === row.id ? 'is-active' : ''} onMouseEnter={() => setActiveId(row.id)} onMouseLeave={() => setActiveId(null)}>
                    <th scope="row">{row.index}</th><td><span className={`run-interval__kind is-${row.kind}`}>{row.label || t(`interval_analytics.${row.kind}`)}{row.label ? <span className="run-interval__sr-only"> · {t(`interval_analytics.${row.kind}`)}</span> : null}</span></td>
                    <td>{time(row.startSeconds)}–{time(row.endSeconds)}</td><td>{distance(row.distanceMeters)}</td><td>{time(row.durationSeconds)}</td><td className="run-interval__table-pace">{pace(row.paceSecPerKm)}</td><td>{hr(row.averageHeartRate)}</td><td>{coveragePercent(row)}<span className="run-interval__sr-only"> · {coverage(row)}</span></td>
                    {hasTargets ? <td>{pace(row.targetPaceSecondsPerKm)}</td> : null}{showSources ? <><td>{time(row.elapsedSeconds)}</td><td>{provenance(row.provenance)}</td><td>{provenance(row.measurementProvenance)}</td></> : null}
                  </tr>)}</tbody></table>
              </div>
            </>
          ) : <p>{t('interval_analytics.empty')}</p>}
          {model.unassignedSeconds == null || model.unassignedSeconds > 0 ? <p className="run-interval__gap">{t('interval_analytics.gap', { time: time(model.unassignedSeconds) })}</p> : null}
          <details className="run-interval__details"><summary>{t('interval_analytics.howMeasured')}</summary>
            <p>{t('interval_analytics.chartNote')}</p><p>{t('interval_analytics.sourceNote')}</p>
            <p>{t('interval_analytics.basisNote')}</p>
            <p>{hasIntegrationRule ? t('interval_analytics.integrationRule', { seconds: rules.maximumIntegratedGapSeconds }) : t('interval_analytics.integrationUnavailable')}</p>
          </details>
        </>
      ) : null}
      {editing ? <form className="run-interval__editor" onSubmit={save} aria-label={t('interval_analytics.editor')}>
        <h3>{t('interval_analytics.editor')}</h3><p>{t('interval_analytics.editNote')}</p><p role="status">{t('interval_analytics.unsaved')}</p>
        {validation.length ? <p role="alert">{validation.map((error) => t(`interval_analytics.${error}`)).join(' · ')}</p> : null}
        {saveStatus === 'error' ? <p role="alert">{t('interval_analytics.saveError')}</p> : null}
        <fieldset disabled={saveStatus === 'saving'}><legend className="run-interval__sr-only">{t('interval_analytics.editor')}</legend>
          {draft.map((row, index) => <div key={row.id} className="run-interval__edit-row">
            <span>{index + 1}</span>
            {['startSeconds', 'endSeconds'].map((key) => <label key={key}><span>{t(`interval_analytics.${key}`, { index: index + 1 })}</span><input type="number" min="0" step="1" value={row[key]} onChange={(event) => update(index, key, event.target.value)} /></label>)}
            <label><span>{t('interval_analytics.classificationInput', { index: index + 1 })}</span><select value={row.kind} onChange={(event) => update(index, 'kind', event.target.value)}>{[...BASE_KINDS, 'warmup', 'cooldown'].map((kind) => <option key={kind} value={kind}>{t(`interval_analytics.${kind}`)}</option>)}</select></label>
            <label><span>{t('interval_analytics.labelInput', { index: index + 1 })}</span><input type="text" maxLength="160" value={row.label} onChange={(event) => update(index, 'label', event.target.value)} /></label>
            <button type="button" aria-label={t('interval_analytics.remove', { index: index + 1 })} onClick={() => { setDraft((rows) => rows.filter((_, position) => position !== index)); setValidation([]); }}>×</button>
          </div>)}
          <div className="run-interval__editor-actions"><button type="button" onClick={add} disabled={draft.length >= 200}>{t('interval_analytics.add')}</button><button type="submit" disabled={!result.data}>{t(`interval_analytics.${saveStatus === 'saving' ? 'saving' : 'save'}`)}</button><button type="button" onClick={() => setEditing(false)}>{t('interval_analytics.cancel')}</button></div>
        </fieldset>
      </form> : null}
    </section>
  );
}

/** Authentication is supplied by apiJson. Keyed identity prevents cross-activity data/draft leakage. */
export default function RunIntervalAnalysis(props) {
  return <IntervalAnalysisContent key={`${props.activityId}:${props.token || ''}`} {...props} />;
}
