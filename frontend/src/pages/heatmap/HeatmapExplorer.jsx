import { useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useI18n } from '../../contexts/I18nContext';
import UnitContext from '../../contexts/UnitContext';
import { apiJson } from '../../api';
import AppIcon from '../../components/AppIcon';
import { formatDistance, formatDuration, getDistanceUnitLabel } from '../../utils/format';
import { getActivityDateKey } from '../../utils/timeZone';
import { buildRunDetailPath } from '../../utils/runRoute';
import { EMPTY_EXPLORER_FILTERS, activityDistance, activityDuration, filterExplorerActivities, summarizeExplorerActivities, buildExplorerTiles, tileBounds, explorerCsv, splitRouteAtGaps } from './heatmapExplorerModel';

const DEFAULT_DISPLAY = { color: 'speed', opacity: 0.85, showTracks: true, basemap: 'dark', tiles: false, cluster: true, square: true };
const numberText = (value, lang) => Number(value).toLocaleString(lang, { maximumFractionDigits: 1 });

function readPresets(key) {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? parsed.filter(x => typeof x.name === 'string' && x.filters && typeof x.filters === 'object').slice(0, 8) : [];
  } catch { return []; }
}

export default function HeatmapExplorer({ points, mapRef, mapRevision, account, timeZone, reloadToken, onChange }) {
  const { t, lang } = useI18n();
  const { unit = 'km' } = useContext(UnitContext) || {};
  const navigate = useNavigate();
  const tr = (key, values) => t(`heatmapExplorer.${key}`, values);
  const [panel, setPanel] = useState(null);
  const [filters, setFilters] = useState({ ...EMPTY_EXPLORER_FILTERS });
  const [display, setDisplay] = useState({ ...DEFAULT_DISPLAY });
  const [activities, setActivities] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [retry, setRetry] = useState(0);
  const [visibleCount, setVisibleCount] = useState(30);
  const [selected, setSelected] = useState(null);
  const [routeState, setRouteState] = useState('idle');
  const [presetName, setPresetName] = useState('');
  const presetKey = `hermes_heatmap_filters_v1:${account || ''}`;
  const [presets, setPresets] = useState(() => readPresets(presetKey));
  const [notice, setNotice] = useState('');
  const panelRef = useRef(null);
  const triggerRefs = useRef({});

  useEffect(() => {
    const controller = new AbortController();
    setLoadState('loading');
    apiJson('/api/activities/analysis', { signal: controller.signal }).then((payload) => {
      if (controller.signal.aborted) return;
      if (!Array.isArray(payload)) throw new Error('Invalid activity summary');
      setActivities(payload.filter(run => run && run.id != null && (!run.activityType || run.activityType === 'RUN')));
      setLoadState('ready');
    }).catch(() => { if (!controller.signal.aborted) setLoadState('error'); });
    return () => controller.abort();
  }, [account, reloadToken, retry]);

  const filterCount = Object.values(filters).filter(value => String(value).trim() !== '').length;
  const filtered = useMemo(() => filterExplorerActivities(activities, filters, timeZone), [activities, filters, timeZone]);
  const summary = useMemo(() => summarizeExplorerActivities(filtered), [filtered]);
  const allowedIds = useMemo(() => filterCount && loadState === 'ready' ? new Set(filtered.map(run => String(run.id))) : null, [filtered, filterCount, loadState]);
  const visiblePoints = useMemo(() => allowedIds ? points.filter(point => allowedIds.has(String(point.activityId))) : points, [points, allowedIds]);
  const grid = useMemo(() => buildExplorerTiles(visiblePoints), [visiblePoints]);
  const providers = useMemo(() => [...new Set(activities.map(run => run.provider).filter(Boolean))].sort(), [activities]);
  const invalidRange = (filters.from && filters.to && filters.from > filters.to)
    || [['minDistance', 'maxDistance'], ['minMinutes', 'maxMinutes']].some(([min, max]) => filters[min] !== '' && filters[max] !== '' && Number(filters[min]) > Number(filters[max]));

  useEffect(() => { onChange({ activityIds: allowedIds, color: display.color, opacity: display.opacity, showTracks: display.showTracks, basemap: display.basemap }); }, [onChange, allowedIds, display.color, display.opacity, display.showTracks, display.basemap]);

  useEffect(() => {
    if (!panel) return undefined;
    panelRef.current?.focus();
    const escape = (event) => {
      if (event.key === 'Escape') { setPanel(null); triggerRefs.current[panel]?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [panel]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapRevision || !display.tiles) return undefined;
    let disposed = false;
    let group;
    let renderer;
    let paint;
    import('leaflet').then((module) => {
      if (disposed) return;
      const L = module.default || module;
      group = L.layerGroup().addTo(map);
      renderer = L.canvas({ padding: 0.2 });
      paint = () => {
        group.clearLayers();
        const viewport = map.getBounds();
        for (const tile of grid.tiles) {
          const bounds = tileBounds(tile.x, tile.y);
          if (!viewport.intersects(bounds)) continue;
          const inCluster = display.cluster && grid.maxClusterKeys.has(tile.key);
          L.rectangle(bounds, { renderer, color: inCluster ? '#25825c' : '#c76336', weight: 1, fillOpacity: inCluster ? 0.23 : 0.09, interactive: false }).addTo(group);
        }
        const square = grid.maxSquare;
        if (display.square && square.size) {
          const southWest = tileBounds(square.x, square.y + square.size - 1)[0];
          const northEast = tileBounds(square.x + square.size - 1, square.y)[1];
          L.rectangle([southWest, northEast], { renderer, color: '#7850bf', weight: 2.5, fillOpacity: 0.08, interactive: false }).addTo(group);
        }
      };
      paint();
      map.on('moveend', paint);
    });
    return () => { disposed = true; if (paint) map.off('moveend', paint); if (group) map.removeLayer(group); if (renderer) map.removeLayer(renderer); };
  }, [mapRef, mapRevision, grid, display.tiles, display.cluster, display.square]);

  useEffect(() => {
    const map = mapRef.current;
    if (!selected || !map || !mapRevision) { setRouteState('idle'); return undefined; }
    const controller = new AbortController();
    let group;
    setRouteState('loading');
    Promise.all([apiJson(`/api/activities/${encodeURIComponent(selected.id)}/points`, { signal: controller.signal }), import('leaflet')]).then(([payload, module]) => {
      if (controller.signal.aborted) return;
      const segments = splitRouteAtGaps(Array.isArray(payload) ? payload : []);
      if (!segments.length) { setRouteState('empty'); return; }
      const L = module.default || module;
      group = L.featureGroup(segments.map(line => L.polyline(line, { color: '#f15b35', weight: 4, opacity: 0.95 }))).addTo(map);
      map.fitBounds(group.getBounds(), { padding: [48, 48], maxZoom: 16 });
      setRouteState('ready');
    }).catch(() => { if (!controller.signal.aborted) setRouteState('error'); });
    return () => { controller.abort(); if (group) map.removeLayer(group); };
  }, [mapRef, mapRevision, selected, retry]);

  function updateFilter(key, value) { setFilters(current => ({ ...current, [key]: value })); setSelected(null); setVisibleCount(30); setNotice(''); }
  function applyFilters(next) {
    setFilters(Object.fromEntries(Object.keys(EMPTY_EXPLORER_FILTERS).map(key => [key, typeof next[key] === 'string' ? next[key].slice(0, 200) : ''])));
    setSelected(null); setVisibleCount(30); setNotice('');
  }
  function storePresets(next) {
    try { localStorage.setItem(presetKey, JSON.stringify(next)); setPresets(next); setNotice(tr('saveDone')); }
    catch { setNotice(tr('storageError')); }
  }
  function downloadCsv() {
    const url = URL.createObjectURL(new Blob(['\uFEFF', explorerCsv(filtered, timeZone)], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a'); link.href = url; link.download = 'hermes-heatmap-activities.csv'; link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function closePanel() { const previous = panel; setPanel(null); triggerRefs.current[previous]?.focus(); }
  const changeDisplay = (key, value) => setDisplay(current => ({ ...current, [key]: value }));
  const distanceFactor = unit === 'mile' ? 0.621371 : 1;
  const distanceValue = (key) => filters[key] === '' ? '' : Number((Number(filters[key]) * distanceFactor).toFixed(3));
  const metricInput = (key, label, isDistance = false) => <label>{label}<input type="number" min="0" step="any" inputMode="decimal" aria-label={`${isDistance ? tr('distance') : tr('minutes')} ${label}`} value={isDistance ? distanceValue(key) : filters[key]} onChange={event => updateFilter(key, event.target.value === '' ? '' : String(Math.max(0, Number(event.target.value)) / (isDistance ? distanceFactor : 1)))} /></label>;

  return <>
    <h1 className="hm-explorer-sr-only">{tr('title')}</h1>
    <div className="hm-explorer-toolbar" role="group" aria-label={tr('title')}>
      {[['activities', 'list'], ['filters', 'filter'], ['display', 'settings']].map(([key, icon]) => <button key={key} ref={element => { triggerRefs.current[key] = element; }} type="button" className={panel === key ? 'is-active' : ''} aria-expanded={panel === key} aria-controls={panel === key ? 'heatmap-explorer-panel' : undefined} onClick={() => setPanel(current => current === key ? null : key)}><AppIcon name={icon} /><span>{tr(key)}</span>{key === 'filters' && filterCount > 0 ? <b>{filterCount}</b> : null}</button>)}
    </div>
    <section className="hm-explorer-summary" aria-label={tr('filtered')} aria-live="polite">
      <div className="hm-explorer-summary-label"><span className="hm-explorer-live-dot" />{filterCount ? tr('filtered') : tr('allTime')}<span className="hm-explorer-sport">{tr('title')}</span></div>
      <div className="hm-explorer-totals">
        <div><strong>{loadState === 'ready' ? numberText(summary.count, lang) : '—'}</strong><span>{tr('runs')}</span></div>
        <div><strong>{loadState === 'ready' && summary.distanceCount ? formatDistance(summary.distanceKm, 1, lang, unit) : '—'}</strong><span>{tr('distance')}</span></div>
        <div><strong>{loadState === 'ready' && summary.durationCount ? formatDuration(summary.movingSeconds) : '—'}</strong><span>{tr('moving')}</span></div>
      </div>
      {loadState === 'error' ? <div className="hm-explorer-inline-status" role="status">{tr('loadError')} <button type="button" onClick={() => setRetry(value => value + 1)}>{tr('retry')}</button></div> : null}
      {loadState === 'ready' && filterCount > 0 ? <button type="button" className="hm-explorer-clear" onClick={() => applyFilters(EMPTY_EXPLORER_FILTERS)}>{tr('clear')} ×</button> : null}
    </section>
    {loadState === 'ready' && allowedIds && !visiblePoints.length && !selected ? <div className="hm-explorer-no-points" role="status">{tr('noPoints')}</div> : null}
    {display.tiles ? <aside className="hm-explorer-tile-stats" aria-label={tr('coverage')}>
      <span className="hm-explorer-eyebrow">{tr('coverage')}</span>
      <div><span>{tr('visited')}</span><strong>{numberText(grid.tiles.length, lang)}</strong></div>
      <div><span><i className="hm-explorer-key is-cluster" />{tr('cluster')}</span><strong>{numberText(grid.maxCluster, lang)}</strong></div>
      <div><span><i className="hm-explorer-key is-square" />{tr('square')}</span><strong>{grid.maxSquare.size} × {grid.maxSquare.size}</strong></div>
      <p>{tr('coverageNote')}</p>
    </aside> : null}
    {panel ? <aside id="heatmap-explorer-panel" className="hm-explorer-panel" ref={panelRef} tabIndex={-1} aria-labelledby="heatmap-explorer-heading">
      <header><div><span className="hm-explorer-eyebrow">Hermes</span><h2 id="heatmap-explorer-heading">{tr(panel)}</h2></div><button type="button" className="hm-explorer-icon-btn" onClick={closePanel} aria-label={tr('close')}>×</button></header>
      <div className="hm-explorer-panel-body">
        {panel === 'filters' ? <>
          {loadState === 'loading' ? <p role="status">{tr('loading')}</p> : null}
          <fieldset disabled={loadState !== 'ready'}>
            <label className="hm-explorer-search">{tr('search')}<input type="search" value={filters.query} onChange={event => updateFilter('query', event.target.value)} /></label>
            <h3>{tr('dates')}</h3><div className="hm-explorer-field-pair"><label>{tr('from')}<input type="date" value={filters.from} onChange={event => updateFilter('from', event.target.value)} /></label><label>{tr('to')}<input type="date" value={filters.to} onChange={event => updateFilter('to', event.target.value)} /></label></div>
            <h3>{tr('source')}</h3><label className="hm-explorer-sr-only" htmlFor="heatmap-provider">{tr('source')}</label><select id="heatmap-provider" value={filters.provider} onChange={event => updateFilter('provider', event.target.value)}><option value="">{tr('allSources')}</option>{providers.map(provider => <option key={provider}>{provider}</option>)}</select>
            <h3>{tr('distance')} ({getDistanceUnitLabel(lang, unit)})</h3><div className="hm-explorer-field-pair">{metricInput('minDistance', tr('minimum'), true)}{metricInput('maxDistance', tr('maximum'), true)}</div>
            <h3>{tr('minutes')}</h3><div className="hm-explorer-field-pair">{metricInput('minMinutes', tr('minimum'))}{metricInput('maxMinutes', tr('maximum'))}</div>
            {invalidRange ? <p className="hm-explorer-error" role="alert">{tr('rangeError')}</p> : null}
            <button type="button" className="hm-explorer-text-btn" onClick={() => applyFilters(EMPTY_EXPLORER_FILTERS)}>{tr('clear')}</button>
          </fieldset>
          <section className="hm-explorer-presets"><h3>{tr('presets')}</h3>{presets.map((preset, index) => <div className="hm-explorer-preset" key={`${preset.name}:${index}`}><button type="button" onClick={() => applyFilters(preset.filters)}>{preset.name}</button><button type="button" aria-label={`${tr('remove')}: ${preset.name}`} onClick={() => storePresets(presets.filter((_, item) => item !== index))}>×</button></div>)}
            <form onSubmit={event => { event.preventDefault(); storePresets([...presets, { name: presetName.trim() || tr('defaultPreset'), filters }].slice(-8)); setPresetName(''); }}><label>{tr('presetName')}<input maxLength="60" value={presetName} onChange={event => setPresetName(event.target.value)} /></label><button type="submit" disabled={!filterCount || invalidRange || loadState !== 'ready'}>{tr('save')}</button></form>
            {notice ? <p role="status">{notice}</p> : null}
          </section><p className="hm-explorer-help">{tr('sampleNote')}</p>
        </> : null}
        {panel === 'display' ? <>
          <h3>{tr('basemap')}</h3><div className="hm-explorer-segmented">{['dark', 'streets'].map(key => <button key={key} type="button" aria-pressed={display.basemap === key} onClick={() => changeDisplay('basemap', key)}>{tr(key)}</button>)}</div>
          <h3>{tr('color')}</h3><div className="hm-explorer-segmented">{['speed', 'frequency'].map(key => <button key={key} type="button" aria-pressed={display.color === key} onClick={() => changeDisplay('color', key)}>{tr(key)}</button>)}</div>
          <label className="hm-explorer-range">{tr('opacity')}<span>{Math.round(display.opacity * 100)}%</span><input type="range" min="0.15" max="1" step="0.05" value={display.opacity} onChange={event => changeDisplay('opacity', Number(event.target.value))} /></label>
          <label className="hm-explorer-toggle"><span>{tr('showTracks')}</span><input type="checkbox" checked={display.showTracks} onChange={event => changeDisplay('showTracks', event.target.checked)} /></label>
          <h3>{tr('tiles')}</h3>{[['tiles', 'showTiles'], ['cluster', 'showCluster'], ['square', 'showSquare']].map(([key, label]) => <label key={key} className="hm-explorer-toggle"><span>{tr(label)}</span><input type="checkbox" checked={display[key]} disabled={key !== 'tiles' && !display.tiles} onChange={event => changeDisplay(key, event.target.checked)} /></label>)}
          <p className="hm-explorer-help">{tr('coverageNote')}</p><p className="hm-explorer-help">{tr('clusterNote')}</p><button type="button" className="hm-explorer-text-btn" onClick={() => setDisplay({ ...DEFAULT_DISPLAY })}>{tr('resetDisplay')}</button>
        </> : null}
        {panel === 'activities' ? <>
          <label className="hm-explorer-search">{tr('search')}<input type="search" value={filters.query} onChange={event => updateFilter('query', event.target.value)} /></label>
          <div className="hm-explorer-list-summary"><span>{tr('count', { count: filtered.length })}</span><button type="button" disabled={loadState !== 'ready' || !filtered.length} onClick={downloadCsv}><AppIcon name="download" />{tr('export')}</button></div>
          {loadState === 'loading' ? <p role="status">{tr('loading')}</p> : null}
          {loadState === 'error' ? <p role="status">{tr('loadError')} <button type="button" onClick={() => setRetry(value => value + 1)}>{tr('retry')}</button></p> : null}
          {selected ? <div className="hm-explorer-selection" role="status"><strong>{selected.name || tr('unnamed')}</strong><p>{tr({ loading: 'routeLoading', error: 'routeError', empty: 'routeEmpty', ready: 'routeShown', idle: 'routeLoading' }[routeState])}</p><div><button type="button" onClick={() => navigate(buildRunDetailPath(selected.id))}>{tr('details')} ↗</button><button type="button" onClick={() => setSelected(null)}>{tr('clearRoute')}</button>{routeState === 'error' ? <button type="button" onClick={() => setRetry(value => value + 1)}>{tr('retry')}</button> : null}</div></div> : null}
          {loadState === 'ready' && !filtered.length ? <p role="status">{tr('noMatches')}</p> : null}
          <div className="hm-explorer-activity-list">{filtered.slice(0, visibleCount).map(run => <button type="button" key={run.id} aria-label={`${tr('selectRoute')}: ${run.name || tr('unnamed')}`} aria-pressed={selected?.id === run.id} onClick={() => setSelected(run)}><span className="hm-explorer-activity-date">{getActivityDateKey(run, timeZone) || '—'}<span>{run.provider || ''}</span></span><strong>{run.name || tr('unnamed')}</strong><span className="hm-explorer-activity-metrics">{Number.isFinite(activityDistance(run)) ? formatDistance(activityDistance(run), 1, lang, unit) : '—'}<span>{Number.isFinite(activityDuration(run)) ? formatDuration(activityDuration(run)) : '—'}</span><AppIcon name="map" /></span></button>)}</div>
          {filtered.length > visibleCount ? <button type="button" className="hm-explorer-more" onClick={() => setVisibleCount(value => value + 30)}>{tr('more')}</button> : null}
        </> : null}
      </div>
      <footer><span className="hm-explorer-live-dot" />{tr('coverage')}</footer>
    </aside> : null}
  </>;
}
