import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';
import TopNav from '../components/TopNav';
import LanguageSwitcher from '../components/LanguageSwitcher';
import { getTodayRunRecommendation } from '../utils/todayRun';

export default function TodayRun() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadActivities();
  }, [isAuthenticated, navigate]);

  async function loadActivities() {
    try {
      const data = await apiJson('/api/activities');
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setRuns(list);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }

  const {
    recommendation,
    tone,
    plan,
    reasons,
    metrics,
  } = useMemo(() => getTodayRunRecommendation({ runs, t, lang }), [runs, t, lang]);

  return (
    <div className="dashboard-body today-run-page">
      <LanguageSwitcher />

      <TopNav backLink={{ to: '/profile', label: 'HERMES' }} />

      <main className="dashboard-container today-run-container">
        <section className="card today-run-hero">
          <span className="history-eyebrow">{t('today_run.recommendation_title')}</span>
          <div className="today-run-hero-top">
            <div>
              <h1 className="history-title">{t('today_run.heading')}</h1>
              <p className="history-copy">{t('today_run.copy')}</p>
            </div>
            <span className={`analysis-recommend-pill tone-${tone.key}`}>{recommendation.type}</span>
          </div>

          <div className="today-run-summary-grid">
            <article className={`today-run-summary-card tone-${tone.key}`}>
              <span className="stat-label">{t('profile.today_run_focus')}</span>
              <strong>{recommendation.title}</strong>
            </article>
            <article className="today-run-summary-card">
              <span className="stat-label">{t('profile.today_run_distance')}</span>
              <strong>{recommendation.distance}</strong>
            </article>
            <article className="today-run-summary-card">
              <span className="stat-label">{t('profile.today_run_pace')}</span>
              <strong>{recommendation.pace}</strong>
            </article>
          </div>
        </section>

        <div className="today-run-grid">
          <section className="card today-run-plan-card">
            <div className="history-list-header">
              <h2>{t('today_run.plan_title')}</h2>
              <p>{t('today_run.recommendation_copy')}</p>
            </div>

            {loadState === 'loading' && <div className="history-status">{t('runs.loading')}</div>}
            {loadState === 'error' && <div className="history-status">{t('runs.load_error')}</div>}
            {loadState === 'ready' && (
              <div className="today-run-step-list">
                {plan.map((step, index) => (
                  <article key={`${step.label}-${index}`} className="today-run-step-card">
                    <span className="today-run-step-badge">{step.label}</span>
                    <p>{step.value}</p>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className="card today-run-reasons-card">
            <div className="history-list-header">
              <h2>{t('today_run.reasons_title')}</h2>
              <p>{recommendation.purpose}</p>
            </div>

            <div className="today-run-metric-strip">
              <article className="today-run-metric-card">
                <span className="stat-label">VDOT</span>
                <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '--'}</strong>
              </article>
              <article className="today-run-metric-card">
                <span className="stat-label">ACWR</span>
                <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '--'}</strong>
              </article>
              <article className="today-run-metric-card">
                <span className="stat-label">{t('analysis.recovery')}</span>
                <strong>{metrics.recoveryHours > 0 ? `${metrics.recoveryHours}h` : t('analysis.fully_recovered')}</strong>
              </article>
            </div>

            <div className="today-run-reason-list">
              {reasons.map((reason, index) => (
                <article key={`${reason}-${index}`} className="today-run-reason-card">
                  <span className="today-run-reason-index">{index + 1}</span>
                  <p>{reason}</p>
                </article>
              ))}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
