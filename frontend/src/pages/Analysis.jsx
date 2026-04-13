import { startTransition, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiFetch, apiJson } from '../api';
import Modal from '../components/Modal';
import ImportDataGuide from '../components/ImportDataGuide';
import AppIcon from '../components/AppIcon';
import HermesLogo from '../components/HermesLogo';
import { formatDuration } from '../utils/format';
import { buildAnalysisSnapshot } from '../utils/analysisInsights';

const cx = (...parts) => parts.filter(Boolean).join(' ');

function Gauge({ value, color }) {
  const clamped = Math.max(0, Math.min(1.8, Number(value || 0)));
  const progressPct = Math.max(0, Math.min((clamped / 1.8) * 100, 100));
  const path = 'M 24 126 A 86 86 0 0 1 196 126';
  return (
    <svg viewBox="0 0 220 140" className="analysis-stitch-gauge-svg" aria-hidden="true">
      <path d={path} pathLength="100" className="analysis-stitch-gauge-track" />
      <path
        d={path}
        pathLength="100"
        className="analysis-stitch-gauge-progress"
        style={{ stroke: color, strokeDasharray: `${progressPct} 100` }}
      />
    </svg>
  );
}

export default function Analysis() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [, setProfileState] = useState('loading');
  const [runsState, setRunsState] = useState('loading');
  const [nameModalOpen, setNameModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [displayNameInput, setDisplayNameInput] = useState('');
  const [fitExportFiles, setFitExportFiles] = useState(null);
  const [corosFiles, setCorosFiles] = useState(null);
  const [huaweiFiles, setHuaweiFiles] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    let cancelled = false;

    async function loadProfile() {
      setProfileState('loading');
      try {
        const profileData = await apiJson('/api/profile/me');
        if (cancelled) return;
        setProfile(profileData);
        setProfileState('ready');
      } catch {
        if (!cancelled) setProfileState('error');
      }
    }

    async function loadRuns() {
      setRunsState('loading');
      try {
        const activitiesData = await apiJson('/api/activities/analysis');
        if (cancelled) return;
        startTransition(() => {
          setRuns(Array.isArray(activitiesData) ? activitiesData : []);
        });
        setRunsState('ready');
      } catch {
        if (!cancelled) setRunsState('error');
      }
    }

    loadProfile();
    loadRuns();

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, navigate]);

  const snapshot = useMemo(() => buildAnalysisSnapshot(runs, lang, unit), [runs, lang, unit]);
  const bestVdot = snapshot.bestVdot;
  const vo2Bars = snapshot.vo2Bars;
  const trainingLoad = snapshot.trainingLoad;
  const loadZone = snapshot.loadZone;
  const polarized = snapshot.polarized;
  const injury = snapshot.injury;
  const predictionRows = snapshot.predictionRows;
  const marathonRow = snapshot.marathonRow;
  const marathonDelta = snapshot.marathonDeltaSeconds;
  const hasRuns = runs.length > 0;

  const initials = (profile?.displayName || profile?.email?.split('@')[0] || 'H').trim().slice(0, 1).toUpperCase();
  const navItems = [
    { key: 'dashboard', label: t('profile.dashboard_nav_dashboard'), route: '/profile', icon: 'dashboard' },
    { key: 'analysis', label: t('profile.dashboard_nav_analysis'), route: '/analysis', icon: 'insights', active: true },
    { key: 'activities', label: t('profile.dashboard_nav_activities'), route: '/runs', icon: 'history' },
    { key: 'heatmap', label: t('profile.dashboard_nav_heatmap'), route: '/heatmap', icon: 'map' },
    { key: 'shoes', label: t('profile.dashboard_nav_shoes'), route: '/shoes', icon: 'straighten' },
    { key: 'races', label: t('profile.dashboard_nav_races'), route: '/races', icon: 'flag' },
    { key: 'schedule', label: t('profile.dashboard_nav_schedule'), route: '/schedule', icon: 'calendar_today' },
  ];

  async function handleImport(event) {
    event.preventDefault();
    const formData = new FormData();
    if (fitExportFiles) Array.from(fitExportFiles).forEach((file) => formData.append('exports', file));
    if (corosFiles) Array.from(corosFiles).forEach((file) => formData.append('coros', file));
    if (huaweiFiles) Array.from(huaweiFiles).forEach((file) => formData.append('huawei', file));
    try {
      await apiFetch('/api/import/batch', { method: 'POST', body: formData });
      setImportModalOpen(false);
      setRunsState('loading');
      const activitiesData = await apiJson('/api/activities/analysis');
      const list = Array.isArray(activitiesData) ? activitiesData : [];
      startTransition(() => {
        setRuns(list);
      });
      setRunsState('ready');
    } catch {
      // noop
    }
  }

  async function handleSaveName(event) {
    event.preventDefault();
    try {
      await apiFetch('/api/profile/me', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ displayName: displayNameInput }) });
      setProfile((current) => ({ ...current, displayName: displayNameInput }));
      setNameModalOpen(false);
    } catch {
      // noop
    }
  }

  return (
    <div className={`analysis-stitch-page runner-dashboard-page analysis-page-shell${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="analysis-stitch-sidebar">
        <div className="analysis-stitch-brand runner-dashboard-brand">
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
        <nav className="analysis-stitch-side-nav">
          {navItems.map((item) => (
            <button key={item.key} type="button" className={cx('analysis-stitch-side-link', item.active && 'is-active')} onClick={() => navigate(item.route)}>
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="analysis-stitch-sidebar-footer">
          <button
            type="button"
            className="analysis-stitch-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="analysis-stitch-main">
        <header className="analysis-stitch-topbar runner-dashboard-shell-topbar">
          <div className="analysis-stitch-topbar-left">
            <div className="schedule-stitch-topnav">
              <span className="schedule-stitch-topnav-link is-active">{t('profile.dashboard_nav_analysis')}</span>
            </div>
          </div>
          <div className="analysis-stitch-topbar-actions">
            <div className="analysis-stitch-topbar-profile-actions">
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/runs')} aria-label={t('analysis.stitch_open_runs')}>
                <AppIcon name="notifications" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="analysis-stitch-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button
                type="button"
                className="analysis-stitch-avatar"
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

        <div className="analysis-stitch-canvas">
          {runsState === 'loading' ? (
            <section className="analysis-stitch-empty-shell">
              <div className="premium-empty-state analysis-stitch-empty-state">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_loading')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_helper')}</p>
              </div>
            </section>
          ) : runsState === 'error' ? (
            <section className="analysis-stitch-empty-shell">
              <div className="premium-empty-state analysis-stitch-empty-state">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_load_error')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_helper')}</p>
                <div className="analysis-stitch-empty-actions">
                  <button type="button" className="analysis-stitch-inline-btn analysis-stitch-empty-action is-primary" onClick={() => window.location.reload()}>
                    {t('profile.retry_strava')}
                  </button>
                </div>
              </div>
            </section>
          ) : !hasRuns ? (
            <section className="analysis-stitch-empty-shell">
              <div className="premium-empty-state analysis-stitch-empty-state">
                <div className="premium-empty-state__icon" aria-hidden="true">
                  <AppIcon name="insights" className="runner-dashboard-side-link-icon" />
                </div>
                <h2 className="premium-empty-state__heading">{t('analysis.stitch_empty_title')}</h2>
                <p className="premium-empty-state__copy">{t('analysis.stitch_empty_copy')}</p>
                <p className="premium-empty-state__helper">{t('analysis.stitch_empty_helper')}</p>
                <div className="analysis-stitch-empty-actions">
                  <button type="button" className="analysis-stitch-inline-btn analysis-stitch-empty-action is-primary" onClick={() => setImportModalOpen(true)}>
                    {t('analysis.stitch_import_data')}
                  </button>
                  <button type="button" className="analysis-stitch-inline-btn analysis-stitch-empty-action" onClick={() => navigate('/runs')}>
                    {t('analysis.stitch_open_runs')}
                  </button>
                </div>
              </div>
            </section>
          ) : (
            <>
          <section className="analysis-stitch-grid analysis-stitch-grid--hero">
            <button
              type="button"
              className="analysis-stitch-card analysis-stitch-card--vo2 analysis-stitch-card--vo2-clickable analysis-stitch-card--interactive"
              onClick={() => navigate('/analysis/vo2max')}
            >
              <div className="analysis-stitch-card-head">
                <div>
                  <span className="analysis-stitch-card-kicker">{t('analysis.stitch_vo2_kicker')}</span>
                  <h2>{t('analysis.stitch_vo2_title')}</h2>
                </div>
                <div className="analysis-stitch-hero-value">
                  <strong>{bestVdot ? bestVdot.toFixed(1) : '--'}</strong>
                  <span>{t('analysis.stitch_vo2_band')}</span>
                </div>
              </div>
              <div className="analysis-stitch-vo2-bars">
                {vo2Bars.map((bar) => (
                  <div key={bar.key} className="analysis-stitch-vo2-bar-col">
                    <div className={cx('analysis-stitch-vo2-bar', bar.current && 'is-current')} style={{ height: `${bar.height}%` }}>
                      {bar.current && bar.value != null ? <span className="analysis-stitch-vo2-tag">{bar.value.toFixed(1)}</span> : null}
                    </div>
                    <span className={cx('analysis-stitch-vo2-label', bar.current && 'is-current')}>{bar.label}</span>
                  </div>
                ))}
              </div>
              <div className="analysis-stitch-vo2-link-row">
                <span>{t('analysis.vo2_detail_cta')}</span>
                <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
              </div>
            </button>

            <div className="analysis-stitch-side-stack">
              <button
                type="button"
                className="analysis-stitch-card analysis-stitch-card--gauge analysis-stitch-card--interactive"
                onClick={() => navigate('/analysis/load-balance')}
              >
                <span className="analysis-stitch-card-kicker">{t('analysis.stitch_acwr_title')}</span>
                <Gauge value={trainingLoad?.lastAcwr || 0} color={loadZone.color} />
                <div className="analysis-stitch-gauge-value">{trainingLoad?.lastAcwr != null ? trainingLoad.lastAcwr.toFixed(2) : '--'}</div>
                <span className={cx('analysis-stitch-status-pill', `is-${loadZone.tone}`)}>{t(loadZone.key === 'optimal' ? 'analysis.stitch_optimal_zone' : `analysis.stitch_acwr_${loadZone.key}`)}</span>
                <p>{t('analysis.stitch_acwr_copy')}</p>
              </button>

              <button
                type="button"
                className="analysis-stitch-card analysis-stitch-card--coach analysis-stitch-card--interactive"
                onClick={() => navigate('/analysis/coach-insight')}
              >
                <span className="analysis-stitch-card-kicker">{t('analysis.stitch_coach_title')}</span>
                <h3>{t('analysis.stitch_coach_quote')}</h3>
              </button>
            </div>
          </section>

          <section className="analysis-stitch-grid analysis-stitch-grid--summary">
            <button
              type="button"
              className="analysis-stitch-card analysis-stitch-card--metric analysis-stitch-card--metric-accent analysis-stitch-card--interactive"
              onClick={() => navigate('/analysis/intensity')}
            >
              <span className="analysis-stitch-card-kicker">{t('analysis.stitch_intensity_title')}</span>
              <div className="analysis-stitch-ratio-row">
                <strong>{polarized ? `${polarized.easyPct}/${polarized.hardPct}` : '--/--'}</strong>
                <AppIcon name="check_circle" className="runner-dashboard-side-link-icon" />
              </div>
              <div className="analysis-stitch-ratio-bar">
                <span style={{ width: `${polarized?.easyPct || 0}%` }} />
                <span className="is-hard" style={{ width: `${polarized?.hardPct || 0}%` }} />
              </div>
              <div className="analysis-stitch-ratio-labels">
                <span>{t('analysis.stitch_low_intensity', { value: polarized?.easyPct ?? 0 })}</span>
                <span>{t('analysis.stitch_high_intensity', { value: polarized?.hardPct ?? 0 })}</span>
              </div>
            </button>

            <button
              type="button"
              className="analysis-stitch-card analysis-stitch-card--metric analysis-stitch-card--interactive"
              onClick={() => navigate('/analysis/injury-risk')}
            >
              <span className="analysis-stitch-card-kicker">{t('analysis.stitch_injury_title')}</span>
              <strong className={cx('analysis-stitch-risk-level', `is-${injury.level}`)}>{t(`analysis.stitch_injury_${injury.level}`)}</strong>
              <div className="analysis-stitch-risk-meter">
                <span className={injury.level === 'low' ? 'is-on is-green' : ''} />
                <span className={injury.level === 'moderate' ? 'is-on is-warn' : ''} />
                <span className={injury.level === 'high' ? 'is-on is-danger' : ''} />
                <span />
              </div>
              <p>{t('analysis.stitch_injury_copy')}</p>
            </button>

            <button
              type="button"
              className="analysis-stitch-card analysis-stitch-card--metric analysis-stitch-card--forecast analysis-stitch-card--interactive"
              onClick={() => navigate('/prediction/marathon')}
            >
              <span className="analysis-stitch-card-kicker">{t('analysis.stitch_forecast_title')}</span>
              <strong>{marathonRow?.timeLabel || '--'}</strong>
              <div className="analysis-stitch-forecast-footer">
                <span className={cx('analysis-stitch-forecast-delta', marathonDelta != null && marathonDelta < 0 && 'is-positive')}>
                  {marathonDelta == null ? t('analysis.stitch_no_delta') : `${marathonDelta < 0 ? '' : '+'}${formatDuration(Math.abs(marathonDelta))} ${t('analysis.stitch_vs_prev')}`}
                </span>
                <span className="analysis-stitch-arrow-link" aria-hidden="true">
                  <AppIcon name="arrow_forward" className="runner-dashboard-side-link-icon" />
                </span>
              </div>
            </button>
          </section>

          <section className="analysis-stitch-card analysis-stitch-card--table">
            <div className="analysis-stitch-table-head">
              <h2>{t('analysis.stitch_predictions_title')}</h2>
              <span className="analysis-stitch-confidence-pill">{t('analysis.stitch_confidence', { value: 94 })}</span>
            </div>
            <div className="analysis-stitch-table-wrap">
              <table className="analysis-stitch-table">
                <thead>
                  <tr>
                    <th>{t('analysis.stitch_event_distance')}</th>
                    <th>{t('analysis.stitch_estimated_time')}</th>
                    <th>{t(unit === 'mile' ? 'analysis.stitch_pace_per_mile' : 'analysis.stitch_pace_per_km')}</th>
                    <th>{t('analysis.stitch_vdot_equivalent')}</th>
                  </tr>
                </thead>
                <tbody>
                  {predictionRows.map((row) => (
                    <tr key={row.key} onClick={() => navigate(`/prediction/${row.key}`)}>
                      <td>{row.label}</td>
                      <td className="is-accent">{row.timeLabel}</td>
                      <td>{`${row.paceLabel} /${unit === 'mile' ? 'mi' : 'km'}`}</td>
                      <td>{row.vdotLabel}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="analysis-stitch-table-actions">
              <button type="button" className="analysis-stitch-inline-btn" onClick={() => setImportModalOpen(true)}>{t('analysis.stitch_import_data')}</button>
              <button type="button" className="analysis-stitch-inline-btn" onClick={() => navigate('/runs')}>{t('analysis.stitch_open_runs')}</button>
            </div>
          </section>

          <footer className="analysis-stitch-footer">
            <a href="/terms">{t('landing.stitch_footer_terms')}</a>
            <a href="/privacy">{t('landing.stitch_footer_privacy')}</a>
            <a href="#support">{t('landing.stitch_footer_support')}</a>
            <a href="#contact">{t('landing.stitch_footer_contact')}</a>
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

      <Modal isOpen={importModalOpen} onClose={() => setImportModalOpen(false)} title={t('profile.import_modal_title')}>
        <form onSubmit={handleImport}>
          <ImportDataGuide />
          <p className="modal-help">{t('profile.import_hint')}</p>
          <div className="import-source-grid">
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.fit_export_source_title')}</span>
                  <span className="import-source-hint">{t('profile.fit_export_source_hint')}</span>
                </div>
                <span className="import-source-tag">FIT/GPX</span>
              </div>
              <label className="modal-label">{t('profile.fit_export_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setFitExportFiles(event.target.files)} />
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.coros_source_title')}</span>
                  <span className="import-source-hint">{t('profile.coros_source_hint')}</span>
                </div>
                <span className="import-source-tag">COROS</span>
              </div>
              <label className="modal-label">{t('profile.coros_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setCorosFiles(event.target.files)} />
            </section>
            <section className="import-source-card">
              <div className="import-source-header">
                <div className="import-source-copy">
                  <span className="import-source-title">{t('profile.huawei_source_title')}</span>
                  <span className="import-source-hint">{t('profile.huawei_source_hint')}</span>
                </div>
                <span className="import-source-tag">HUAWEI</span>
              </div>
              <label className="modal-label">{t('profile.huawei_file_label')}</label>
              <input type="file" accept=".gpx,.tcx,.fit,.zip" multiple onChange={(event) => setHuaweiFiles(event.target.files)} />
            </section>
          </div>
          <p className="import-summary-line">{t('profile.import_batch_hint')}</p>
          <div className="modal-actions">
            <button type="button" className="btn-secondary modal-button" onClick={() => setImportModalOpen(false)}>{t('profile.cancel')}</button>
            <button type="submit" className="btn-primary modal-button">{t('profile.upload_file')}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
