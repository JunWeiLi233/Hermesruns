import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import TopNav from '../components/TopNav';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { apiJson } from '../api';

function clampSessions(sessionsPerWeek, sessions) {
  if (!Array.isArray(sessions)) return [];
  if (sessionsPerWeek <= 1) return sessions.slice(0, 1);
  return sessions.slice(0, 2);
}

export default function MuscleTraining() {
  const { isAuthenticated } = useAuth();
  const { t } = useI18n();
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const res = await apiJson('/api/training/muscle/recommendation');
        if (!cancelled) setData(res);
      } catch (e) {
        if (!cancelled) setError(e?.message || t('common.connection_failed'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [isAuthenticated, navigate, t]);

  const sessions = useMemo(() => {
    const sessionsPerWeek = Number(data?.sessionsPerWeek || 0);
    return clampSessions(sessionsPerWeek, data?.sessions || []);
  }, [data]);

  return (
    <div className="page-shell">
      <TopNav backLink={{ to: '/profile', label: 'HERMES' }} />

      <div className="page-body" style={{ maxWidth: 1000, margin: '0 auto', padding: '28px 18px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0 }}>{t('muscle_training.heading')}</h1>
          <span style={{ color: 'var(--text-muted)' }}>{t('muscle_training.subheading')}</span>
        </div>

        {loading && (
          <div style={{ padding: '22px 0', color: 'var(--text-muted)' }}>
            {t('muscle_training.loading')}
          </div>
        )}

        {(!loading && error) && (
          <div className="error-alert" style={{ display: 'block', marginTop: 18 }}>
            {error}
          </div>
        )}

        {(!loading && !error && data) && (
          <>
            <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--card)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('muscle_training.weekly_volume')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {data.weeklyKmEstimate ?? '—'} km/wk
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--card)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('muscle_training.recommended_frequency')}</div>
                <div style={{ fontSize: 22, fontWeight: 700, marginTop: 6 }}>
                  {data.sessionsPerWeek ?? '—'} / wk
                </div>
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 14, background: 'var(--card)' }}>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{t('muscle_training.focus')}</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginTop: 8, lineHeight: 1.3 }}>
                  {data.focus || '—'}
                </div>
              </div>
            </div>

            {data.recoveryHint && (
              <div style={{ marginTop: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 14, background: 'linear-gradient(180deg, rgba(255, 107, 44, 0.10), rgba(255, 107, 44, 0.03))' }}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>{t('muscle_training.recovery_title')}</div>
                <div style={{ color: 'var(--text-muted)', lineHeight: 1.5 }}>{data.recoveryHint}</div>
              </div>
            )}

            <div style={{ marginTop: 12, padding: 14, border: '1px solid var(--border)', borderRadius: 14, background: 'var(--card)' }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}>{t('muscle_training.rationale_title')}</div>
              <div style={{ color: 'var(--text-muted)', lineHeight: 1.55, marginBottom: 10 }}>
                {t('muscle_training.evidence_note')}
              </div>
              {Array.isArray(data.rationale) && data.rationale.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', lineHeight: 1.55 }}>
                  {data.rationale.map((line, i) => (
                    <li key={`r-${i}`}>{line}</li>
                  ))}
                </ul>
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>—</div>
              )}
            </div>

            <div style={{ marginTop: 22, display: 'grid', gap: 14 }}>
              {sessions.map((s, idx) => (
                <div key={`${s.title || 'session'}-${idx}`} style={{ border: '1px solid var(--border)', borderRadius: 16, background: 'var(--card)' }}>
                  <div style={{ padding: '14px 14px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{s.title || t('muscle_training.session')}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {t('muscle_training.duration', { minutes: s.durationMin ?? '—' })}
                    </div>
                  </div>

                  <div style={{ padding: '0 14px 14px', display: 'grid', gap: 10 }}>
                    {(s.blocks || []).map((b, bi) => (
                      <div key={`${b.title || 'block'}-${bi}`} style={{ border: '1px solid var(--border)', borderRadius: 14, padding: 12, background: 'rgba(255,255,255,0.02)' }}>
                        <div style={{ fontWeight: 800, marginBottom: 8 }}>{b.title}</div>
                        <div style={{ display: 'grid', gap: 8 }}>
                          {(b.exercises || []).map((ex, ei) => (
                            <div key={`${ex.name || 'ex'}-${ei}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                              <div style={{ fontWeight: 600 }}>{ex.name}</div>
                              <div style={{ color: 'var(--text-muted)' }}>{ex.prescription}</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

