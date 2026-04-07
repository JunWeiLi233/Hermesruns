import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson } from '../api';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';
import InfoDisclosure from '../components/ui/InfoDisclosure';
import { getTodayRunRecommendation } from '../utils/todayRun';
import { formatDistance } from '../utils/format';

export default function TodayRun() {
  const { isAuthenticated } = useAuth();
  const { t, lang } = useI18n();
  const { unit } = useUnit();
  const navigate = useNavigate();
  const [runs, setRuns] = useState([]);
  const [loadState, setLoadState] = useState('loading');
  const [coachPayload, setCoachPayload] = useState(null);
  const [weatherContext, setWeatherContext] = useState(null);
  const [heatDismissed, setHeatDismissed] = useState(() => {
    const today = new Date().toISOString().slice(0, 10);
    return window.localStorage.getItem(`hermes_heat_strip_dismissed_${today}`) === '1';
  });

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    loadActivities();
  }, [isAuthenticated, navigate]);

  async function loadActivities() {
    try {
      const [data, coach, weather] = await Promise.all([
        apiJson('/api/activities'),
        apiJson('/api/coach/today').catch(() => null),
        apiJson('/api/v1/weather/context').catch(() => null),
      ]);
      const list = Array.isArray(data) ? data : [];
      list.sort((a, b) => new Date(b.startTime || b.startDate || 0) - new Date(a.startTime || a.startDate || 0));
      setRuns(list);
      setCoachPayload(coach && typeof coach === 'object' ? coach : null);
      setWeatherContext(weather && typeof weather === 'object' ? weather : null);
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }

  const hasHeatPenalty = weatherContext?.available && (weatherContext?.pacePenaltySecPerKm ?? 0) > 0;
  const showWeatherStrip = weatherContext?.available && !heatDismissed;

  const {
    recommendation,
    tone,
    plan,
    reasons,
    metrics,
  } = useMemo(() => getTodayRunRecommendation({ runs, t, lang }), [runs, t, lang]);

  const coachPlannedDistance = coachPayload?.today?.plannedDistanceKm != null
    ? formatDistance(coachPayload.today.plannedDistanceKm, 1, lang, unit)
    : '--';

  return (
    <AuthenticatedPageChrome bodyClassName="today-run-page">
      <main className="dashboard-container today-run-container">
        <section className="card today-run-hero">
          <span className="history-eyebrow">{t('today_run.recommendation_title')}</span>
          <div className="today-run-hero-top">
            <div className="inline-info-heading">
              <h1 className="history-title">{t('today_run.heading')}</h1>
              <InfoDisclosure className="history-copy-toggle today-run-overview-disclosure">
                <p>{t('today_run.copy')}</p>
              </InfoDisclosure>
            </div>
            <span className={`analysis-recommend-pill tone-${tone.key}`}>{recommendation.type}</span>
          </div>

          {coachPayload?.today && (
            <div className="today-run-coach-banner">
              <div className="today-run-coach-head inline-info-heading">
                <span className="history-eyebrow">{t('today_run.coach_title')}</span>
                <InfoDisclosure className="history-copy-toggle coach-subcopy">
                  <p>{t('today_run.coach_subtitle')}</p>
                </InfoDisclosure>
              </div>
              <div className="today-run-summary-grid coach-grid">
                <article className="today-run-summary-card">
                  <span className="stat-label">{t('today_run.coach_session')}</span>
                  <strong>{coachPayload.today.workoutType}</strong>
                  {coachPayload.today.readinessAdjusted && (
                    <span className="coach-readiness-pill">{t('today_run.coach_readiness')}</span>
                  )}
                </article>
                <article className="today-run-summary-card">
                  <span className="stat-label">{t('today_run.coach_km')}</span>
                  <strong>{coachPlannedDistance}</strong>
                </article>
                <article className="today-run-summary-card">
                  <span className="stat-label">{t('today_run.coach_strides_label')}</span>
                  <strong>
                    {coachPayload.today.stridesSuggested
                      ? t('today_run.coach_strides_yes')
                      : t('today_run.coach_strides_no')}
                  </strong>
                </article>
              </div>
              {coachPayload.state && (
                <div className="coach-metrics-row">
                  <span>
                    {t('today_run.coach_polarization')}
                    {': '}
                    <strong>
                      {coachPayload.state.highIntensityRatioLast7d != null
                        ? `${(coachPayload.state.highIntensityRatioLast7d * 100).toFixed(0)}%`
                        : '--'}
                    </strong>
                  </span>
                  <span>
                    {t('today_run.coach_grey_zone')}
                    {': '}
                    <strong>{coachPayload.state.minutesGreyZ3Last7d ?? '--'}</strong>
                  </span>
                </div>
              )}
              {coachPayload.today.notes && (
                <p className="coach-notes">{coachPayload.today.notes}</p>
              )}
              <InfoDisclosure className="history-copy-toggle coach-hint">
                <p>{t('today_run.coach_recovery_hint')}</p>
              </InfoDisclosure>
            </div>
          )}

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

          {showWeatherStrip && (
            <div className={`today-run-weather-strip${hasHeatPenalty ? ' today-run-weather-strip--penalty' : ' today-run-weather-strip--clear'}`}>
              <span className="today-run-weather-strip__icon" aria-hidden="true">
                {hasHeatPenalty ? '🌡' : '✓'}
              </span>
              <div className="today-run-weather-strip__body">
                <span className="today-run-weather-strip__label">
                  {t('today_run.acclimatization_title')}
                </span>
                <strong className="today-run-weather-strip__value">
                  {hasHeatPenalty
                    ? t('today_run.acclimatization_penalty', { n: weatherContext.pacePenaltySecPerKm })
                    : t('today_run.acclimatization_clear')}
                </strong>
                {hasHeatPenalty && (
                  <span className="today-run-weather-strip__detail">
                    {t('today_run.acclimatization_reason', { n: weatherContext.pacePenaltySecPerKm })}
                  </span>
                )}
              </div>
              <button
                type="button"
                className="today-run-weather-strip__dismiss"
                aria-label={t('profile.close')}
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  window.localStorage.setItem(`hermes_heat_strip_dismissed_${today}`, '1');
                  setHeatDismissed(true);
                }}
              >
                ×
              </button>
            </div>
          )}
        </section>

        <div className="today-run-grid">
          <section className="card today-run-plan-card">
            <div className="history-list-header">
              <h2>{t('today_run.plan_title')}</h2>
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p>{t('today_run.recommendation_copy')}</p>
              </InfoDisclosure>
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
              <InfoDisclosure className="history-copy-toggle history-copy-toggle--inline">
                <p>
                  {(weatherContext?.pacePenaltySecPerKm ?? 0) > 0
                    ? t('today_run.acclimatization_reason', { n: weatherContext.pacePenaltySecPerKm })
                    : recommendation.purpose}
                </p>
              </InfoDisclosure>
            </div>

            <div className="today-run-metric-strip">
              <article className="today-run-metric-card">
                <span className="stat-label">{t('today_run.metric_vo2max')}</span>
                <strong>{metrics.bestVdot > 0 ? metrics.bestVdot.toFixed(1) : '--'}</strong>
              </article>
              <article className="today-run-metric-card">
                <span className="stat-label">{t('today_run.metric_acwr')}</span>
                <strong>{metrics.acwr !== null ? metrics.acwr.toFixed(2) : '--'}</strong>
              </article>
              <article className="today-run-metric-card">
                <span className="stat-label">{t('analysis.recovery')}</span>
                <strong>
                  {metrics.recoveryHours > 0
                    ? t('today_run.metric_recovery_hours', { hours: metrics.recoveryHours })
                    : t('analysis.fully_recovered')}
                </strong>
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

    </AuthenticatedPageChrome>
  );
}
