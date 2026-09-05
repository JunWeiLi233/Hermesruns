import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiFetch, apiJson } from '../../api';
import { cachedApiJson, invalidateResourceCache } from '../../api/resourceCache';
import Modal from '../../components/Modal';
import AppIcon from '../../components/AppIcon';
import CoachIdentityBadge from '../../components/CoachIdentityBadge';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { resolveAssignedCoach } from '../../utils/coachIdentity';
import { resolvePersonalizedCoachRecommendation } from '../../utils/personalizedCoachPlan';
import { formatDuration } from '../../utils/format';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { preloadRoute } from '../../utils/routePreload';
import { computeVdotTrend } from '../../utils/vdot';
import { buildAnalysisSnapshot, normalizeAnalysisList } from '../../utils/analysisInsights';
import PageSkeleton from '../../components/PageSkeleton';
import '../../styles/analysis-summary.css';
import fitnessTrendIcon from '../../assets/fitness-trend-icon-green.webp';
import injuryRiskIcon from '../../assets/injury-risk-icon.webp';
import coachAdviceIcon from '../../assets/coach-advice-icon.webp';
import intensityDistributionCardIcon from '../../assets/intensity-distribution-card-icon.webp';
import performanceForecastIcon from '../../assets/performance-forecast-icon.webp';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const ANALYSIS_DAY_MS = 24 * 60 * 60 * 1000;
const TRAINING_ZONE_BASIS_STYLE = {
  display: 'block',
  marginTop: '0.42rem',
  color: 'rgba(91, 74, 64, 0.72)',
  fontSize: 'clamp(0.72rem, 0.74vw, 0.82rem)',
  fontWeight: 750,
  letterSpacing: '0.035em',
  lineHeight: 1.35,
};

function Gauge({ value, color }) {
  const clamped = Math.max(0, Math.min(1.8, Number(value || 0)));
  const progressPct = Math.max(0, Math.min((clamped / 1.8) * 100, 100));
  const hasProgress = progressPct > 0;
  const path = 'M 24 126 A 86 86 0 0 1 196 126';
  return (
    <svg viewBox="0 0 220 140" className="analysis-overview-gauge-svg" aria-hidden="true">
      <path d={path} pathLength="100" className="analysis-overview-gauge-track" />
      {hasProgress ? (
        <path
          d={path}
          pathLength="100"
          className="analysis-overview-gauge-progress"
          style={{ stroke: color, strokeDasharray: `${progressPct} 100` }}
        />
      ) : null}
    </svg>
  );
}

function RiskRing({ score, color }) {
  const radius = 35;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(100, Math.max(0, Number(score) || 0));
  const offset = circumference - (pct / 100) * circumference;
  return (
    <svg viewBox="0 0 100 100" className="analysis-injury-prevention-risk-ring-svg" aria-hidden="true">
      <circle cx="50" cy="50" r={radius} className="analysis-injury-prevention-risk-ring-track" />
      <circle
        cx="50" cy="50"
        r={radius}
        className="analysis-injury-prevention-risk-ring-progress"
        style={{ stroke: color, strokeDasharray: circumference, strokeDashoffset: offset }}
      />
      <text x="50" y="50" className="analysis-injury-prevention-risk-ring-center">
        {score != null ? `${Math.round(score)}%` : '--'}
      </text>
    </svg>
  );
}

function formatTrainingZoneBasisUpdated(value, t) {
  const date = value instanceof Date ? value : new Date(value || 0);
  if (!Number.isFinite(date.getTime())) return t('analysis.stitch_zone_basis_updated_recently');
  const days = Math.max(0, Math.floor((Date.now() - date.getTime()) / ANALYSIS_DAY_MS));
  if (days <= 0) return t('analysis.stitch_zone_basis_updated_today');
  return t('analysis.stitch_zone_basis_updated_days', { count: days });
}

function buildTrainingZoneBasisLabel(snapshot, t) {
  const bestVdot = Number(snapshot?.bestVdot);
  if (!Number.isFinite(bestVdot) || bestVdot <= 0) {
    return t('analysis.stitch_zone_basis_empty');
  }

  const windowEntries = Array.isArray(snapshot?.bestEstimate?.windowEntries)
    ? snapshot.bestEstimate.windowEntries
    : [];
  const sampleCount = windowEntries.length
    || Number(snapshot?.bestEstimate?.usedTopN || 0)
    || (Array.isArray(snapshot?.entries) ? snapshot.entries.length : 0);
  const latestEntry = windowEntries.reduce((latest, entry) => {
    const date = entry?.date instanceof Date ? entry.date : new Date(entry?.date || 0);
    if (!Number.isFinite(date.getTime())) return latest;
    if (!latest || date.getTime() > latest.getTime()) return date;
    return latest;
  }, null);
  const bestRun = snapshot?.bestEstimate?.bestRun;
  const updated = formatTrainingZoneBasisUpdated(
    latestEntry || bestRun?.startTime || bestRun?.startDate,
    t,
  );

  return t('analysis.stitch_zone_basis', {
    vdot: bestVdot.toFixed(1),
    count: Math.max(1, sampleCount),
    updated,
  });
}

export default function Analysis() {
  const { isAuthenticated, email } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [, setProfileState] = useState('loading');
  const [runsState, setRunsState] = useState('loading');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [injuryStatus, setInjuryStatus] = useState(null);
  const [coachToday, setCoachToday] = useState(null);
  const [injuryStatusLoading, setInjuryStatusLoading] = useState(false);
  const [injuryStatusError, setInjuryStatusError] = useState(false);
  const [sorenessSubmitting, setSorenessSubmitting] = useState(false);
  const [sorenessLevelOverride, setSorenessLevelOverride] = useState(null);
  const [sorenessError, setSorenessError] = useState(null);
  const [sorenessModalLevel, setSorenessModalLevel] = useState(null);
  const [hoveredVo2BarKey, setHoveredVo2BarKey] = useState(null);
  const vo2BarsContainerRef = useRef(null);
  const vo2TouchDismissTimerRef = useRef(null);
  const vo2TouchActiveRef = useRef(false);

  const clearVo2TouchTimer = useCallback(() => {
    if (vo2TouchDismissTimerRef.current) {
      clearTimeout(vo2TouchDismissTimerRef.current);
      vo2TouchDismissTimerRef.current = null;
    }
  }, []);

  const dismissVo2Tooltip = useCallback(() => {
    clearVo2TouchTimer();
    vo2TouchActiveRef.current = false;
    setHoveredVo2BarKey(null);
  }, [clearVo2TouchTimer]);

  const handleVo2BarPointerDown = useCallback((event, key) => {
    if (event.pointerType === 'touch' || event.pointerType === 'pen') {
      vo2TouchActiveRef.current = true;
      setHoveredVo2BarKey(key);
      clearVo2TouchTimer();
      vo2TouchDismissTimerRef.current = setTimeout(() => {
        vo2TouchActiveRef.current = false;
        setHoveredVo2BarKey(null);
      }, 3000);
    }
  }, [clearVo2TouchTimer]);

  const handleVo2BarPointerEnter = useCallback((event, key) => {
    if (event.pointerType === 'mouse') {
      setHoveredVo2BarKey(key);
    }
  }, []);

  const handleVo2BarPointerLeave = useCallback((event, key) => {
    if (event.pointerType === 'mouse') {
      setHoveredVo2BarKey((current) => (current === key ? null : current));
    }
  }, []);

  useEffect(() => {
    if (!hoveredVo2BarKey) return undefined;
    const handlePointerDownOutside = (event) => {
      const container = vo2BarsContainerRef.current;
      if (container && container.contains(event.target)) return;
      dismissVo2Tooltip();
    };
    const handleScroll = () => {
      if (vo2TouchActiveRef.current) dismissVo2Tooltip();
    };
    document.addEventListener('pointerdown', handlePointerDownOutside, true);
    window.addEventListener('scroll', handleScroll, { passive: true, capture: true });
    return () => {
      document.removeEventListener('pointerdown', handlePointerDownOutside, true);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [hoveredVo2BarKey, dismissVo2Tooltip]);

  useEffect(() => () => clearVo2TouchTimer(), [clearVo2TouchTimer]);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);
  const [importStatus, setImportStatus] = useState('idle');
  const selectedFileCount = [fitExportFiles, corosFiles, huaweiFiles]
    .reduce((total, files) => total + (files?.length ?? 0), 0);
  const assignedCoach = useMemo(() => resolveAssignedCoach(profile, email), [profile, email]);
  const coachSuggestionTitle = useMemo(() => {
    const personalized = resolvePersonalizedCoachRecommendation({ coachPayload: coachToday, t, lang, unit });
    return personalized?.recommendation?.title || '';
  }, [coachToday, t, lang, unit]);
  const vdotTrend = useMemo(() => computeVdotTrend(runs), [runs]);
  const hasWeatherAdjustments = useMemo(() => runs.some((r) => (r.pacePenaltySecPerKm || 0) > 0), [runs]);

  // Bumping this counter invalidates results from superseded loads so a
  // retry never clobbers a newer fetch (same guard style as ProfileDashboard).
  const analysisLoadGenerationRef = useRef(0);

  const loadAnalysisData = useCallback(() => {
    const loadToken = ++analysisLoadGenerationRef.current;
    const isCurrentLoad = () => analysisLoadGenerationRef.current === loadToken;

    async function loadProfile() {
      setProfileState('loading');
      try {
        const profileData = await cachedApiJson('/api/profile/me');
        if (!isCurrentLoad()) return;
        setProfile(profileData);
        setProfileState('ready');
      } catch {
        if (isCurrentLoad()) setProfileState('error');
      }
    }

    async function loadRuns() {
      setRunsState('loading');
      try {
        const activitiesData = await cachedApiJson('/api/activities/analysis');
        if (!isCurrentLoad()) return;
        startTransition(() => {
          setRuns(Array.isArray(activitiesData) ? activitiesData : []);
        });
        setRunsState('ready');
      } catch {
        if (isCurrentLoad()) setRunsState('error');
      }
    }

    async function loadCoachToday() {
      try {
        const coachTodayData = await apiJson('/api/coach/today').catch(() => null);
        if (!isCurrentLoad()) return;
        setCoachToday(coachTodayData && typeof coachTodayData === 'object' ? coachTodayData : null);
      } catch {
        if (isCurrentLoad()) setCoachToday(null);
      }
    }

    loadProfile();
    loadRuns();
    loadCoachToday();
  }, []);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    loadAnalysisData();
    return () => {
      analysisLoadGenerationRef.current += 1;
    };
  }, [isAuthenticated, navigate, loadAnalysisData]);

  const snapshot = useMemo(() => buildAnalysisSnapshot(runs, lang, unit), [runs, lang, unit]);
  const bestVdot = snapshot.bestVdot;
  const vo2Bars = normalizeAnalysisList(snapshot.vo2Bars);
  const trainingLoad = snapshot.trainingLoad;
  const loadZone = snapshot.loadZone;
  const analysisLoadTheme = loadZone.tone === 'danger' ? 'red' : loadZone.tone === 'warn' ? 'yellow' : 'green';
  const polarized = snapshot.polarized;
  const injury = snapshot.injury;
  const predictionRows = normalizeAnalysisList(snapshot.predictionRows);
  const trainingZones = normalizeAnalysisList(snapshot.trainingZones);
  const marathonRow = snapshot.marathonRow;
  const marathonDelta = snapshot.marathonDeltaSeconds;
  const hasRuns = runs.length > 0;
  const currentVo2Bar = vo2Bars.find((bar) => bar.current) || vo2Bars[vo2Bars.length - 1] || null;
  const currentVdotLabel = currentVo2Bar?.value != null ? currentVo2Bar.value.toFixed(1) : '--';
  const adjustedVdotLabel = currentVo2Bar?.hasAdjustment ? currentVo2Bar.adjustedValue.toFixed(1) : '--';
  const trainingZoneBasisLabel = buildTrainingZoneBasisLabel(snapshot, t);
  useEffect(() => {
    if (!isAuthenticated) return;
    let cancelled = false;
    async function fetchInjuryStatus() {
      setInjuryStatusLoading(true);
      try {
        const data = await apiJson('/api/injury-risk/status');
        if (!cancelled) {
          setInjuryStatus(data);
          setInjuryStatusError(false);
        }
      } catch {
        if (!cancelled) setInjuryStatusError(true);
      } finally {
        if (!cancelled) setInjuryStatusLoading(false);
      }
    }
    fetchInjuryStatus();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const injuryLevelLabel = t(`analysis.stitch_injury_${injury.level}`);
  const latestSorenessLevel = String(
    sorenessLevelOverride ?? injuryStatus?.recentLogs?.[0]?.level ?? injuryStatus?.sorenessLevel ?? ''
  ).toLowerCase();
  const hasSorenessLog = ['low', 'medium', 'high'].includes(latestSorenessLevel);
  const localizedCoachAdvice = injuryStatus?.risk === 'LOW'
    ? t('analysis.stitch_injury_prevention_coach_advice_low')
    : injuryStatus?.coachAdvice;
  const injuryAcwrColor = useMemo(() => {
    const acwr = Number(injuryStatus?.acwr) || 0;
    if (acwr < 1.0) return '#38a35e';
    if (acwr <= 1.2) return '#d98c3a';
    return '#d94a3a';
  }, [injuryStatus?.acwr]);
  const hoveredVo2Bar = vo2Bars.find((bar) => bar.key === hoveredVo2BarKey) || null;

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'analysis',
  }), [lang, t]);

  async function handleImport(event) {
    event.preventDefault();
    if (selectedFileCount === 0 || importStatus === 'uploading') return;

    const formData = new FormData();
    if (fitExportFiles) Array.from(fitExportFiles).forEach((file) => formData.append('exports', file));
    if (corosFiles) Array.from(corosFiles).forEach((file) => formData.append('coros', file));
    if (huaweiFiles) Array.from(huaweiFiles).forEach((file) => formData.append('huawei', file));

    setImportStatus('uploading');
    try {
      await apiFetch('/api/import/batch', { method: 'POST', body: formData });
    } catch {
      setImportStatus('error');
      return;
    }

    setFitExportFiles(null);
    setCorosFiles(null);
    setHuaweiFiles(null);
    setImportStatus('idle');
    setImportModalOpen(false);
    setRunsState('loading');
    try {
      invalidateResourceCache('/api/activities');
      const activitiesData = await apiJson('/api/activities/analysis');
      const list = Array.isArray(activitiesData) ? activitiesData : [];
      startTransition(() => {
        setRuns(list);
      });
      setRunsState('ready');
    } catch {
      setRunsState('error');
    }
  }

  function closeImportModal() {
    if (importStatus === 'uploading') return;
    setFitExportFiles(null);
    setCorosFiles(null);
    setHuaweiFiles(null);
    setImportStatus('idle');
    setImportModalOpen(false);
  }

  async function handleSaveName(event) {
    event.preventDefault();
    try {
      await apiFetch('/api/profile/me', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayNameInput }),
      });
      invalidateResourceCache('/api/profile/me');
      setProfile((current) => ({ ...current, displayName: displayNameInput }));
      setNameModalOpen(false);
    } catch {
      // noop
    }
  }

  async function handleSorenessLog(level) {
    const previousSorenessLevel = latestSorenessLevel;
    setSorenessSubmitting(true);
    setSorenessLevelOverride(level);
    setSorenessError(null);
    try {
      await apiJson('/api/injury-risk/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });

      // The write is complete, so keep the selected state visible while the
      // heavier assessment refresh runs in the background. A slow refresh must
      // not make a successful check-in look like a dead button.
      void apiJson('/api/injury-risk/status')
        .then((data) => {
          setInjuryStatus(data);
          setInjuryStatusError(false);
        })
        .catch(() => {
          // The optimistic selection remains authoritative for this mounted
          // card; the next page load will reconcile with the server status.
        });
    } catch {
      setSorenessLevelOverride(previousSorenessLevel || null);
      setSorenessError(t('analysis.stitch_injury_prevention_log_error'));
    } finally {
      setSorenessSubmitting(false);
    }
  }

  async function handleSorenessModalConfirm() {
    if (!sorenessModalLevel || sorenessSubmitting) return;
    const level = sorenessModalLevel;
    setSorenessModalLevel(null);
    await handleSorenessLog(level);
  }

  if (runsState === 'loading') return <PageSkeleton variant="analysis" />;

  return (
    <div
      className={`runner-shell-page runner-dashboard-page analysis-page-shell${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}
      data-analysis-load-theme={analysisLoadTheme}
    >
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
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">
              {isSidebarCollapsed ? '>' : '<'}
            </span>
          </button>
        </div>
        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('runner-shell-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)} onPointerEnter={() => preloadRoute(item.route)} onFocus={() => preloadRoute(item.route)}>
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
            onPointerEnter={() => preloadRoute('/today-run')}
            onFocus={() => preloadRoute('/today-run')}
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
              activeLabel={t('profile.dashboard_nav_analysis')}
              navigate={navigate}
            />
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button
                type="button"
                className="runner-shell-avatar"
                aria-label={t('analysis.stitch_edit_profile')}
                onClick={() => {
                  setDisplayNameInput(profile?.displayName || '');
                  setNameModalOpen(true);
                }}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas">
          {runsState === 'loading' ? (
            <section className="analysis-overview-empty-shell">
              <div className="premium-empty-state analysis-overview-empty-state premium-empty-state--loading">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_loading')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_helper')}</p>
              </div>
            </section>
          ) : runsState === 'error' ? (
            <section className="analysis-overview-empty-shell">
              <div className="premium-empty-state analysis-overview-empty-state">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_load_error')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_helper')}</p>
                <div className="analysis-overview-empty-actions">
                  <button type="button" className="runner-shell-inline-btn analysis-overview-empty-action is-primary" onClick={loadAnalysisData}>
                    {t('profile.retry_strava')}
                  </button>
                </div>
              </div>
            </section>
          ) : !hasRuns ? (
            <section className="analysis-overview-empty-shell">
              <div className="premium-empty-state analysis-overview-empty-state">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_empty_title')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_copy')}</p>
                <p className="premium-empty-state__helper">{t('analysis.stitch_empty_helper')}</p>
                <div className="analysis-overview-empty-actions">
                  <button type="button" className="runner-shell-inline-btn analysis-overview-empty-action is-primary" onClick={() => setImportModalOpen(true)}>
                    {t('analysis.stitch_import_data')}
                  </button>
                  <button type="button" className="runner-shell-inline-btn analysis-overview-empty-action" onClick={() => navigate('/runs')}>
                    {t('analysis.stitch_open_runs')}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
              <section className="analysis-overview-grid analysis-overview-grid--hero analysis-profile-cockpit">
                <article className="analysis-overview-card analysis-overview-card--vo2 analysis-profile-primary">
                  <div className="analysis-overview-card-head">
                    <h2 className="analysis-overview-vdot-title">
                      <AppIcon name="load_balance_runner" className="analysis-overview-vdot-runner-icon" />
                      {t('analysis.stitch_vo2_title')}
                    </h2>
                    <div className="analysis-overview-hero-value">
                      <span className="analysis-overview-hero-value-label">{t('profile.analysis_current_vo2')}</span>
                      <div className="analysis-overview-hero-value-row">
                        <strong>{bestVdot ? bestVdot.toFixed(1) : '--'}</strong>
                        <span className="analysis-overview-hero-value-unit">{t('analysis.stitch_vo2_unit')}</span>
                      </div>
                    </div>
                  </div>
                  <div className="analysis-overview-vo2-bars" ref={vo2BarsContainerRef}>
                    {hoveredVo2Bar ? (
                      <div
                        className="analysis-overview-vo2-tooltip"
                        aria-hidden="true"
                        style={{
                          left: `${vo2Bars.findIndex((bar) => bar.key === hoveredVo2BarKey) * (100 / vo2Bars.length) + (100 / vo2Bars.length / 2)}%`,
                        }}
                      >
                        <span>{hoveredVo2Bar.label}</span>
                        <div className="analysis-overview-vo2-tooltip-values">
                          <div className="analysis-overview-vo2-tooltip-row">
                            <strong>{hoveredVo2Bar.value != null ? hoveredVo2Bar.value.toFixed(1) : '--'}</strong>
                            <small>VO2max</small>
                          </div>
                          {hoveredVo2Bar.hasAdjustment && (
                            <div className="analysis-overview-vo2-tooltip-row is-adjusted">
                              <strong>{hoveredVo2Bar.adjustedValue.toFixed(1)}</strong>
                              <small>{t('analysis.vdot_weather_adjusted')}</small>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                    {vo2Bars.map((bar) => (
                      <div
                        key={bar.key}
                        className="analysis-overview-vo2-bar-col"
                        tabIndex={0}
                        role="img"
                        aria-label={`${bar.label}: VO2max ${bar.value != null ? bar.value.toFixed(1) : '--'}${bar.hasAdjustment ? `, Adjusted ${bar.adjustedValue.toFixed(1)}` : ''}`}
                        onPointerDown={(event) => handleVo2BarPointerDown(event, bar.key)}
                        onPointerEnter={(event) => handleVo2BarPointerEnter(event, bar.key)}
                        onPointerLeave={(event) => handleVo2BarPointerLeave(event, bar.key)}
                        onFocus={() => setHoveredVo2BarKey(bar.key)}
                        onBlur={() => setHoveredVo2BarKey((current) => (current === bar.key ? null : current))}
                      >
                        <div className="analysis-overview-vo2-bar-stack">
                          {bar.hasAdjustment && (
                            <div
                              className="analysis-overview-vo2-bar is-adjusted"
                              style={{ height: `${bar.adjustedHeight}%` }}
                            />
                          )}
                          <div
                            className={cx('analysis-overview-vo2-bar', bar.current && 'is-current', hoveredVo2BarKey === bar.key && 'is-hovered')}
                            style={{ height: `${bar.height}%` }}
                          >
                            {null}
                          </div>
                        </div>
                        <span className={cx('analysis-overview-vo2-label', bar.current && 'is-current')}>{bar.label}</span>
                      </div>
                    ))}
                  </div>
                  <div className="analysis-overview-vo2-legend">
                    <div className="analysis-overview-vo2-legend-item">
                      <span className="analysis-overview-vo2-legend-dot" />
                      <span>{t('analysis.vdot_raw')}</span>
                    </div>
                    {hasWeatherAdjustments && (
                      <div className="analysis-overview-vo2-legend-item">
                        <span className="analysis-overview-vo2-legend-dot is-adjusted" />
                        <span>{t('analysis.vdot_weather_adjusted')}</span>
                      </div>
                    )}
                  </div>

                </article>

                <div className="analysis-overview-side-stack analysis-profile-reference-grid">
                  <button
                    type="button"
                    className="analysis-overview-card analysis-overview-card--load analysis-profile-reference-card is-load analysis-overview-card--interactive"
                    onClick={() => navigate('/analysis/load-balance')}
                  >
                    <span className="analysis-overview-card-kicker analysis-overview-card-kicker--load">
                      <AppIcon name="load_balance" className="analysis-load-balance-icon" />
                      <span>{t('analysis.stitch_acwr_title')}</span>
                    </span>
                    <div
                      className="analysis-overview-gauge-stack"
                      style={{ '--analysis-gauge-value-color': loadZone.color }}
                    >
                      <Gauge value={trainingLoad?.lastAcwr || 0} color={loadZone.color} />
                      <div className="analysis-overview-gauge-value">{trainingLoad?.lastAcwr != null ? trainingLoad.lastAcwr.toFixed(2) : '--'}</div>
                    </div>
                    <p>{t('analysis.stitch_acwr_copy')}</p>
                  </button>

                  <button
                    type="button"
                    className="analysis-overview-card analysis-overview-card--coach analysis-profile-reference-card is-coach analysis-overview-card--interactive"
                    onClick={() => navigate('/analysis/coach-insight')}
                  >
                    <div className="analysis-overview-coach-head">
                      <div className="analysis-overview-coach-copy">
                        <span className="analysis-overview-card-kicker">
                          <img src={coachAdviceIcon} alt="" className="analysis-coach-advice-icon" />
                          {t('analysis.stitch_coach_title')}
                        </span>
                        {coachSuggestionTitle ? (
                          <h3 className="analysis-overview-coach-quote">{coachSuggestionTitle}</h3>
                        ) : null}
                        <CoachIdentityBadge coach={assignedCoach} lang={lang} className="analysis-overview-coach-badge" />
                      </div>
                    </div>
                  </button>
                  <button
                    type="button"
                    className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--injury analysis-profile-reference-card is-injury analysis-overview-card--interactive"
                    onClick={() => navigate('/analysis/injury-risk')}
                  >
                    <div className="analysis-overview-card-title-block">
                      <span className="analysis-overview-card-kicker">
                        <img src={injuryRiskIcon} alt="" className="analysis-injury-risk-icon" />
                        {t('analysis.stitch_injury_title')}
                      </span>
                    </div>
                    <div className="analysis-overview-risk-labels">
                      <span>{t('analysis.stitch_injury_low')}</span>
                      <span>{t('analysis.stitch_injury_moderate')}</span>
                      <span>{t('analysis.stitch_injury_high')}</span>
                    </div>
                    <div className="analysis-overview-risk-meter">
                      <span className={injury.level === 'low' ? 'is-on is-green' : ''} />
                      <span className={injury.level === 'moderate' ? 'is-on is-warn' : ''} />
                      <span className={injury.level === 'high' ? 'is-on is-danger' : ''} />
                    </div>
                  </button>

                  <article
                    className={cx(
                      'analysis-overview-card analysis-overview-card--insight analysis-overview-card--vdot-insight analysis-profile-reference-card is-trend',
                      !vdotTrend.hasData && 'is-empty',
                    )}
                  >
                    {vdotTrend.hasData ? (
                      <>
                        <span className="analysis-overview-card-kicker analysis-vdot-trend-kicker">
                          <img className="analysis-vdot-trend-icon" src={fitnessTrendIcon} alt="" aria-hidden="true" />
                          <span>{t('analysis.vdot_trend_insight_title')}</span>
                        </span>
                        <div className="analysis-overview-trend-stack" aria-hidden={false}>
                          <h3
                            className={cx(
                              'analysis-overview-vdot-trend-heading',
                              vdotTrend.direction === 'improving' && 'is-positive',
                              vdotTrend.direction === 'declining' && 'is-negative',
                            )}
                          >
                            <AppIcon
                              name={vdotTrend.direction === 'improving' ? 'trending_up' : vdotTrend.direction === 'declining' ? 'trending_down' : 'trending_flat'}
                              className={cx('runner-dashboard-side-link-icon', vdotTrend.direction === 'improving' && 'is-positive', vdotTrend.direction === 'declining' && 'is-negative')}
                            />
                            <span>{t(`profile.vdot_trend_${vdotTrend.direction}`)}</span>
                          </h3>
                          <div className="analysis-overview-insight-delta">
                            <strong>{vdotTrend.delta > 0 ? `+${vdotTrend.delta.toFixed(1)}` : vdotTrend.delta.toFixed(1)}</strong>
                          </div>
                        </div>
                        <p className="analysis-overview-insight-copy">{t(`analysis.vdot_trend_insight_copy_${vdotTrend.direction}`)}</p>
                      </>
                    ) : (
                      <>
                        <span className="analysis-overview-card-kicker analysis-vdot-trend-kicker">
                          <span>{t('profile.vdot_trend_label')}</span>
                        </span>
                        <div className="analysis-overview-trend-stack">
                          <h3 className="analysis-overview-vdot-trend-heading">{t('analysis.vdot_trend_empty_title')}</h3>
                          <div className="analysis-overview-insight-delta">
                            <strong>--</strong>
                          </div>
                        </div>
                        <p className="analysis-overview-insight-copy">{t('analysis.vdot_trend_empty_copy')}</p>
                      </>
                    )}
                  </article>
                </div>
              </section>

              <section className="analysis-overview-grid analysis-overview-grid--summary analysis-profile-bento-grid">
                <button
                  type="button"
                  className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--intensity analysis-profile-bento-card analysis-overview-card--interactive"
                  onClick={() => navigate('/analysis/intensity')}
                >
                  <span className="analysis-overview-card-kicker">
                    <img src={intensityDistributionCardIcon} alt="" className="analysis-intensity-card-icon" />
                    {t('analysis.stitch_intensity_title')}
                  </span>
                  <div className="analysis-overview-intensity-row">
                    <strong>
                      {polarized
                        ? `${polarized.easySharePct}/${polarized.moderateSharePct}/${polarized.hardSharePct}`
                        : '--/--/--'}
                    </strong>
                    <AppIcon name="check_circle" className="runner-dashboard-side-link-icon" />
                  </div>
                  <div className="analysis-overview-intensity-bar">
                    <span style={{ width: `${polarized?.easySharePct || 0}%` }} />
                    <span className="is-moderate" style={{ width: `${polarized?.moderateSharePct || 0}%` }} />
                    <span className="is-hard" style={{ width: `${polarized?.hardSharePct || 0}%` }} />
                  </div>
                  <div className="analysis-overview-intensity-labels">
                    <span>{t('analysis.stitch_low_intensity', { value: polarized?.easySharePct ?? 0 })}</span>
                    <span>{t('analysis.stitch_moderate_intensity', { value: polarized?.moderateSharePct ?? 0 })}</span>
                    <span>{t('analysis.stitch_high_intensity', { value: polarized?.hardSharePct ?? 0 })}</span>
                  </div>
                </button>


                <button
                  type="button"
                  className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--forecast analysis-profile-bento-card analysis-overview-card--interactive"
                  onClick={() => navigate('/prediction/marathon')}
                >
                  <span className="analysis-overview-card-kicker">
                    <img src={performanceForecastIcon} alt="" className="analysis-performance-forecast-icon" />
                    {t('analysis.stitch_forecast_title')}
                  </span>
                  <strong>{marathonRow?.timeLabel || '--'}</strong>
                  <div className="analysis-overview-forecast-footer">
                    <span className={cx('analysis-overview-forecast-delta', marathonDelta != null && marathonDelta < 0 && 'is-positive')}>
                      {marathonDelta == null ? t('analysis.stitch_no_delta') : `${marathonDelta < 0 ? '' : '+'}${formatDuration(Math.abs(marathonDelta))} ${t('analysis.stitch_vs_prev')}`}
                    </span>
                    <span className="analysis-overview-arrow-link" aria-hidden="true">
                      <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                    </span>
                  </div>
                </button>
              </section>

              <section className="analysis-profile-table-grid" aria-label={t('profile.dashboard_nav_analysis')}>
                <section className="analysis-overview-card analysis-overview-card--prediction-table analysis-overview-card--training-zones analysis-profile-table-card">
                  <div className="analysis-overview-table-head">
                    <h2>{t('analysis.stitch_training_zones_title')}</h2>
                  </div>
                  <div className="analysis-overview-table-wrap">
                    <table className="analysis-overview-table">
                      <thead>
                        <tr>
                          <th>{t('analysis.stitch_zone_label')}</th>
                          <th>{t('analysis.stitch_zone_pace')}</th>
                          <th>{t('analysis.stitch_zone_purpose')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {trainingZones.map((zone) => (
                          <tr key={zone.key}>
                            <td className="analysis-overview-zone-name">{t(`analysis.stitch_zone_${zone.key}`)}</td>
                            <td className="is-accent">{zone.paceLabel}</td>
                            <td>
                              <span>{t(`analysis.stitch_zone_${zone.key}_purpose`)}</span>
                              <span className="analysis-zone-basis-line" style={TRAINING_ZONE_BASIS_STYLE}>
                                {trainingZoneBasisLabel}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="analysis-overview-card analysis-overview-card--prediction-table analysis-profile-table-card analysis-profile-table-card--predictions">
                  <div className="analysis-overview-table-head">
                    <h2>{t('analysis.stitch_predictions_title')}</h2>
                  </div>
                  <div className="analysis-overview-table-wrap">
                    <table className="analysis-overview-table">
                      <thead>
                        <tr>
                          <th>{t('analysis.stitch_event_distance')}</th>
                          <th>{t('analysis.stitch_estimated_time')}</th>
                          <th>{t(unit === 'mile' ? 'analysis.stitch_pace_per_mile' : 'analysis.stitch_pace_per_km')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {predictionRows.map((row) => (
                          <tr
                            key={row.key}
                            className="clickable-row"
                            role="link"
                            tabIndex={0}
                            aria-label={`${row.label} ${row.timeLabel} ${row.paceLabel}`}
                            onClick={() => navigate(`/prediction/${row.key}`)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault();
                                navigate(`/prediction/${row.key}`);
                              }
                            }}
                          >
                            <td>{row.label}</td>
                            <td className="is-accent">{row.timeLabel}</td>
                            <td>{`${row.paceLabel} /${unit === 'mile' ? 'mi' : 'km'}`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="analysis-overview-table-actions">
                    <button type="button" className="runner-shell-inline-btn" onClick={() => setImportModalOpen(true)}>{t('analysis.stitch_import_data')}</button>
                    <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
                  </div>
                </section>
              </section>

              {/* === Injury Prevention Dashboard === */}
              {injuryStatusLoading && (
                <section className="analysis-injury-prevention-section">
                  <div className="analysis-injury-prevention-head">
                    <h2>{t('analysis.stitch_injury_prevention_title')}</h2>
                  </div>
                  <div className="analysis-injury-prevention-status-loading">{t('analysis.stitch_loading')}</div>
                </section>
              )}
              {injuryStatusError && !injuryStatusLoading && (
                <section className="analysis-injury-prevention-section">
                  <div className="analysis-injury-prevention-head">
                    <h2>{t('analysis.stitch_injury_prevention_title')}</h2>
                  </div>
                  <div className="analysis-injury-prevention-status-error">{t('analysis.stitch_injury_prevention_error')}</div>
                </section>
              )}
              {!injuryStatusLoading && !injuryStatusError && injuryStatus && (
                <section className="analysis-injury-prevention-section" aria-label={t('analysis.stitch_injury_prevention_title')}>
                  <div className="analysis-injury-prevention-head">
                    <h2>{t('analysis.stitch_injury_prevention_title')}</h2>
                    <p>{t('analysis.stitch_injury_prevention_subtitle')}</p>
                  </div>
                  <div className="analysis-overview-grid analysis-injury-prevention-grid">
                    {/* Card 1: Combined Risk Score */}
                    <button
                      type="button"
                      className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--interactive"
                      onClick={() => navigate('/analysis/injury-risk')}
                    >
                      <h3 className="analysis-overview-metric-title">{t('analysis.stitch_injury_prevention_risk_title')}</h3>
                      <div className="analysis-injury-prevention-risk-ring-wrap">
                        <RiskRing score={injuryStatus?.combinedRiskScore} color={(Number(injuryStatus?.combinedRiskScore) || 0) < 30 ? '#38a35e' : (Number(injuryStatus?.combinedRiskScore) || 0) < 60 ? '#d98c3a' : '#d94a3a'} />
                        <div className="analysis-injury-prevention-risk-meta">
                          <span className="analysis-injury-prevention-risk-label">
                            {t(`analysis.stitch_injury_prevention_rec_${injuryStatus?.recommendation || 'ready'}`)}
                          </span>
                          <span className={cx('analysis-injury-prevention-rec', `is-${injuryStatus?.recommendation || 'ready'}`)}>
                            {t(`analysis.stitch_injury_prevention_rec_${injuryStatus?.recommendation || 'ready'}`)}
                          </span>
                        </div>
                      </div>
                    </button>

                    {/* Card 2: ACWR Monitor */}
                    <button
                      type="button"
                      className="analysis-overview-card analysis-overview-card--metric analysis-overview-card--interactive"
                      onClick={() => navigate('/analysis/load-balance')}
                    >
                      <h3 className="analysis-overview-metric-title">{t('analysis.stitch_injury_prevention_acwr_title')}</h3>
                      <div
                        className="analysis-injury-prevention-acwr-body"
                        style={{
                          color: injuryAcwrColor,
                          '--analysis-gauge-value-color': injuryAcwrColor,
                        }}
                      >
                        <Gauge value={injuryStatus?.acwr || 0} color={injuryAcwrColor} />
                        <div className="analysis-injury-prevention-acwr-value">
                          {injuryStatus?.acwr != null ? injuryStatus.acwr.toFixed(2) : '--'}
                        </div>
                        <div className={cx('analysis-injury-prevention-acwr-trend', injuryStatus?.acwrTrend === 'up' && 'is-up', injuryStatus?.acwrTrend === 'down' && 'is-down')}>
                          <AppIcon name={injuryStatus?.acwrTrend === 'up' ? 'trending_up' : injuryStatus?.acwrTrend === 'down' ? 'trending_down' : 'trending_flat'} className="runner-dashboard-side-link-icon" />
                          <span>{t(`analysis.stitch_injury_prevention_acwr_trend_${injuryStatus?.acwrTrend || 'flat'}`)}</span>
                        </div>
                        <div className="analysis-injury-prevention-acwr-zones">
                          <span className={((Number(injuryStatus?.acwr) || 0) < 1.0) ? 'is-active' : ''}>{t('analysis.stitch_injury_prevention_acwr_zone_safe')}</span>
                          <span className={((Number(injuryStatus?.acwr) || 0) >= 1.0 && (Number(injuryStatus?.acwr) || 0) <= 1.2) ? 'is-active-warn' : ''}>{t('analysis.stitch_injury_prevention_acwr_zone_caution')}</span>
                          <span className={((Number(injuryStatus?.acwr) || 0) > 1.2) ? 'is-active-danger' : ''}>{t('analysis.stitch_injury_prevention_acwr_zone_danger')}</span>
                        </div>
                      </div>
                    </button>

                    {/* Card 3: Daily Soreness Check-in + Coach Advice */}
                    <div className="analysis-overview-card analysis-overview-card--metric">
                      <h3 className="analysis-overview-metric-title">{t('analysis.stitch_injury_prevention_soreness_title')}</h3>
                      <div className="analysis-injury-prevention-soreness-actions">
                        <button
                          type="button"
                          className={cx('analysis-injury-prevention-soreness-btn', 'is-low', latestSorenessLevel === 'low' && 'is-active-low')}
                          onClick={() => setSorenessModalLevel('low')}
                          disabled={sorenessSubmitting}
                          aria-pressed={latestSorenessLevel === 'low'}
                        >
                          {t('analysis.stitch_injury_prevention_soreness_low')}
                        </button>
                        <button
                          type="button"
                          className={cx('analysis-injury-prevention-soreness-btn', 'is-medium', latestSorenessLevel === 'medium' && 'is-active-medium')}
                          onClick={() => setSorenessModalLevel('medium')}
                          disabled={sorenessSubmitting}
                          aria-pressed={latestSorenessLevel === 'medium'}
                        >
                          {t('analysis.stitch_injury_prevention_soreness_medium')}
                        </button>
                        <button
                          type="button"
                          className={cx('analysis-injury-prevention-soreness-btn', 'is-high', latestSorenessLevel === 'high' && 'is-active-high')}
                          onClick={() => setSorenessModalLevel('high')}
                          disabled={sorenessSubmitting}
                          aria-pressed={latestSorenessLevel === 'high'}
                        >
                          {t('analysis.stitch_injury_prevention_soreness_high')}
                        </button>
                      </div>
                      {sorenessError && (
                        <div className="analysis-injury-prevention-log-error">{sorenessError}</div>
                      )}
                      {hasSorenessLog ? (
                        <div className="analysis-injury-prevention-soreness-meta">
                          {t('analysis.stitch_injury_prevention_soreness_logged', { level: t(`analysis.stitch_injury_prevention_soreness_${latestSorenessLevel}`) })}
                        </div>
                      ) : (
                        <div className="analysis-injury-prevention-soreness-empty">
                          {t('analysis.stitch_injury_prevention_coach_empty')}
                        </div>
                      )}
                      {injuryStatus?.coachAdvice ? (
                        <div className="analysis-injury-prevention-coach-advice">
                          {localizedCoachAdvice}
                        </div>
                      ) : (
                        <div className="analysis-injury-prevention-coach-empty">
                          {t('analysis.stitch_injury_prevention_coach_empty')}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              <footer className="runner-shell-footer">
                <FooterNavLinks />
                <p>{t('landing.stitch_footer_copy')}</p>
              </footer>
            </>
          )}
        </div>
      </main>

      <Modal isOpen={nameModalOpen} onClose={() => setNameModalOpen(false)} title={t('profile.name_modal_title')}>
        <form onSubmit={handleSaveName}>
          <label className="modal-label" htmlFor="analysis-display-name">{t('profile.name_label')}</label>
          <input id="analysis-display-name" type="text" maxLength={60} value={displayNameInput} onChange={(event) => setDisplayNameInput(event.target.value)} placeholder={t('profile.name_placeholder')} />
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setNameModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.save_name')}</button>
          </div>
        </form>
      </Modal>

      <Modal
        isOpen={Boolean(sorenessModalLevel)}
        onClose={() => setSorenessModalLevel(null)}
        title={t('analysis.stitch_injury_prevention_soreness_modal_title')}
        headerContent={sorenessModalLevel ? (
          <div className={cx('analysis-soreness-modal-level', `is-${sorenessModalLevel}`)}>
            {t(`analysis.stitch_injury_prevention_soreness_${sorenessModalLevel}`)}
          </div>
        ) : null}
        shellClassName="analysis-soreness-modal-shell"
        cardClassName="analysis-soreness-modal-card"
      >
        <div className="analysis-soreness-modal-content">
          <p className="analysis-soreness-modal-copy">
            {sorenessModalLevel
              ? t('analysis.stitch_injury_prevention_soreness_modal_copy', {
                level: t(`analysis.stitch_injury_prevention_soreness_${sorenessModalLevel}`),
              })
              : ''}
          </p>
          <div className="modal-actions analysis-soreness-modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setSorenessModalLevel(null)}>
              {t('analysis.stitch_injury_prevention_soreness_modal_cancel')}
            </button>
            <button type="button" className="btn-primary modal-button" onClick={handleSorenessModalConfirm} disabled={sorenessSubmitting}>
              {sorenessSubmitting
                ? t('analysis.stitch_injury_prevention_logging')
                : t('analysis.stitch_injury_prevention_soreness_modal_confirm')}
            </button>
          </div>
        </div>
      </Modal>

      <Modal
        isOpen={importModalOpen}
        onClose={closeImportModal}
        title={t('profile.import_modal_title')}
        icon={<AppIcon name="upload_file" className="profile-import-modal-icon" />}
        shellClassName="profile-import-modal-shell"
        cardClassName="profile-import-modal-card"
      >
        <form className="profile-import-modal-form" onSubmit={handleImport}>
          <header className="import-upload-heading">
            <span>{t('profile.import_upload_kicker')}</span>
            <h3>{t('profile.import_upload_title')}</h3>
            <p className="modal-help">{t('profile.import_hint')}</p>
          </header>
          <div className="import-source-grid">
            <section className={`import-source-card${fitExportFiles?.length ? ' is-selected' : ''}`}>
              <div className="import-source-header">
                <span className="import-source-index" aria-hidden="true">01</span>
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.fit_export_source_title')}</span>
                  <span className="import-source-hint">{t('profile.fit_export_source_hint')}</span>
                </div>
                <span className="import-source-tag">FIT/GPX</span>
              </div>
              <label className="modal-label" htmlFor="analysis-fit-export-files">{t('profile.fit_export_file_label')}</label>
              <input
                id="analysis-fit-export-files"
                type="file"
                accept=".gpx,.tcx,.fit,.zip"
                multiple
                aria-describedby="analysis-fit-export-selection"
                onChange={(event) => {
                  setFitExportFiles(event.target.files);
                  setImportStatus('idle');
                }}
              />
              <p id="analysis-fit-export-selection" className="selected-file-name">
                {fitExportFiles?.length
                  ? t('profile.selected_files_count', { count: fitExportFiles.length })
                  : t('profile.no_file_selected')}
              </p>
            </section>
            <section className={`import-source-card${corosFiles?.length ? ' is-selected' : ''}`}>
              <div className="import-source-header">
                <span className="import-source-index" aria-hidden="true">02</span>
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label" htmlFor="analysis-coros-files">{t('profile.coros_file_label')}</label>
              <input
                id="analysis-coros-files"
                type="file"
                accept=".gpx,.tcx,.fit,.zip"
                multiple
                aria-describedby="analysis-coros-selection"
                onChange={(event) => {
                  setCorosFiles(event.target.files);
                  setImportStatus('idle');
                }}
              />
              <p id="analysis-coros-selection" className="selected-file-name">
                {corosFiles?.length
                  ? t('profile.selected_files_count', { count: corosFiles.length })
                  : t('profile.no_file_selected')}
              </p>
            </section>
            <section className={`import-source-card${huaweiFiles?.length ? ' is-selected' : ''}`}>
              <div className="import-source-header">
                <span className="import-source-index" aria-hidden="true">03</span>
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label" htmlFor="analysis-huawei-files">{t('profile.huawei_file_label')}</label>
              <input
                id="analysis-huawei-files"
                type="file"
                accept=".gpx,.tcx,.fit,.zip"
                multiple
                aria-describedby="analysis-huawei-selection"
                onChange={(event) => {
                  setHuaweiFiles(event.target.files);
                  setImportStatus('idle');
                }}
              />
              <p id="analysis-huawei-selection" className="selected-file-name">
                {huaweiFiles?.length
                  ? t('profile.selected_files_count', { count: huaweiFiles.length })
                  : t('profile.no_file_selected')}
              </p>
            </section>
          </div>
          <div className="import-summary-line">
            <strong>{t('profile.import_selected_total', { count: selectedFileCount })}</strong>
            <span>{t('profile.import_batch_hint')}</span>
          </div>
          {importStatus === 'error' ? (
            <p className="modal-status is-error" role="alert" aria-live="polite">
              {t('profile.import_batch_failed')}
            </p>
          ) : null}
          <div className="modal-actions">
            <button
              type="button"
              className="btn-secondary modal-button"
              disabled={importStatus === 'uploading'}
              onClick={closeImportModal}
            >
              {t('profile.cancel')}
            </button>
            <button
              type="submit"
              className="btn-primary modal-button"
              disabled={selectedFileCount === 0 || importStatus === 'uploading'}
            >
              {importStatus === 'uploading'
                ? t('profile.import_uploading')
                : t('profile.upload_file_count', { count: selectedFileCount })}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
