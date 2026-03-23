import { useState, useEffect, useMemo, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import { formatDuration, formatDistance, formatPace, formatDate } from '../utils/format';
import LanguageSwitcher from '../components/LanguageSwitcher';

const BATCH_SIZE = 10;
const MONTH_NAMES_ZH = ['1月','2月','3月','4月','5月','6月','7月','8月','9月','10月','11月','12月'];
const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Runs() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();

  const [allRuns, setAllRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [activeMode, setActiveMode] = useState('all');
  const [selectedYear, setSelectedYear] = useState(null);
  const [selectedMonth, setSelectedMonth] = useState(null);
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);

  useEffect(() => {
    if (!isAuthenticated) { navigate('/login'); return; }
    loadRuns();
  }, [isAuthenticated]);

  async function loadRuns() {
    try {
      const data = await apiJson('/api/activities');
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setAllRuns(list);
      setLoadState('ready');
    } catch (err) {
      if (err.message !== 'Unauthorized') setLoadState('error');
    }
  }

  // Filter logic
  const filteredRuns = useMemo(() => {
    const now = new Date();
    if (activeMode === 'all') return allRuns;
    if (activeMode === 'year') {
      if (selectedYear == null) return allRuns;
      return allRuns.filter(r => new Date(r.startTime || r.startDate || 0).getFullYear() === selectedYear);
    }
    if (activeMode === 'month') {
      const y = selectedYear || now.getFullYear();
      if (selectedMonth == null) return allRuns.filter(r => new Date(r.startTime || r.startDate || 0).getFullYear() === y);
      return allRuns.filter(r => {
        const d = new Date(r.startTime || r.startDate || 0);
        return d.getFullYear() === y && d.getMonth() === selectedMonth;
      });
    }
    if (activeMode === 'day') {
      return allRuns.filter(r => {
        const d = new Date(r.startTime || r.startDate || 0);
        return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate();
      });
    }
    return allRuns;
  }, [allRuns, activeMode, selectedYear, selectedMonth]);

  // Reset visible count on filter change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [activeMode, selectedYear, selectedMonth]);

  // Distinct years
  const distinctYears = useMemo(() => {
    const ys = new Set();
    allRuns.forEach(r => {
      const d = new Date(r.startTime || r.startDate || 0);
      if (!isNaN(d.getTime())) ys.add(d.getFullYear());
    });
    return [...ys].sort((a, b) => b - a);
  }, [allRuns]);

  // Months with data
  const monthsWithData = useMemo(() => {
    const y = selectedYear || new Date().getFullYear();
    const ms = new Set();
    allRuns.forEach(r => {
      const d = new Date(r.startTime || r.startDate || 0);
      if (!isNaN(d.getTime()) && d.getFullYear() === y) ms.add(d.getMonth());
    });
    return [...ms].sort((a, b) => a - b);
  }, [allRuns, selectedYear]);

  // Summary stats
  const { totalDist, totalSec, latestSource } = useMemo(() => {
    let dist = 0, sec = 0;
    filteredRuns.forEach(r => { dist += Number(r.distanceKm || 0); sec += Number(r.movingTimeSeconds || 0); });
    return { totalDist: dist, totalSec: sec, latestSource: filteredRuns[0]?.provider || t('runs.no_data') };
  }, [filteredRuns, t]);

  function handleFilterClick(mode) {
    setActiveMode(mode);
    setSelectedYear(null);
    setSelectedMonth(null);
  }

  function handleSubTabClick(type, value) {
    if (type === 'year') {
      setSelectedYear(value);
      if (activeMode === 'month') setSelectedMonth(null);
    } else if (type === 'month') {
      setSelectedMonth(value);
    }
  }

  function openRun(run) {
    sessionStorage.setItem('hermes_selected_run', JSON.stringify(run));
    navigate(`/run/${run.id || ''}`);
  }

  function countLabel(count) {
    if (count === 0) return t('runs.count_zero');
    return t('runs.count_label', { count });
  }

  const visibleRuns = filteredRuns.slice(0, visibleCount);
  const monthNames = lang === 'en' ? MONTH_NAMES_EN : MONTH_NAMES_ZH;

  // Auto-select first year for year/month modes
  useEffect(() => {
    if ((activeMode === 'year') && selectedYear == null && distinctYears.length) {
      setSelectedYear(distinctYears[0]);
    }
    if (activeMode === 'month' && selectedYear == null) {
      setSelectedYear(new Date().getFullYear());
    }
  }, [activeMode, distinctYears, selectedYear]);

  useEffect(() => {
    if (activeMode === 'month' && selectedMonth == null && monthsWithData.length) {
      setSelectedMonth(monthsWithData[monthsWithData.length - 1]);
    }
  }, [activeMode, monthsWithData, selectedMonth]);

  return (
    <div className="dashboard-body history-page">
      <LanguageSwitcher />
      <header className="top-nav">
        <Link to="/profile" className="logo logo-link">HERMES</Link>
        <div className="history-actions">
          <Link to="/races" className="top-nav-shortcut">{t('races.nav_label')}</Link>
          <Link to="/profile" className="history-back-link">{t('runs.back_to_profile')}</Link>
          <div className="history-count-pill">{countLabel(filteredRuns.length)}</div>
        </div>
      </header>

      <main className="dashboard-container history-container">
        {/* Hero */}
        <section className="card history-hero">
          <span className="history-eyebrow">{t('runs.eyebrow')}</span>
          <div className="history-hero-top">
            <h1 className="history-title">{t('runs.heading')}</h1>
            <div className="history-filter-tabs">
              {['all', 'year', 'month', 'day'].map(mode => (
                <button
                  key={mode}
                  type="button"
                  className={`history-filter-tab${activeMode === mode ? ' active' : ''}`}
                  onClick={() => handleFilterClick(mode)}
                >
                  {t(`runs.filter_${mode}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Sub-tabs */}
          <div className="history-filter-sub-tabs">
            {activeMode === 'year' && distinctYears.map(y => (
              <button key={y} type="button"
                className={`history-filter-sub-tab${y === selectedYear ? ' active' : ''}`}
                onClick={() => handleSubTabClick('year', y)}
              >{y}</button>
            ))}
            {activeMode === 'month' && monthsWithData.map(m => (
              <button key={m} type="button"
                className={`history-filter-sub-tab${m === selectedMonth ? ' active' : ''}`}
                onClick={() => handleSubTabClick('month', m)}
              >{monthNames[m]}</button>
            ))}
          </div>

          <p className="history-copy">{t('runs.page_copy')}</p>
        </section>

        {/* Summary Grid */}
        <section className="history-summary-grid">
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('runs.total_distance')}</span>
            <div className="history-summary-value">{formatDistance(totalDist, 1, lang)}</div>
            <div className="history-summary-note">{t('runs.total_distance_note')}</div>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('runs.average_pace')}</span>
            <div className="history-summary-value">{totalDist > 0 ? formatPace(totalDist, totalSec, lang) : (lang === 'en' ? '0:00 /km' : '0:00 /公里')}</div>
            <div className="history-summary-note">{t('runs.average_pace_note')}</div>
          </article>
          <article className="card history-summary-card">
            <span className="history-summary-label">{t('runs.latest_source')}</span>
            <div className="history-summary-value">{latestSource}</div>
            <div className="history-summary-note">{t('runs.latest_source_note')}</div>
          </article>
        </section>

        {/* Run List */}
        <section className="card history-list-card">
          <div className="history-list-header">
            <h2>{t('runs.full_history')}</h2>
            <p>{t('runs.full_history_copy')}</p>
          </div>

          <div className="history-list">
            {loadState === 'loading' && <div className="history-status">{t('runs.loading')}</div>}
            {loadState === 'error' && <div className="history-status">{t('runs.load_error')}</div>}
            {loadState === 'ready' && filteredRuns.length === 0 && <div className="history-status">{t('runs.empty')}</div>}
            {loadState === 'ready' && visibleRuns.map((run, i) => {
              const provider = run.provider || (lang === 'en' ? 'Manual' : '手动导入');
              const runName = run.name || t('runs.default_run_name');
              return (
                <article key={i} className="history-row" onClick={() => openRun(run)}>
                  <div className="history-row-main">
                    <p className="history-row-title">{runName}</p>
                    <div className="history-row-meta">
                      <span>{formatDate(run.startTime || run.startDate, lang)}</span>
                      <span className="history-provider-pill">{provider}</span>
                    </div>
                  </div>
                  <div className="history-metrics">
                    <div className="history-metric-box">
                      <span className="history-metric-label">{t('runs.metric_distance')}</span>
                      <span className="history-metric-value">{formatDistance(Number(run.distanceKm || 0), 2, lang)}</span>
                    </div>
                    <div className="history-metric-box">
                      <span className="history-metric-label">{t('runs.metric_moving_time')}</span>
                      <span className="history-metric-value">{formatDuration(run.movingTimeSeconds)}</span>
                    </div>
                    <div className="history-metric-box">
                      <span className="history-metric-label">{t('runs.metric_average_pace')}</span>
                      <span className="history-metric-value">{formatPace(Number(run.distanceKm || 0), Number(run.movingTimeSeconds || 0), lang)}</span>
                    </div>
                    <div className="history-metric-box">
                      <span className="history-metric-label">{t('runs.metric_imported_from')}</span>
                      <span className="history-metric-value">{provider}</span>
                    </div>
                  </div>
                  <div className="history-arrow">&rsaquo;</div>
                </article>
              );
            })}
          </div>

          {visibleCount < filteredRuns.length && (
            <div className="history-footer">
              <button
                type="button"
                className="btn-primary history-load-more"
                onClick={() => setVisibleCount(v => Math.min(filteredRuns.length, v + BATCH_SIZE))}
              >
                {t('runs.load_more')}
              </button>
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
