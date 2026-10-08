import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { apiFetch, apiJson } from '../../api';
import { cachedApiJson, invalidateResourceCache } from '../../api/resourceCache';
import Modal from '../../components/Modal';
import ImportActivityModal from '../../components/ImportActivityModal';
import AppIcon from '../../components/AppIcon';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import FooterNavLinks from '../../components/FooterNavLinks';
import HermesLogo from '../../components/HermesLogo';
import RunnerShellTopNav from '../../components/RunnerShellTopNav';
import TopbarNotifications from '../../components/TopbarNotifications';
import { resolvePersonalizedCoachRecommendation } from '../../utils/personalizedCoachPlan';
import { getRunnerShellNavItems } from '../../utils/runnerShellNav';
import { preloadRoute } from '../../utils/routePreload';
import { buildOrderedRacePredictions, computeVdotTrend, estimateCurrentVdot } from '../../utils/vdot';
import { buildAnalysisSnapshot, buildVo2Bars, normalizeAnalysisList } from '../../utils/analysisInsights';
import { formatDuration } from '../../utils/format';
import PageSkeleton from '../../components/PageSkeleton';
import '../../styles/analysis-v2.css';

const cx = (...parts) => parts.filter(Boolean).join(' ');
const ANALYSIS_DAY_MS = 24 * 60 * 60 * 1000;
const TRAINING_ZONE_CODES = { repetition: 'R', interval: 'I', threshold: 'T', marathon: 'M', easy: 'E' };
const COACH_QUOTE_KEYS = {
  REST: 'recovery', RECOVERY: 'recovery', CROSS_TRAIN: 'recovery',
  TEMPO: 'quality', THRESHOLD: 'quality', INTERVAL: 'quality', INTERVALS: 'quality',
  LONG_RUN: 'long',
};

function orderedZonePace(label) {
  return String(label).split(' - ').sort((a, b) => {
    const seconds = (pace) => pace.split(':').reduce((total, value) => total * 60 + Number(value), 0);
    return seconds(a) - seconds(b);
  }).join('–');
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
  const { isAuthenticated } = useAuth();
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
  const coachRecommendation = useMemo(() => {
    const personalized = resolvePersonalizedCoachRecommendation({ coachPayload: coachToday, t, lang, unit });
    return personalized?.recommendation || null;
  }, [coachToday, t, lang, unit]);
  const coachQuote = coachRecommendation
    ? t(`analysis.v2_coach_quote_${COACH_QUOTE_KEYS[coachRecommendation.workoutType] || 'base'}`)
    : t('analysis.stitch_coach_quote');
  const vdotTrend = useMemo(() => computeVdotTrend(runs), [runs]);
  const fitnessHeadline = vdotTrend.hasData
    ? vdotTrend.direction === 'maintaining' ? 'stable' : vdotTrend.direction
    : 'empty';
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

    // Critical path only: profile + analysis activities power first paint.
    // Coach is wake-amplifying and paints into non-blocking cards — idle it.
    loadProfile();
    loadRuns();

    const scheduleIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 200));
    scheduleIdle(() => {
      if (!isCurrentLoad()) return;
      void loadCoachToday();
    });
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
  const vo2Bars = useMemo(() => buildVo2Bars(snapshot.entries, lang, 12), [snapshot.entries, lang]);
  const trainingLoad = snapshot.trainingLoad;
  const loadZone = snapshot.loadZone;
  const analysisLoadTheme = loadZone.tone === 'danger' ? 'red' : loadZone.tone === 'warn' ? 'yellow' : 'green';
  const polarized = snapshot.polarized;
  const serverInjuryLevel = String(injuryStatus?.risk || '').toLowerCase();
  const injury = ['low', 'moderate', 'high'].includes(serverInjuryLevel)
    ? { ...snapshot.injury, level: serverInjuryLevel }
    : snapshot.injury;
  const injuryRecommendation = ['ready', 'caution', 'rest'].includes(injuryStatus?.recommendation)
    ? injuryStatus.recommendation
    : null;
  const predictionRows = normalizeAnalysisList(snapshot.predictionRows);
  const priorPredictionRows = useMemo(() => {
    const cutoff = Date.now() - 30 * ANALYSIS_DAY_MS;
    const priorRuns = runs.filter((run) => new Date(run.startTime || run.startDate || 0).getTime() <= cutoff);
    const priorVdot = estimateCurrentVdot(priorRuns, cutoff).representativeVdot;
    return buildOrderedRacePredictions(priorVdot, priorRuns, { now: cutoff });
  }, [runs]);
  const trainingZones = [...normalizeAnalysisList(snapshot.trainingZones)].reverse();
  const hasRuns = runs.length > 0;
  const trainingZoneBasisLabel = buildTrainingZoneBasisLabel(snapshot, t);
  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    const scheduleIdle = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 200));
    const cancelIdle = window.cancelIdleCallback || window.clearTimeout;

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

    // Defer injury-risk until after first paint / idle so wake first-paint
    // only contends with profile/me + activities/analysis.
    const idleHandle = scheduleIdle(() => {
      if (!cancelled) void fetchInjuryStatus();
    });
    return () => {
      cancelled = true;
      cancelIdle(idleHandle);
    };
  }, [isAuthenticated]);

  const latestSorenessLevel = String(
    sorenessLevelOverride ?? injuryStatus?.recentLogs?.[0]?.level ?? injuryStatus?.sorenessLevel ?? ''
  ).toLowerCase();
  const localizedCoachAdvice = injuryStatus?.risk === 'LOW'
    ? t('analysis.stitch_injury_prevention_coach_advice_low')
    : injuryStatus?.coachAdvice;
  const hoveredVo2Bar = vo2Bars.find((bar) => bar.key === hoveredVo2BarKey) || null;

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'analysis',
  }), [lang, t]);

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
            <button key={item.key} type="button" className={cx('runner-shell-side-link', item.active && 'is-active')} aria-label={item.label} aria-current={item.active ? 'page' : undefined} onClick={() => navigate(item.route)} onPointerEnter={() => preloadRoute(item.route)} onFocus={() => preloadRoute(item.route)}>
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
              <TopbarUserMenu initials={initials} label={t('components.account_menu.title')} showProfile onOpenProfile={() => { setDisplayNameInput(profile?.displayName || ''); setNameModalOpen(true); }} />
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas analysis-v2-content">
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
              <section className="analysis-v2-intro">
                <h1>{t(fitnessHeadline === 'improving' && loadZone.key === 'optimal' ? 'analysis.v2_headline_improving_balanced' : `analysis.v2_headline_${fitnessHeadline}`)}</h1>
                <p>
                  {[
                    vdotTrend.hasData ? t('analysis.v2_status_vo2_period', { delta: `${vdotTrend.delta > 0 ? '+' : ''}${vdotTrend.delta.toFixed(1)}` }) : null,
                    trainingLoad?.lastAcwr != null ? `ACWR ${trainingLoad.lastAcwr.toFixed(2)}` : null,
                    t(`analysis.v2_status_injury_${injury.level || 'low'}`),
                  ].filter(Boolean).join(' · ')}
                </p>
              </section>

              <section className="analysis-v2-hero">
                <article className="analysis-overview-card analysis-overview-card--vo2 analysis-v2-vo2">
                  <div className="analysis-v2-vo2-head">
                    <div className="analysis-v2-vo2-title">
                      <h2 className="analysis-overview-vdot-title">{t('analysis.stitch_vo2_title')}</h2>
                      <div className="analysis-v2-vo2-value">
                        <strong>{bestVdot ? bestVdot.toFixed(1) : '--'}</strong>
                        <span>{t('analysis.stitch_vo2_unit')}</span>
                        {vdotTrend.hasData ? (
                          <span className={cx('analysis-v2-delta', vdotTrend.direction === 'improving' && 'is-positive', vdotTrend.direction === 'declining' && 'is-negative')}>
                            <AppIcon name={vdotTrend.direction === 'improving' ? 'trending_up' : vdotTrend.direction === 'declining' ? 'trending_down' : 'trending_flat'} />
                            {t('analysis.v2_delta_period', { delta: `${vdotTrend.delta > 0 ? '+' : ''}${vdotTrend.delta.toFixed(1)}` })}
                          </span>
                        ) : null}
                      </div>
                      <p className="analysis-v2-vo2-copy sr-only">
                        {vdotTrend.hasData ? t(`analysis.vdot_trend_insight_copy_${vdotTrend.direction}`) : t('analysis.vdot_trend_empty_copy')}
                      </p>
                    </div>
                    <div className="analysis-v2-current-month">
                      <span>{t('analysis.v2_this_month')}</span>
                      <strong>{snapshot.currentMonthVdot != null ? snapshot.currentMonthVdot.toFixed(1) : '--'}</strong>
                    </div>
                  </div>
                  <div className="analysis-overview-vo2-bars" ref={vo2BarsContainerRef}>
                    {hoveredVo2Bar ? (
                      <div
                        className="analysis-overview-vo2-tooltip"
                        aria-hidden="true"
                        style={{
                          left: `clamp(90px, ${vo2Bars.findIndex((bar) => bar.key === hoveredVo2BarKey) * (100 / vo2Bars.length) + (100 / vo2Bars.length / 2)}%, calc(100% - 90px))`,
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
                            className={cx('analysis-overview-vo2-bar', bar.value == null && 'is-empty', bar.current && 'is-current', hoveredVo2BarKey === bar.key && 'is-hovered')}
                            style={{ height: `${bar.height}%` }}
                          >
                            {null}
                          </div>
                        </div>
                        <span className={cx('analysis-overview-vo2-label', bar.current && 'is-current')}>{bar.label.toLocaleLowerCase(lang)}</span>
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
                        <span>{t('analysis.v2_weather_uplift')}</span>
                      </div>
                    )}
                  </div>
                </article>

                <section className="analysis-v2-predictions" aria-labelledby="analysis-v2-predictions-title">
                  <div className="analysis-v2-card-head">
                    <h2 id="analysis-v2-predictions-title">{t('analysis.v2_predictions_title')}</h2>
                    <span>{t('analysis.v2_predictions_basis')}</span>
                  </div>
                  <ul className="analysis-v2-prediction-list">
                    {predictionRows.map((row) => {
                      const priorRow = priorPredictionRows.find((candidate) => candidate.key === row.key);
                      const deltaSeconds = priorRow?.timeMin != null && row.timeMin != null ? Math.round((row.timeMin - priorRow.timeMin) * 60) : null;
                      return (
                      <li key={row.key}>
                        <Link className="analysis-v2-prediction-row" to={`/prediction/${row.key}`}>
                          <span className="analysis-v2-prediction-copy">
                            <strong>{row.label}</strong>
                            <span>{`${row.paceLabel} /${unit === 'mile' ? 'mi' : 'km'}`}</span>
                          </span>
                          <span className="analysis-v2-prediction-estimate">
                            <strong className="analysis-v2-prediction-time">{row.timeLabel}</strong>
                            {deltaSeconds != null ? (
                              <span className={cx('analysis-v2-prediction-delta', deltaSeconds < 0 && 'is-faster', deltaSeconds > 0 && 'is-slower')} title={t('analysis.v2_prediction_change_basis')}>
                                {deltaSeconds < 0 ? '−' : deltaSeconds > 0 ? '+' : ''}{formatDuration(Math.abs(deltaSeconds))}
                              </span>
                            ) : null}
                          </span>
                          <AppIcon name="chevron_right" aria-hidden="true" />
                        </Link>
                      </li>
                      );
                    })}
                  </ul>
                </section>
              </section>

              <section className="analysis-v2-checks" aria-label={t('profile.dashboard_nav_analysis')}>
                <button type="button" className="analysis-v2-check" onClick={() => navigate('/analysis/load-balance')}>
                  <span className="analysis-v2-check-head"><span>{t('analysis.stitch_acwr_title')}</span><AppIcon name="chevron_right" /></span>
                  <strong>{trainingLoad?.lastAcwr != null ? trainingLoad.lastAcwr.toFixed(2) : '--'}</strong>
                  <span className="analysis-v2-acwr-scale" aria-hidden="true">
                    {trainingLoad?.lastAcwr != null ? (
                      <i style={{ left: `${Math.max(0, Math.min(100, (trainingLoad.lastAcwr - 0.5) / 1.1 * 100))}%` }} />
                    ) : null}
                  </span>
                  <span className="analysis-v2-scale-labels"><span>0.8</span><span>{t('analysis.v2_productive')}</span><span>1.3</span></span>
                  <p>{t('analysis.stitch_acwr_copy')}</p>
                </button>

                <button type="button" className="analysis-v2-check analysis-v2-check--intensity" onClick={() => navigate('/analysis/intensity')}>
                  <span className="analysis-v2-check-head"><span>{t('analysis.stitch_intensity_title')}</span><AppIcon name="chevron_right" /></span>
                  <strong>{polarized ? `${polarized.easySharePct} / ${polarized.moderateSharePct} / ${polarized.hardSharePct}` : '--'}</strong>
                  <span className="analysis-v2-mix" aria-hidden="true">
                    <span className="is-easy" style={{ width: `${polarized?.easySharePct || 0}%` }} />
                    <span className="is-moderate" style={{ width: `${polarized?.moderateSharePct || 0}%` }} />
                    <span className="is-hard" style={{ width: `${polarized?.hardSharePct || 0}%` }} />
                  </span>
                  <span className="analysis-v2-scale-labels">
                    <span>{t('analysis.v2_intensity_easy')}</span>
                    <span>{t('analysis.v2_intensity_moderate')}</span>
                    <span>{t('analysis.v2_intensity_hard')}</span>
                  </span>
                  {polarized ? <p>{t(polarized.easySharePct >= 75 && polarized.hardSharePct <= 20 && injury.level === 'low' && loadZone.key === 'optimal' ? 'analysis.v2_intensity_balanced' : 'analysis.v2_intensity_build')}</p> : null}
                </button>

                <div className="analysis-v2-check analysis-v2-check--injury">
                  <button type="button" className="analysis-v2-check-head is-link" onClick={() => navigate('/analysis/injury-risk')}>
                    <span>{t('analysis.stitch_injury_title')}</span><AppIcon name="chevron_right" />
                  </button>
                  <div className="analysis-v2-injury-value">
                    <strong>{t(`analysis.stitch_injury_${injury.level || 'low'}`)}</strong>
                    {injuryStatus?.combinedRiskScore != null ? <span>{Math.round(injuryStatus.combinedRiskScore)} / 100</span> : null}
                  </div>
                  <span className="analysis-v2-risk" aria-hidden="true">
                    <span className={injury.level === 'low' ? 'is-on is-low' : ''} />
                    <span className={injury.level === 'moderate' ? 'is-on is-moderate' : ''} />
                    <span className={injury.level === 'high' ? 'is-on is-high' : ''} />
                  </span>
                  {injuryRecommendation ? <p><strong>{t(`analysis.stitch_injury_prevention_rec_${injuryRecommendation}`)}</strong></p> : null}
                  <span className="analysis-v2-soreness-label">{t('analysis.v2_soreness_title')}</span>
                  <div className="analysis-v2-soreness" role="group" aria-label={t('analysis.v2_soreness_title')}>
                    {['low', 'medium', 'high'].map((level) => (
                      <button
                        key={level}
                        type="button"
                        className={cx('analysis-v2-soreness-btn', `is-${level}`, latestSorenessLevel === level && 'is-active')}
                        onClick={() => setSorenessModalLevel(level)}
                        disabled={sorenessSubmitting || injuryStatusLoading}
                        aria-pressed={latestSorenessLevel === level}
                      >
                        {t(`analysis.v2_soreness_${level}`)}
                      </button>
                    ))}
                  </div>
                  {sorenessError ? <p className="analysis-v2-check-error">{sorenessError}</p> : null}
                  {injuryStatusError && !injuryStatusLoading ? <p className="analysis-v2-check-error">{t('analysis.stitch_injury_prevention_error')}</p> : null}
                  {injuryStatus?.coachAdvice ? <p>{localizedCoachAdvice}</p> : null}
                </div>

                <button type="button" className="analysis-v2-check analysis-v2-check--coach" onClick={() => navigate('/analysis/coach-insight')}>
                  <span className="analysis-v2-check-head"><span>{t('analysis.stitch_coach_title')}</span><AppIcon name="chevron_right" /></span>
                  <strong className="analysis-v2-coach-quote">“{coachQuote}”</strong>
                  {coachRecommendation?.purpose ? <span className="sr-only">{coachRecommendation.purpose}</span> : null}
                  {coachRecommendation ? <span className="analysis-v2-coach-session">{t('analysis.v2_coach_today', { session: `${coachRecommendation.title} · ${coachRecommendation.distance}` })}</span> : null}
                </button>
              </section>

              <section className="analysis-v2-zones" aria-labelledby="analysis-v2-zones-title">
                <div className="analysis-v2-card-head">
                  <h2 id="analysis-v2-zones-title">{t('analysis.v2_zones_title')}</h2>
                  <span>{trainingZoneBasisLabel}</span>
                </div>
                <div className="analysis-v2-zone-ruler" aria-hidden="true">
                  {trainingZones.map((zone) => (
                    <span key={zone.key} className={`is-${zone.key}`}>{TRAINING_ZONE_CODES[zone.key]}</span>
                  ))}
                </div>
                {trainingZones.length ? (
                  <div className="analysis-v2-pace-direction" aria-hidden="true">
                    <span>{orderedZonePace(trainingZones[0].paceLabel).split('–')[0]} /{unit === 'mile' ? 'mi' : 'km'} · {t('analysis.v2_faster')}</span>
                    <span>{t('analysis.v2_slower')} · {orderedZonePace(trainingZones.at(-1).paceLabel).split('–').at(-1)} /{unit === 'mile' ? 'mi' : 'km'}</span>
                  </div>
                ) : null}
                <ul className="analysis-v2-zone-list">
                  {trainingZones.map((zone) => (
                    <li key={zone.key} className={`is-${zone.key}`}>
                      <strong>{t(`analysis.v2_zone_${zone.key}`)}</strong>
                      <span className="analysis-v2-zone-pace">{orderedZonePace(zone.paceLabel)} <small>{t(unit === 'mile' ? 'analysis.unit_pace_mile' : 'analysis.unit_pace_km')}</small></span>
                      <span className="analysis-v2-zone-purpose">{t(`analysis.v2_zone_${zone.key}_purpose`)}</span>
                    </li>
                  ))}
                </ul>
              </section>

              <footer className="runner-shell-footer">
                <div className="analysis-v2-prediction-actions">
                  <button type="button" className="runner-shell-inline-btn" onClick={() => setImportModalOpen(true)}>{t('analysis.stitch_import_data')}</button>
                  <button type="button" className="runner-shell-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
                </div>
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
            {t(`analysis.v2_soreness_${sorenessModalLevel}`)}
          </div>
        ) : null}
        shellClassName="analysis-soreness-modal-shell"
        cardClassName="analysis-soreness-modal-card"
      >
        <div className="analysis-soreness-modal-content">
          <p className="analysis-soreness-modal-copy">
            {sorenessModalLevel
              ? t('analysis.stitch_injury_prevention_soreness_modal_copy', {
                level: t(`analysis.v2_soreness_${sorenessModalLevel}`),
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

      <ImportActivityModal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        onImported={loadAnalysisData}
        t={t}
      />
    </div>
  );
}
