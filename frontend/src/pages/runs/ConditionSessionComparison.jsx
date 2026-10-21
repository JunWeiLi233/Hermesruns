import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { useI18n } from '../../contexts/I18nContext';
import { formatDuration, formatPaceSeconds } from '../../utils/format';
import { formatActivityTime, getActivityDateKey } from '../../utils/timeZone';
import AppIcon from '../../components/AppIcon';
import useChartWidth from '../../hooks/useChartWidth';
import en from '../../i18n/locales/en/conditionComparison';
import zhCN from '../../i18n/locales/zh-CN/conditionComparison';
import { COMPARISON_DIMENSIONS, DECLARATION_DIMENSIONS, compareSessions, conditionValue, defaultDetectedWorkIds, distanceInUnit, normalizeSessionAnalysis, paceInUnit, progressionPoints } from './conditionComparisonModel';
import './ConditionSessionComparison.css';

const RECENT_LIMIT = 20;
const REQUEST_CONCURRENCY = 3;
const requestPath = id => `/api/activities/${encodeURIComponent(id)}/session-analysis`;
const missing = '—';

function ComparisonChart({ rows, unit, copy, scatter = false, lang, referenceId }) {
  const [chartRef, width] = useChartWidth(720);
  const points = scatter ? rows.filter(row => row.included && row.paceSecondsPerKm != null && row.averageHeartRate != null) : progressionPoints(rows);
  const hiddenCount = rows.filter(row => row.included && row.paceSecondsPerKm != null && row.averageHeartRate == null).length;
  const paces = points.map(row => paceInUnit(row.paceSecondsPerKm, unit));
  const lowPace = Math.min(...paces), highPace = Math.max(...paces);
  const pad = Math.max((highPace - lowPace) * 0.15, 5);
  const lower = Math.max(1, lowPace - pad), upper = highPace + pad;
  const hrs = points.map(row => row.averageHeartRate).filter(value => value != null);
  const lowHr = Math.min(...hrs) - 2, highHr = Math.max(...hrs) + 2;
  const plotLeft = 44, plotRight = width - 8, plotHeight = 154;
  const x = row => plotLeft + (scatter ? (row.averageHeartRate - lowHr) / (highHr - lowHr) : row.datePosition) * (plotRight - plotLeft);
  const y = row => 24 + (paceInUnit(row.paceSecondsPerKm, unit) - lower) / (upper - lower) * plotHeight;
  const dateLabel = key => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${key}T00:00:00Z`));
  return <figure className="condition-comparison__figure">
    <figcaption><span>{copy(scatter ? 'scatter' : 'progression')}</span><small>{scatter ? hiddenCount ? copy('pace_only_hidden', { count: hiddenCount }) : '' : copy('faster')}</small></figcaption>
    <div ref={chartRef} className="condition-comparison__plot">{points.length ? <svg viewBox={`0 0 ${width} 224`} role="img" aria-label={copy(scatter ? 'scatter' : 'progression')}>
      {[0, 0.5, 1].map(tick => <g key={tick}>
        <line x1={plotLeft} x2={plotRight} y1={24 + tick * plotHeight} y2={24 + tick * plotHeight} className="condition-comparison__grid" />
        <text x={plotLeft - 8} y={28 + tick * plotHeight} textAnchor="end">{formatPaceSeconds(lower + tick * (upper - lower))}</text>
      </g>)}
      <text x={plotLeft} y="12">{unit === 'mile' ? '/mi' : '/km'}</text>
      {!scatter && points.length > 1 ? <polyline points={points.map(row => `${x(row)},${y(row)}`).join(' ')} className="condition-comparison__line" /> : null}
      {points.map((row) => <g key={row.id}>{row.id === referenceId ? <circle cx={x(row)} cy={y(row)} r="7" className="condition-comparison__reference-ring" /> : null}<circle data-activity-id={row.id} cx={x(row)} cy={y(row)} r="4.5" className={`condition-comparison__dot${row.averageHeartRate == null ? ' is-pace-only' : ''}${row.id === referenceId ? ' is-reference' : ''}`}>
        <title>{row.name} · #{row.id} · {getActivityDateKey(row, row.accountTimeZone) || missing} · {formatPaceSeconds(paceInUnit(row.paceSecondsPerKm, unit))} {unit === 'mile' ? '/mi' : '/km'} · {row.averageHeartRate == null ? copy('pace_only') : `${row.averageHeartRate.toFixed(1)} bpm`}</title>
      </circle></g>)}
      <text x={plotLeft} y="207" textAnchor="start">{scatter ? `${lowHr.toFixed(0)} bpm` : dateLabel(points[0].dateKey)}</text>
      <text x={plotRight} y="207" textAnchor="end">{scatter ? `${highHr.toFixed(0)} bpm` : dateLabel(points.at(-1).dateKey)}</text>
      {scatter && width > 380 ? <text x={(plotLeft + plotRight) / 2} y="207" textAnchor="middle">{copy('hr')}</text> : null}
    </svg> : <p className="condition-comparison__empty-chart">{copy(scatter ? 'no_measured_scatter' : 'empty_chart')}</p>}</div>
  </figure>;
}

// Identity changes remount the request scope, preventing stale owner/activity results.
// External refreshToken changes preserve selection and any unsaved declaration draft.
export default function ConditionSessionComparison(props) {
  return <ComparisonPanel key={`${props.activityId}:${props.token || ''}`} {...props} />;
}

function ComparisonPanel({ activityId, recentRuns = [], currentRun, unitPreference = 'km', refreshToken = 0, onAnalysisSaved }) {
  const { t, lang = 'en' } = useI18n();
  const titleId = useId();
  const contentId = useId();
  const [collapsed, setCollapsed] = useState(false);
  const dictionary = (lang === 'zh-CN' ? zhCN : en).condition_comparison;
  const copy = (key, replacements = {}) => {
    const fullKey = `condition_comparison.${key}`;
    const translated = t(fullKey, replacements);
    const value = translated !== fullKey ? translated : dictionary[key] || fullKey;
    return Object.entries(replacements).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, String(replacement)), value);
  };
  const [unit, setUnit] = useState(['mile', 'mi', 'imperial'].includes(unitPreference) ? 'mile' : 'km');
  const [selectedIds, setSelectedIds] = useState([]);
  const [referenceId, setReferenceId] = useState(String(activityId));
  const [scope, setScope] = useState('whole');
  const [rules, setRules] = useState([]);
  const [segmentSelections, setSegmentSelections] = useState({});
  const [records, setRecords] = useState({});
  const [revision, setRevision] = useState(0);
  const [editor, setEditor] = useState(null);
  const saveController = useRef(null);
  const mutationVersions = useRef(new Map());

  const candidates = useMemo(() => {
    const currentId = String(activityId);
    const other = new Map();
    for (const run of recentRuns) if (run?.id != null && String(run.id) !== currentId && !other.has(String(run.id))) other.set(String(run.id), run);
    const current = currentRun || recentRuns.find(run => String(run.id) === currentId) || { id: activityId };
    return [{ ...current, id: currentId }, ...[...other.values()].slice(0, RECENT_LIMIT).map(run => ({ ...run, id: String(run.id) }))];
  }, [activityId, currentRun, recentRuns]);
  const candidateIds = candidates.map(run => run.id).join('|');
  const wantedKey = [...new Set([String(activityId), referenceId, ...selectedIds])].filter(id => candidates.some(run => run.id === id)).sort().join('|');
  useEffect(() => {
    const controller = new AbortController();
    const wanted = wantedKey.split('|').filter(Boolean);
    setRecords(previous => ({
      ...Object.fromEntries(Object.entries(previous).filter(([, record]) => record.status === 'ready')),
      ...Object.fromEntries(wanted.map(id => [id, { status: 'loading' }])),
    }));
    let next = 0;
    const worker = async () => {
      while (!controller.signal.aborted && next < wanted.length) {
        const id = wanted[next++];
        const readVersion = mutationVersions.current.get(id) || 0;
        try {
          const response = await apiJson(requestPath(id), { method: 'GET', signal: controller.signal });
          // Never display a foreign or malformed envelope as the requested session.
          if (String(response?.activityId) !== id) throw new Error('Activity identity mismatch');
          const normalized = normalizeSessionAnalysis(response);
          if (!controller.signal.aborted && readVersion === (mutationVersions.current.get(id) || 0)) setRecords(previous => ({ ...previous, [id]: { status: 'ready', normalized, response } }));
        } catch (error) {
          if (!controller.signal.aborted && readVersion === (mutationVersions.current.get(id) || 0)) setRecords(previous => ({ ...previous, [id]: { status: 'error', ownership: error.status === 401 || error.status === 403 || error.status === 404 } }));
        }
      }
    };
    Promise.resolve().then(() => {
      if (!controller.signal.aborted) return Promise.all(Array.from({ length: Math.min(REQUEST_CONCURRENCY, wanted.length) }, worker));
    });
    return () => controller.abort();
  }, [activityId, wantedKey, candidateIds, revision, refreshToken]);
  useEffect(() => () => saveController.current?.abort(), []);

  const sessions = candidates.map(run => records[run.id]?.status === 'ready' ? records[run.id].normalized : {
    id: run.id, name: run.name, activityInstant: run.activityInstant, accountTimeZone: run.accountTimeZone,
    accountLocalDate: run.accountLocalDate, accountLocalTime: run.accountLocalTime,
    startTime: run.startTime, startDate: run.startDate, segments: [], conditions: {},
  });
  const rows = compareSessions(sessions, { referenceId, selectedIds, rules, scope, segmentSelections });
  const toggle = (values, value) => values.includes(value) ? values.filter(entry => entry !== value) : [...values, value];
  const name = row => row.name || copy('activity_id', { id: row.id });
  const pace = value => value == null ? missing : `${formatPaceSeconds(paceInUnit(value, unit))} ${unit === 'mile' ? '/mi' : '/km'}`;
  const distance = value => distanceInUnit(value, unit) === null ? missing : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 3 }).format(distanceInUnit(value, unit))} ${unit === 'mile' ? 'mi' : 'km'}`;
  const duration = value => value == null ? missing : formatDuration(value);
  const hr = value => value == null ? copy('no_hr') : `${new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(value)} bpm`;
  const coverage = row => row.elapsedDurationSeconds == null || row.hrCoveragePercent == null ? copy('coverage_unknown') : copy('coverage', {
    covered: new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(row.hrCoverageSeconds),
    elapsed: new Intl.NumberFormat(lang, { maximumFractionDigits: 1 }).format(row.elapsedDurationSeconds), percent: row.hrCoveragePercent.toFixed(1),
  });
  const date = row => formatActivityTime(row, lang, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }, row.accountTimeZone) || copy('unavailable_date');
  const shortDate = row => formatActivityTime(row, lang, { month: 'short', day: 'numeric' }, row.accountTimeZone) || copy('unavailable_date');
  const sourceLabel = value => copy({ 'auto-detected': 'auto_detected', 'runner-declared': 'declared', declared: 'declared', imported: 'imported', recorded: 'recorded', unknown: 'unknown_provenance',
    'source-lap': 'source_lap', 'source-summary': 'source_summary', 'derived-stream': 'source_stream', derived: 'derived', unavailable: 'unavailable_provenance' }[value] || 'unavailable_provenance');
  const reasons = row => row.reasons.map(reason => copy(reason.reason, { dimension: reason.dimension ? copy(reason.dimension) : '' })).join(' · ');
  const startEditor = row => setEditor({ id: row.id, name: name(row), draft: Object.fromEntries(DECLARATION_DIMENSIONS.map(key => [key, records[row.id]?.response.declarations.comparison?.[key] || ''])), changed: [], status: 'draft' });
  const save = async event => {
    event.preventDefault();
    if (!editor || editor.status === 'saving') return;
    const draft = editor;
    if (Object.values(draft.draft).some(value => value.length > 240)) { setEditor(previous => ({ ...previous, status: 'invalid' })); return; }
    const controller = new AbortController();
    saveController.current?.abort(); saveController.current = controller;
    setEditor(previous => ({ ...previous, status: 'saving' }));
    try {
      // Comparison replaces its own object. Refetch and merge only edited dimensions
      // to preserve declarations changed since this editor opened. Never echo segments.
      const latest = await apiJson(requestPath(draft.id), { method: 'GET', signal: controller.signal });
      if (String(latest?.activityId) !== draft.id) throw new Error('Activity identity mismatch');
      normalizeSessionAnalysis(latest);
      const comparison = { ...latest.declarations.comparison };
      for (const key of draft.changed) comparison[key] = draft.draft[key].trim() || null;
      const response = await apiJson(requestPath(draft.id), { method: 'PUT', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ comparison }) });
      if (String(response?.activityId) !== draft.id) throw new Error('Activity identity mismatch');
      const normalized = normalizeSessionAnalysis(response);
      if (controller.signal.aborted) return;
      // A read dispatched before this authoritative PUT cannot replace its row,
      // including when an interval-triggered refresh is already in flight.
      mutationVersions.current.set(draft.id, (mutationVersions.current.get(draft.id) || 0) + 1);
      setRecords(previous => ({ ...previous, [draft.id]: { status: 'ready', normalized, response } }));
      setEditor(previous => previous?.id === draft.id ? { ...previous, status: 'saved', changed: [] } : previous);
      onAnalysisSaved?.(response);
    } catch {
      if (!controller.signal.aborted) setEditor(previous => previous?.id === draft.id ? { ...previous, status: 'error' } : previous);
    }
  };
  const activeRecords = wantedKey.split('|').map(id => records[id]);
  const loading = activeRecords.some(record => record?.status === 'loading');
  const hasError = activeRecords.some(record => record?.status === 'error');
  return <section id="run-detail-condition-comparison" className="condition-comparison" aria-labelledby={titleId} data-collapsed={collapsed}>
    <header className="condition-comparison__header">
      <div><h2 id={titleId}>{copy('title')}</h2><p>{copy('intro')}</p></div>
      <div className="condition-comparison__header-actions"><div className="condition-comparison__units" role="group" aria-label={copy('units')}>
        <button type="button" aria-pressed={unit === 'km'} onClick={() => setUnit('km')}>km</button>
        <button type="button" aria-pressed={unit === 'mile'} onClick={() => setUnit('mile')}>mi</button>
      </div><button type="button" className="condition-comparison__refresh" disabled={loading} aria-label={copy(hasError ? 'retry' : 'refresh')} onClick={() => setRevision(value => value + 1)}><AppIcon name="refresh" /></button><button type="button" className="condition-comparison__fold" aria-label={copy(collapsed ? 'expand_label' : 'collapse_label')} aria-expanded={!collapsed} aria-controls={contentId} onClick={() => setCollapsed(value => !value)}>{copy(collapsed ? 'expand' : 'collapse')}<span aria-hidden="true">{collapsed ? '⌄' : '⌃'}</span></button></div>
    </header>
    <div id={contentId} className="condition-comparison__content" hidden={collapsed}>
    <div className="condition-comparison__controls">
      <label>{copy('reference')}<select aria-label={copy('reference')} value={referenceId} onChange={event => setReferenceId(event.target.value)}>
        {candidates.map(row => <option key={row.id} value={row.id}>{name(row)}{getActivityDateKey(row, row.accountTimeZone) ? ` · ${shortDate(row)}` : ''} · #{row.id}</option>)}
      </select></label>
      <fieldset><legend>{copy('scope')}</legend>{['whole', 'work'].map(value => <label key={value}><input type="radio" name={`${titleId}-scope`} checked={scope === value} onChange={() => setScope(value)} />{copy(value)}</label>)}</fieldset>
    </div>
    <fieldset className="condition-comparison__rules"><legend>{copy('rules')}</legend>
      {COMPARISON_DIMENSIONS.map(key => <label key={key}><input type="checkbox" checked={rules.includes(key)} aria-label={copy('match', { dimension: copy(key) })} onChange={() => setRules(previous => toggle(previous, key))} />{copy(key)}</label>)}
    </fieldset>
    <p className="condition-comparison__basis">{copy(rules.length ? 'matching_basis_short' : 'explicit_basis_short')}</p>
    <div className="condition-comparison__table-head"><span>{copy('sessions')}</span><p role="status" aria-live="polite">{copy('selected_count', { included: rows.filter(row => row.included).length, selected: selectedIds.length })}{loading ? ` · ${copy('loading')}` : ''}</p></div>
    <div className="condition-comparison__table-scroll" role="region" aria-label={copy('title')} tabIndex={0}>
      <table className="condition-comparison__session-table"><caption className="sr-only">{copy('title')}</caption><thead><tr>
        {['include', 'session', 'pace', 'distance', 'hr', 'rpe', 'status'].map(key => <th key={key} scope="col">{key === 'rpe' ? <abbr title={copy('rpe')}>{copy('rpe_short')}</abbr> : copy(key)}</th>)}
      </tr></thead><tbody>{rows.map(row => {
        const record = records[row.id];
        return <tr key={row.id} data-included={row.included} data-selected={selectedIds.includes(row.id)}>
          <td><input type="checkbox" checked={selectedIds.includes(row.id)} aria-label={copy('selection', { name: name(row) })} onChange={() => setSelectedIds(previous => toggle(previous, row.id))} /></td>
          <th scope="row"><span className="condition-comparison__session-name">{name(row)}{row.id === referenceId ? <span className="condition-comparison__reference">{copy('reference_badge')}</span> : null}</span>
            <small className="condition-comparison__session-meta">{shortDate(row)} · <button type="button" disabled={record?.status !== 'ready' || editor?.status === 'saving'} onClick={() => startEditor(row)}>{copy('edit')}</button></small>
            <span className="sr-only">{copy('activity_id', { id: row.id })}{row.id === String(activityId) ? ` · ${copy('current')}` : ''} · {date(row)} · {copy('source_calendar', { zone: row.accountTimeZone || copy('unavailable') })} · {copy('timer')}: {duration(row.durationSeconds)} · {copy('elapsed')}: {duration(row.elapsedDurationSeconds)}</span></th>
          <td className="condition-comparison__pace">{pace(row.paceSecondsPerKm)}</td><td>{distance(row.distanceMeters)}</td>
          <td>{record?.status !== 'ready' ? missing : <>{row.averageHeartRate == null ? <span className="condition-comparison__muted">{copy('pace_only')}</span> : hr(row.averageHeartRate)}<small>{row.hrCoveragePercent == null ? copy('coverage_unknown') : copy('coverage_short', { percent: row.hrCoveragePercent.toFixed(1) })}</small><span className="sr-only">{coverage(row)}</span></>}</td>
          <td>{row.perceivedExertion == null ? <span aria-label={copy('no_rpe')}>{missing}</span> : copy('rpe_value', { value: row.perceivedExertion })}</td>
          <td><span className={`condition-comparison__status${row.included ? ' is-included' : ''}`}>{record?.status === 'error' ? <span role="alert">{copy(record.ownership ? 'ownership_error' : 'load_error')}</span> : record?.status === 'loading' ? copy('loading') : row.included ? copy('included') : `${copy('excluded')} · ${reasons(row)}`}</span></td>
        </tr>;
      })}</tbody></table>
    </div>
    {editor ? <form className="condition-comparison__editor" onSubmit={save}>
      <h3>{copy('editor', { name: editor.name })}</h3><p>{copy('declaration_note')}</p>
      <div className="condition-comparison__fields">{DECLARATION_DIMENSIONS.map(key => <label key={key}>{copy(key)}<input type="text" aria-label={copy(key)} name={`comparison-${key}`} value={editor.draft[key]} maxLength={240} disabled={editor.status === 'saving'} onChange={event => setEditor(previous => ({ ...previous, status: 'draft', draft: { ...previous.draft, [key]: event.target.value }, changed: [...new Set([...previous.changed, key])] }))} /></label>)}</div>
      {editor.status === 'invalid' ? <p role="alert">{copy('declaration_max')}</p> : null}
      {editor.status === 'error' ? <p role="alert">{copy('save_error')}</p> : null}
      {editor.status === 'saved' ? <p role="status">{copy('saved')}</p> : null}
      <div className="condition-comparison__actions"><button type="submit" disabled={editor.status === 'saving'}>{copy(editor.status === 'saving' ? 'saving' : 'save')}</button><button type="button" disabled={editor.status === 'saving'} onClick={() => setEditor(null)}>{copy('cancel')}</button></div>
    </form> : null}
    {scope === 'work' ? rows.filter(row => selectedIds.includes(row.id) && records[row.id]?.status === 'ready').map(row => <fieldset key={row.id} className="condition-comparison__work-picker"><legend>{copy('selected_work', { name: name(row) })}</legend>
      {row.segments.some(segment => segment.provenance === 'auto-detected') ? <p>{copy('detection_note')}</p> : null}
      {!row.segments.some(segment => segment.kind === 'work') ? <p>{copy('no_work_available')}</p> : row.segments.filter(segment => segment.kind === 'work').map(segment => <label key={segment.id}><input type="checkbox" aria-label={copy('segment_selection', { name: name(row), id: segment.id, label: segment.label || '' })} checked={(segmentSelections[row.id] ?? defaultDetectedWorkIds(row)).includes(segment.id)} onChange={() => setSegmentSelections(previous => ({ ...previous, [row.id]: toggle(previous[row.id] ?? defaultDetectedWorkIds(row), segment.id) }))} />
        <span>{segment.id} · {segment.label || copy('work')} · {distance(segment.distanceMeters)} · {duration(segment.durationSeconds)} · {hr(segment.averageHeartRate)} · {sourceLabel(segment.provenance)}</span>
      </label>)}
    </fieldset>) : null}
    <div className="condition-comparison__charts"><ComparisonChart rows={rows} unit={unit} copy={copy} lang={lang} referenceId={referenceId} /><ComparisonChart rows={rows} unit={unit} copy={copy} lang={lang} referenceId={referenceId} scatter /></div>
    {scope === 'work' ? rows.filter(row => selectedIds.includes(row.id) && row.sourceRows.length).map(row => <div key={row.id} className="condition-comparison__table-scroll" role="region" aria-label={copy('source_rows', { name: name(row) })} tabIndex={0}><table>
      <caption>{copy('source_rows', { name: name(row) })}</caption><thead><tr>{['segment', 'distance', 'timer', 'elapsed', 'pace', 'hr', 'hr_coverage', 'source'].map(key => <th key={key} scope="col">{copy(key)}</th>)}</tr></thead>
      <tbody>{row.sourceRows.map(segment => <tr key={segment.id}><th scope="row">{segment.id} · {segment.label}</th><td>{distance(segment.distanceMeters)}</td><td>{duration(segment.durationSeconds)}</td><td>{duration(segment.elapsedDurationSeconds)}</td><td>{segment.durationSeconds && segment.distanceMeters ? pace(segment.durationSeconds * 1000 / segment.distanceMeters) : missing}</td><td>{segment.hrCoverageSeconds > 0 ? hr(segment.averageHeartRate) : copy('no_hr')}</td><td>{segment.hrCoverageSeconds} s / {segment.elapsedDurationSeconds ?? missing} s</td><td>{sourceLabel(segment.provenance)} · {sourceLabel(segment.measurementProvenance)}</td></tr>)}</tbody>
    </table></div>) : null}
    <p className="condition-comparison__caution">{copy('not_causal')}</p>
    <details className="condition-comparison__calculation"><summary>{copy('how_calculated')}</summary>
      <p>{copy('calculation')}</p><p>{copy('bounded', { count: RECENT_LIMIT })}</p>
      <p>{copy(rules.length ? 'rule_basis' : 'explicit_basis')}</p>
      <p>{copy('progression_note')}</p><p>{copy('scatter_note')}</p>
    {rows.filter(row => selectedIds.includes(row.id) && records[row.id]?.status === 'ready').map(row => <details key={row.id} className="condition-comparison__conditions"><summary>{name(row)} · #{row.id} · {copy('comparison_conditions')}</summary>
      <ul>{COMPARISON_DIMENSIONS.map(key => {
        const field = row.conditions[key];
        const derivedRecovery = key === 'recovery' && !field?.value && conditionValue(row, key) !== null;
        return <li key={key}>{copy('condition_value', { dimension: copy(key), value: field?.value || (derivedRecovery ? copy('recovery') : copy('unavailable')), source: derivedRecovery ? copy('derived') : sourceLabel(field?.provenance) })}</li>;
      })}</ul>
      <p>{date(row)} · {copy('source_calendar', { zone: row.accountTimeZone || copy('unavailable') })}</p>
      <p>{sourceLabel(row.measurementProvenance)} · {distance(row.source?.distanceMeters)} · {duration(row.source?.durationSeconds)} · {copy('elapsed')}: {duration(row.source?.elapsedDurationSeconds)} · {coverage(row)}</p>
    </details>)}
    </details>
    </div>
  </section>;
}
