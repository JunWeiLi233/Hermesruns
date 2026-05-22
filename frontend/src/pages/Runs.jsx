import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiFetch, apiJson } from '../api';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import { formatDate, formatDistance, formatDuration, formatPace } from '../utils/format';
import HermesLogo from '../components/HermesLogo';
import ImportDataGuide from '../components/ImportDataGuide';
import Modal from '../components/Modal';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { formatStravaSyncLabel, STRAVA_SYNC_FINISHED_EVENT } from '../utils/stravaAutoSync';

const ROUTE_PREVIEW_CONCURRENCY = 2;

function localizeStravaSyncMessage(message, t) {
  const raw = String(message || '').trim();
  if (!raw) return '';
  if (raw === 'Strava sync started') return t('profile.strava_sync_started');
  if (/No Strava/i.test(raw)) return t('profile.strava_sync_not_linked');
  if (/invalid|expired|relink/i.test(raw)) return t('profile.strava_sync_relink_required');
  return raw;
}

function buildRoutePreviewModel(points) {
  if (!Array.isArray(points) || points.length < 2) return null;

  let minLat = points[0][0];
  let maxLat = points[0][0];
  let minLng = points[0][1];
  let maxLng = points[0][1];

  points.forEach(([lat, lng]) => {
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
  });

  const latSpan = Math.max(0.0001, maxLat - minLat);
  const lngSpan = Math.max(0.0001, maxLng - minLng);
  const padding = 12;
  const width = 100;
  const height = 100;
  const innerWidth = width - (padding * 2);
  const innerHeight = height - (padding * 2);

  const normalized = points.map(([lat, lng]) => {
    const x = padding + (((lng - minLng) / lngSpan) * innerWidth);
    const y = padding + (innerHeight - (((lat - minLat) / latSpan) * innerHeight));
    return [x, y];
  });

  return {
    path: normalized.map(([x, y], index) => `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`).join(' '),
    start: normalized[0],
    finish: normalized[normalized.length - 1],
  };
}

function normalizeRoutePreview(preview) {
  if (!preview || typeof preview !== 'object' || !preview.path) return null;
  const startX = Array.isArray(preview.start) ? Number(preview.start[0]) : Number(preview.startX);
  const startY = Array.isArray(preview.start) ? Number(preview.start[1]) : Number(preview.startY);
  const finishX = Array.isArray(preview.finish) ? Number(preview.finish[0]) : Number(preview.finishX);
  const finishY = Array.isArray(preview.finish) ? Number(preview.finish[1]) : Number(preview.finishY);
  if (![startX, startY, finishX, finishY].every(Number.isFinite)) return null;
  return {
    path: preview.path,
    start: [startX, startY],
    finish: [finishX, finishY],
  };
}

function RoutePreviewThumb({ preview, provider, runName }) {
  const normalizedPreview = normalizeRoutePreview(preview);

  return (
    <div className={`recent-runs-thumb${normalizedPreview ? ' is-route-preview' : ''}`}>
      {normalizedPreview ? (
        <svg className="recent-runs-thumb-route-svg" viewBox="0 0 100 100" aria-hidden="true">
          <path className="recent-runs-thumb-route-shadow" d={normalizedPreview.path} />
          <path className="recent-runs-thumb-route-line" d={normalizedPreview.path} />
          <circle className="recent-runs-thumb-route-start" cx={normalizedPreview.start[0]} cy={normalizedPreview.start[1]} r="3.2" />
          <circle className="recent-runs-thumb-route-finish" cx={normalizedPreview.finish[0]} cy={normalizedPreview.finish[1]} r="3.6" />
        </svg>
      ) : (
        <div className="recent-runs-thumb-route-empty" aria-hidden="true">
          <AppIcon name="route" className="runner-dashboard-side-link-icon" />
        </div>
      )}
      <div className="recent-runs-thumb-badge">{provider}</div>
      <div className="recent-runs-thumb-map-label">{runName}</div>
    </div>
  );
}

const RECENT_RUNS_INITIAL_VISIBLE_COUNT = 3;
const RECENT_RUNS_LOAD_BATCH_SIZE = 6;

function RunCard({ run, t, lang, routePreviewFallbacks, onOpen }) {
  const provider = run.provider || t('runs.manual_import');
  const runName = run.name || t('runs.default_run_name');
  const preview = run.routePreview || routePreviewFallbacks[run.id] || null;

  return (
    <article className="recent-runs-card" onClick={() => onOpen(run)}>
      <RoutePreviewThumb preview={preview} provider={provider} runName={runName} />
      <div className="recent-runs-card-body">
        <div className="recent-runs-card-top">
          <div>
            <h2>{runName}</h2>
            <p className="recent-runs-card-date"><AppIcon name="calendar_today" className="runner-dashboard-side-link-icon" />{formatDate(run.startTime || run.startDate, lang)}</p>
          </div>
          <button type="button" className="recent-runs-card-menu" onClick={(event) => event.stopPropagation()} aria-label={t('runs.stitch_more_actions')}>
            <AppIcon name="more_horiz" className="runner-dashboard-side-link-icon" />
          </button>
        </div>
        <div className="recent-runs-card-metrics">
          <div className="recent-runs-card-metric recent-runs-card-metric--accent"><span>{t('runs.metric_distance')}</span><strong>{formatDistance(Number(run.distanceKm || 0), 1, lang)}</strong></div>
          <div className="recent-runs-card-metric"><span>{t('runs.metric_average_pace')}</span><strong>{formatPace(Number(run.distanceKm || 0), Number(run.movingTimeSeconds || 0), lang)}</strong></div>
          <div className="recent-runs-card-metric"><span>{t('runs.metric_moving_time')}</span><strong>{formatDuration(run.movingTimeSeconds)}</strong></div>
        </div>
      </div>
    </article>
  );
}

const Runs = memo(function Runs() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [allRuns, setAllRuns] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadState, setLoadState] = useState('loading');
  const [activeMode, setActiveMode] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [runsSort, setRunsSort] = useState('date');
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaLinking, setStravaLinking] = useState(false);
  const [integrationNotice, setIntegrationNotice] = useState('');
  const [integrationNoticeTone, setIntegrationNoticeTone] = useState('info');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);
  const [importStatus, setImportStatus] = useState('');
  const [routePreviewFallbacks, setRoutePreviewFallbacks] = useState({});
  const [visibleRunsCount, setVisibleRunsCount] = useState(RECENT_RUNS_INITIAL_VISIBLE_COUNT);
  const routePreviewInflightRef = useRef(new Set());
  const loadMoreSentinelRef = useRef(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadRuns();
  }, [isAuthenticated, navigate]);

  useEffect(() => {
    if (!isAuthenticated) return undefined;

    function handleStravaSyncFinished() {
      loadRuns();
    }

    window.addEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    return () => {
      window.removeEventListener(STRAVA_SYNC_FINISHED_EVENT, handleStravaSyncFinished);
    };
  }, [isAuthenticated]);

  async function loadRuns() {
    try {
      const [data, profileData, stravaData] = await Promise.all([
        apiJson('/api/activities'),
        apiJson('/api/profile/me').catch(() => null),
        apiJson('/api/auth/strava/status').catch(() => null),
      ]);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setAllRuns(list);
      setProfile(profileData);
      setStravaStatus(stravaData);
      setLoadState('ready');
    } catch (err) {
      if (err.message !== 'Unauthorized') setLoadState('error');
    }
  }

  async function handleStravaConnect() {
    setStravaLinking(true);
    try {
      if (stravaStatus?.linked) {
        const response = await apiFetch('/api/strava/sync');
        const rawMessage = (await response.text()).trim();
        const localizedMessage = localizeStravaSyncMessage(rawMessage, t);
        setIntegrationNotice(response.ok ? (localizedMessage || t('profile.strava_sync_started')) : (localizedMessage || t('profile.strava_sync_failed')));
        setIntegrationNoticeTone(response.ok ? 'active' : 'alert');
        if (response.ok) window.setTimeout(() => loadRuns(), 3500);
      } else {
        const data = await apiJson('/api/auth/strava/link-url', { method: 'POST' });
        if (data?.url) {
          window.location.href = data.url;
          return;
        }
      }
    } catch {
      setIntegrationNotice(t('profile.strava_sync_failed'));
      setIntegrationNoticeTone('alert');
    }
    setStravaLinking(false);
  }

  async function handleImport(event) {
    event.preventDefault();
    const formData = new FormData();
    let hasFiles = false;
    [[fitExportFiles, 'exports'], [corosFiles, 'coros'], [huaweiFiles, 'huawei']].forEach(([files, field]) => {
      if (!files) return;
      Array.from(files).forEach((file) => {
        formData.append(field, file);
        hasFiles = true;
      });
    });
    if (!hasFiles) return;
    setImportStatus('');
    try {
      const response = await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      if (!response.ok) throw new Error();
      setImportModalOpen(false);
      loadRuns();
    } catch {
      setImportStatus(t('profile.import_failed'));
    }
  }

  const filteredRuns = useMemo(() => {
    const now = new Date();
    let result = [...allRuns];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((run) => (run.name || t('runs.default_run_name')).toLowerCase().includes(q));
    }

    if (activeMode === 'year') {
      if (selectedYear != null) {
        result = result.filter((run) => new Date(run.startTime || run.startDate || 0).getFullYear() === selectedYear);
      }
    } else if (activeMode === 'month') {
      const year = selectedYear || now.getFullYear();
      result = result.filter((run) => {
        const date = new Date(run.startTime || run.startDate || 0);
        if (date.getFullYear() !== year) return false;
        return selectedMonth == null ? true : date.getMonth() === selectedMonth;
      });
    } else if (activeMode === 'day') {
      result = result.filter((run) => {
        const date = new Date(run.startTime || run.startDate || 0);
        return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
      });
    }

    if (runsSort === 'distance') {
      result.sort((a, b) => Number(b.distanceKm || 0) - Number(a.distanceKm || 0));
    } else if (runsSort === 'pace') {
      result.sort((a, b) => {
        const paceA = Number(a.movingTimeSeconds || 0) / Math.max(0.1, Number(a.distanceKm || 0));
        const paceB = Number(b.movingTimeSeconds || 0) / Math.max(0.1, Number(b.distanceKm || 0));
        return paceA - paceB;
      });
    } else {
      result.sort((a, b) => new Date(b.startTime || b.startDate || 0).getTime() - new Date(a.startTime || a.startDate || 0).getTime());
    }

    return result;
  }, [activeMode, allRuns, selectedMonth, selectedYear, searchQuery, runsSort, t]);

  const distinctYears = useMemo(() => {
    const years = new Set();
    allRuns.forEach((run) => {
      const date = new Date(run.startTime || run.startDate || 0);
      if (!Number.isNaN(date.getTime())) years.add(date.getFullYear());
    });
    return [...years].sort((a, b) => b - a);
  }, [allRuns]);

  const monthsWithData = useMemo(() => {
    const year = selectedYear || new Date().getFullYear();
    const months = new Set();
    allRuns.forEach((run) => {
      const date = new Date(run.startTime || run.startDate || 0);
      if (!Number.isNaN(date.getTime()) && date.getFullYear() === year) months.add(date.getMonth());
    });
    return [...months].sort((a, b) => a - b);
  }, [allRuns, selectedYear]);

  useEffect(() => {
    if (activeMode === 'year' && selectedYear == null && distinctYears.length) setSelectedYear(distinctYears[0]);
    if (activeMode === 'month' && selectedYear == null) setSelectedYear(new Date().getFullYear());
  }, [activeMode, distinctYears, selectedYear]);

  useEffect(() => {
    if (activeMode === 'month' && selectedMonth == null && monthsWithData.length) setSelectedMonth(monthsWithData[monthsWithData.length - 1]);
  }, [activeMode, monthsWithData, selectedMonth]);

  useEffect(() => {
    setVisibleRunsCount(RECENT_RUNS_INITIAL_VISIBLE_COUNT);
  }, [activeMode, allRuns.length, runsSort, searchQuery, selectedMonth, selectedYear]);

  const displayName = (profile?.displayName || profile?.email?.split('@')[0] || t('profile.default_name')).trim();
  const initials = displayName.slice(0, 1).toUpperCase();
  const monthNames = t('runs.months').split(',');
  const isAwaitingData = loadState === 'ready' && allRuns.length === 0;
  const stravaLinked = Boolean(stravaStatus?.linked);
  const awaitingTitle = t(stravaLinked ? 'runs.awaiting_title_linked' : 'runs.awaiting_title_disconnected');
  const awaitingCopy = t(stravaLinked ? 'runs.awaiting_copy_linked' : 'runs.awaiting_copy_disconnected');
  const awaitingStatus = integrationNotice || (stravaLinked
    ? formatStravaSyncLabel(stravaStatus, t)
    : t('runs.awaiting_status_disconnected'));
  const awaitingPrimaryAction = stravaLinking ? t('profile.strava_link_connecting') : t(stravaLinked ? 'runs.awaiting_retry_sync' : 'runs.awaiting_connect_strava');
  const countText = filteredRuns.length === 0 ? t('runs.count_zero') : t('runs.count_label', { count: filteredRuns.length });
  const filteredDistanceKm = filteredRuns.reduce((sum, run) => sum + Number(run.distanceKm || 0), 0);
  const filteredTimeSeconds = filteredRuns.reduce((sum, run) => sum + Number(run.movingTimeSeconds || 0), 0);
  const totalDistanceText = formatDistance(filteredDistanceKm, 1, lang);
  const totalTimeText = formatDuration(filteredTimeSeconds);
  const avgPaceText = filteredRuns.length > 0
    ? formatPace(filteredDistanceKm, filteredTimeSeconds, lang)
    : t('runs.pace_zero');
  const visibleRuns = useMemo(
    () => filteredRuns.slice(0, visibleRunsCount),
    [filteredRuns, visibleRunsCount],
  );
  const routePreviewRuns = useMemo(
    () => visibleRuns.slice(0, 50).filter((run) => !run.routePreview),
    [visibleRuns],
  );
  const hasMoreRuns = visibleRunsCount < filteredRuns.length;

  const activeDaysCount = useMemo(() => {
    const uniqueDays = new Set();
    filteredRuns.forEach((run) => {
      const date = new Date(run.startTime || run.startDate || 0);
      if (!Number.isNaN(date.getTime())) uniqueDays.add(date.toISOString().slice(0, 10));
    });
    return uniqueDays.size;
  }, [filteredRuns]);
  const longestRun = useMemo(() => (
    filteredRuns.reduce((best, run) => (Number(run.distanceKm || 0) > Number(best?.distanceKm || 0) ? run : best), null)
  ), [filteredRuns]);
  const fastestRun = useMemo(() => (
    filteredRuns.reduce((best, run) => {
      const distanceKm = Number(run.distanceKm || 0);
      const movingTimeSeconds = Number(run.movingTimeSeconds || 0);
      if (distanceKm <= 0 || movingTimeSeconds <= 0) return best;
      const paceSeconds = movingTimeSeconds / distanceKm;
      if (!best || paceSeconds < best.paceSeconds) return { run, paceSeconds };
      return best;
    }, null)
  ), [filteredRuns]);

  const timeFilterOptions = [
    { key: 'all', label: t('runs.filter_all') },
    { key: 'year', label: t('runs.filter_year') },
    { key: 'month', label: t('runs.filter_month') },
    { key: 'day', label: t('runs.filter_day') },
  ];
  const sortOptions = [
    { key: 'date', label: t('runs.sort_date') },
    { key: 'distance', label: t('runs.sort_distance') },
    { key: 'pace', label: t('runs.sort_pace') },
  ];
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'activities',
  }), [lang, t]);

  function openRun(run) {
    sessionStorage.setItem('hermes_selected_run', JSON.stringify(run));
    navigate(`/run/${run.id || ''}`);
  }

  useEffect(() => {
    if (!hasMoreRuns || loadState !== 'ready') return undefined;
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel || typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setVisibleRunsCount((current) => Math.min(current + RECENT_RUNS_LOAD_BATCH_SIZE, filteredRuns.length));
    }, {
      root: null,
      rootMargin: '240px 0px 360px',
      threshold: 0.01,
    });

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [filteredRuns.length, hasMoreRuns, loadState]);

  useEffect(() => {
    let cancelled = false;
    const pendingRuns = routePreviewRuns.filter((run) => (
      run?.id
      && !(run.id in routePreviewFallbacks)
      && !routePreviewInflightRef.current.has(run.id)
    ));
    if (pendingRuns.length === 0) return undefined;

    async function loadRoutePreviews() {
      const workers = Array.from(
        { length: Math.min(ROUTE_PREVIEW_CONCURRENCY, pendingRuns.length) },
        async (_, workerIndex) => {
          for (let index = workerIndex; index < pendingRuns.length; index += ROUTE_PREVIEW_CONCURRENCY) {
            const run = pendingRuns[index];
            routePreviewInflightRef.current.add(run.id);
            try {
              const response = await apiFetch(`/api/activities/${run.id}/points`);
              if (!response.ok) {
                if (!cancelled) {
                  setRoutePreviewFallbacks((current) => ({ ...current, [run.id]: null }));
                }
                continue;
              }
              const data = await response.json();
              const points = Array.isArray(data)
                ? data
                  .map((point) => [Number(point.latitude), Number(point.longitude)])
                  .filter(([latitude, longitude]) => Number.isFinite(latitude) && Number.isFinite(longitude))
                : [];
              const preview = buildRoutePreviewModel(points);
              if (!cancelled) {
                setRoutePreviewFallbacks((current) => ({ ...current, [run.id]: preview }));
              }
            } catch {
              if (!cancelled) {
                setRoutePreviewFallbacks((current) => ({ ...current, [run.id]: null }));
              }
            } finally {
              routePreviewInflightRef.current.delete(run.id);
            }
          }
        }
      );
      await Promise.all(workers);
    }

    loadRoutePreviews();
    return () => {
      cancelled = true;
    };
  }, [routePreviewFallbacks, routePreviewRuns]);

  function renderSecondaryFilterRow() {
    if (activeMode === 'year') {
      return distinctYears.map((year) => (
        <button key={year} type="button" className={`recent-runs-chip${year === selectedYear ? ' is-active' : ''}`} onClick={() => setSelectedYear(year)}>
          {year}
        </button>
      ));
    }
    if (activeMode === 'month') {
      return monthsWithData.map((month) => (
        <button key={month} type="button" className={`recent-runs-chip${month === selectedMonth ? ' is-active' : ''}`} onClick={() => setSelectedMonth(month)}>
          {monthNames[month]}
        </button>
      ));
    }
    return sortOptions.map((option) => (
      <button key={option.key} type="button" className={`recent-runs-chip${runsSort === option.key ? ' is-active' : ''}`} onClick={() => setRunsSort(option.key)}>
        {option.label}
      </button>
    ));
  }

  function renderImportModal() {
    return (
      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <ImportDataGuide />
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            {[
              ['fit', 'FIT/GPX', fitExportFiles, setFitExportFiles, 'profile.fit_export_source_title', 'profile.fit_export_source_hint', 'profile.fit_export_file_label'],
              ['coros', 'COROS', corosFiles, setCorosFiles, 'profile.coros_source_title', 'profile.coros_source_hint', 'profile.coros_file_label'],
              ['huawei', 'HUAWEI', huaweiFiles, setHuaweiFiles, 'profile.huawei_source_title', 'profile.huawei_source_hint', 'profile.huawei_file_label'],
            ].map(([key, tag, files, setter, titleKey, hintKey, labelKey]) => (
              <section key={key} className="import-source-card">
                <div className="import-source-header">
                  <div className="import-source-copy">
                    <span className="import-source-title">{t(titleKey)}</span>
                    <span className="import-source-hint">{t(hintKey)}</span>
                  </div>
                  <span className="import-source-tag">{tag}</span>
                </div>
                <label className="modal-label">{t(labelKey)}</label>
                <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setter(event.target.files)} />
                <p className="selected-file-name">{files?.length ? t('profile.selected_files_count', { count: files.length }) : t('profile.no_file_selected')}</p>
              </section>
            ))}
          </div>
          <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
          {importStatus ? <div className="modal-status">{importStatus}</div> : null}
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setImportModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>
    );
  }

  if (isAwaitingData) {
    return (
      <div className={`runner-shell-page runner-dashboard-page runs-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
        <aside className="runner-shell-sidebar">
          <div className="runner-shell-brand runner-dashboard-brand">
            <div className="runner-dashboard-brand-copy">
              <HermesLogo dark />
              <span>{t('analysis.stitch_brand_subtitle')}</span>
            </div>
            <button
              type="button"
              className="runner-dashboard-sidebar-toggle"
              onClick={() => setIsSidebarCollapsed((current) => !current)}
              aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
              aria-pressed={isSidebarCollapsed}
            >
              <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
            </button>
          </div>
          <nav className="runner-shell-side-nav">
            {navItems.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
                onClick={() => navigate(item.route)}
                aria-label={item.label}
              >
                <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
                <span className="runner-dashboard-side-link-label">{item.label}</span>
              </button>
            ))}
          </nav>
          <div className="runner-shell-sidebar-footer">
            <button
              type="button"
              className="runner-shell-workout-btn runner-dashboard-workout-btn"
              onClick={() => navigate('/today-run')}
              aria-label={t('profile.dashboard_start_workout')}
            >
              <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
              <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
            </button>
          </div>
        </aside>

        <main className="runner-shell-main">
          <header className="runner-shell-topbar runner-dashboard-shell-topbar">
            <div className="runner-shell-topbar-left">
              <RunnerShellTopNav
                navItems={navItems}
                activeLabel={t('profile.dashboard_nav_activities')}
                navigate={navigate}
              />
            </div>
            <div className="runner-shell-topbar-actions">
              <div className="runner-shell-topbar-profile-actions">
                <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
                <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                  <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
                </button>
                <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={t('profile.settings')}>
                  {initials}
                </button>
              </div>
            </div>
          </header>

          <div className="runner-shell-canvas">
            <main className="integration-alert-shell runs-dashboard-shell">
              <div className="runner-dashboard-hero-copy runs-dashboard-hero-copy">
                <h1>{t('runs.heading')}</h1>
                <p>{t('runs.page_copy')}</p>
              </div>
              <div className="integration-alert-background" aria-hidden="true">
                <div className="integration-alert-orb integration-alert-orb--primary" />
                <div className="integration-alert-orb integration-alert-orb--secondary" />
              </div>
              <div className="integration-alert-grid">
                <section className="integration-alert-primary-panel">
                  <article className="integration-alert-card">
                    <div className="integration-alert-band">
                      <span>{t('runs.awaiting_alert_kicker')}</span>
                      <strong>{t(stravaLinked ? 'runs.awaiting_error_code_linked' : 'runs.awaiting_error_code_disconnected')}</strong>
                    </div>
                    <div className="integration-alert-card-body">
                      <div className="integration-alert-copy">
                        <h2>{awaitingTitle}</h2>
                        <p>{awaitingCopy}</p>
                      </div>
                      <div className="integration-alert-actions">
                        <button type="button" className="integration-alert-primary-btn" onClick={handleStravaConnect} disabled={stravaLinking}>{awaitingPrimaryAction}</button>
                        <button type="button" className="integration-alert-secondary-btn" onClick={() => setImportModalOpen(true)}>{t('runs.awaiting_import_files')}</button>
                      </div>
                    </div>
                  </article>
                  <div className={`integration-alert-status integration-alert-status--${integrationNoticeTone}`}>
                    <span className="integration-alert-status-dot" aria-hidden="true" />
                    <span>{awaitingStatus}</span>
                  </div>
                </section>
                <aside className="integration-alert-sidebar">
                  <section className="integration-alert-sidecard">
                    <div className="integration-alert-sidecard-head"><h2>{t('runs.awaiting_pipeline_title')}</h2></div>
                    <div className="integration-alert-pipeline-list">
                      <article className={`integration-alert-pipeline${stravaLinked ? ' is-live' : ' is-muted'}`}>
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-strava"><AppIcon name="bolt" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_strava')}</strong>
                            <p>{t(stravaLinked ? 'runs.awaiting_pipeline_strava_connected' : 'runs.awaiting_pipeline_strava_disconnected')}</p>
                          </div>
                        </div>
                        <AppIcon name={stravaLinked ? 'check_circle' : 'error'} className="integration-alert-pipeline-state" />
                      </article>
                      <article className="integration-alert-pipeline is-live">
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-manual"><AppIcon name="folder_open" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_manual')}</strong>
                            <p>{t('runs.awaiting_pipeline_manual_ready')}</p>
                          </div>
                        </div>
                        <AppIcon name="check_circle" className="integration-alert-pipeline-state" />
                      </article>
                      <article className="integration-alert-pipeline is-standby">
                        <div className="integration-alert-pipeline-main">
                          <div className="integration-alert-pipeline-icon is-garmin"><AppIcon name="watch" className="runner-dashboard-side-link-icon" /></div>
                          <div>
                            <strong>{t('runs.awaiting_pipeline_garmin')}</strong>
                            <p>{t('runs.awaiting_pipeline_garmin_ready')}</p>
                          </div>
                        </div>
                      </article>
                    </div>
                    <button type="button" className="integration-alert-inline-link" onClick={() => navigate('/settings')}>
                      <span>{t('runs.awaiting_pipeline_settings')}</span>
                      <AppIcon name="chevron_right" className="runner-dashboard-side-link-icon" />
                    </button>
                  </section>
                  <section className="integration-alert-support-card">
                    <div>
                      <strong>{t('runs.awaiting_support_title')}</strong>
                      <p>{t('runs.awaiting_support_copy')}</p>
                    </div>
                    <button type="button" className="integration-alert-support-link" onClick={() => setImportModalOpen(true)}>{t('runs.awaiting_support_cta')}</button>
                    <AppIcon name="support_agent" className="integration-alert-support-mark" />
                  </section>
                </aside>
              </div>
              <footer className="runner-shell-footer runner-dashboard-footer">
                <FooterNavLinks />
              </footer>
            </main>
          </div>
        </main>
        {renderImportModal()}
      </div>
    );
  }

  return (
    <div className={`runner-shell-page runner-dashboard-page runs-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
              aria-label={item.label}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="runner-shell-sidebar-footer">
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('profile.dashboard_nav_activities')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" onClick={() => navigate('/profile')} aria-label={displayName}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          <main className="recent-runs-shell runs-dashboard-shell">
            <section className="runner-dashboard-hero-copy runs-dashboard-hero-copy">
              <span className="recent-runs-hero-kicker">{countText}</span>
              <h1>{t('runs.heading')}</h1>
              <p>{t('runs.page_copy')}</p>
            </section>
            <section className="recent-runs-hero recent-runs-hero--dashboard">
              <div className="recent-runs-hero-overlay" />
              <div className="recent-runs-hero-copy">
                <span className="recent-runs-hero-kicker">{t('runs.stitch_pattern_title')}</span>
                <h2>{t('profile.dashboard_recent_sessions')}</h2>
                <p>{t('runs.page_copy')}</p>
              </div>
            </section>
            <section id="recent-runs-filters" className="recent-runs-chip-stack">
              <div className="recent-runs-search-bar">
                <div className="recent-runs-search-input-wrap">
                  <AppIcon name="search" className="recent-runs-search-icon" />
                  <input
                    type="text"
                    className="recent-runs-search-input"
                    placeholder={t('runs.search_placeholder')}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button type="button" className="recent-runs-search-clear" onClick={() => setSearchQuery('')} aria-label={t('profile.close')}>
                      <AppIcon name="close" />
                    </button>
                  )}
                </div>
              </div>
              <div className="recent-runs-chip-row">            {timeFilterOptions.map((option) => (
              <button key={option.key} type="button" className={`recent-runs-chip${activeMode === option.key ? ' is-active' : ''}`} onClick={() => {
                setActiveMode(option.key);
                setSelectedYear(null);
                setSelectedMonth(null);
              }}>
                {option.label}
              </button>
            ))}
          </div>
          <div className="recent-runs-chip-row recent-runs-chip-row--secondary">{renderSecondaryFilterRow()}</div>
            </section>
            <section className="recent-runs-stats-grid">
          <article className="recent-runs-stat-card"><span>{t('runs.total_distance')}</span><strong>{totalDistanceText}</strong></article>
          <article className="recent-runs-stat-card"><span>{t('runs.average_pace')}</span><strong>{avgPaceText}</strong></article>
          <article className="recent-runs-stat-card"><span>{t('runs.metric_moving_time')}</span><strong>{totalTimeText}</strong></article>
            </section>
            {filteredRuns.length > 0 ? (
              <section className="recent-runs-insight-strip" aria-label={t('runs.stitch_pattern_title')}>
            <article className="recent-runs-insight-card recent-runs-insight-card--primary">
              <span>{t('runs.stitch_pattern_title')}</span>
              <strong>{t('runs.insight_runs_count', { count: filteredRuns.length })}</strong>
              <p>{t('runs.insight_active_days', { count: activeDaysCount })}</p>
            </article>
            <article className="recent-runs-insight-card">
              <span>{t('runs.insight_fastest_label')}</span>
              <strong>{fastestRun ? formatPace(Number(fastestRun.run.distanceKm || 0), Number(fastestRun.run.movingTimeSeconds || 0), lang) : '--'}</strong>
              <p>{fastestRun?.run?.name || t('runs.default_run_name')}</p>
            </article>
            <article className="recent-runs-insight-card">
              <span>{t('runs.insight_longest_label')}</span>
              <strong>{longestRun ? formatDistance(Number(longestRun.distanceKm || 0), 1, lang) : '--'}</strong>
              <p>{longestRun?.name || t('runs.default_run_name')}</p>
            </article>
              </section>
            ) : null}
            <section className="recent-runs-card-list" aria-label={t('runs.full_history')}>
          {loadState === 'loading' ? <div className="recent-runs-status">{t('runs.loading')}</div> : null}
          {loadState === 'error' ? <div className="recent-runs-status">{t('runs.load_error')}</div> : null}
          {loadState === 'ready' && filteredRuns.length === 0 ? <div className="recent-runs-status recent-runs-status--empty">{t('runs.empty')}</div> : null}
          {loadState === 'ready' && filteredRuns.length > 0 ? (
              <>
                <div className="recent-runs-page-list">
                  {visibleRuns.map((run) => (
                    <RunCard
                      key={run.id || `${run.startTime || run.startDate}-${run.name || 'run'}`}
                      run={run}
                      t={t}
                      lang={lang}
                      routePreviewFallbacks={routePreviewFallbacks}
                      onOpen={openRun}
                    />
                  ))}
                </div>
                {hasMoreRuns ? (
                  <div ref={loadMoreSentinelRef} className="recent-runs-load-more-sentinel" aria-live="polite">
                    <span>{t('runs.loading')}</span>
                  </div>
                ) : null}
              </>
            ) : null}
            </section>
            <footer className="runner-shell-footer runner-dashboard-footer">
              <FooterNavLinks />
            </footer>
          </main>
        </div>
      </main>
      {renderImportModal()}
    </div>
  );
});

export default Runs;
