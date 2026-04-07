import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useTheme } from '../contexts/ThemeContext';
import { useUnit } from '../contexts/UnitContext';
import { apiJson, apiFetch } from '../api';
import AuthenticatedPageChrome from '../components/AuthenticatedPageChrome';

export default function Settings() {
  const { isAuthenticated, logout } = useAuth();
  const { t, lang, setLang } = useI18n();
  const { theme, setTheme } = useTheme();
  const { unit, setUnit } = useUnit();
  const navigate = useNavigate();

  const [profile, setProfile] = useState(null);
  const [displayName, setDisplayName] = useState('');
  const [nameSaving, setNameSaving] = useState(false);
  const [nameMsg, setNameMsg] = useState('');
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaLinking, setStravaLinking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }
    apiJson('/api/profile/me').then(data => {
      setProfile(data);
      setDisplayName(data?.displayName || '');
    }).catch(() => {});
    apiJson('/api/auth/strava/status').then(data => {
      setStravaStatus(data);
    }).catch(() => setStravaStatus(null));
  }, [isAuthenticated, navigate]);

  async function saveDisplayName(e) {
    e.preventDefault();
    if (!displayName.trim()) return;
    setNameSaving(true);
    setNameMsg('');
    try {
      await apiJson('/api/profile/display-name', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ displayName: displayName.trim() }),
      });
      setNameMsg(t('settings.name_saved'));
    } catch {
      setNameMsg(t('settings.name_error'));
    } finally {
      setNameSaving(false);
    }
  }

  async function connectStrava() {
    setStravaLinking(true);
    try {
      const data = await apiJson('/api/auth/strava/link-url');
      if (data?.url) window.location.href = data.url;
    } catch {
      setStravaLinking(false);
    }
  }

  async function disconnectStrava() {
    try {
      await apiFetch('/api/auth/strava/unlink', { method: 'DELETE' });
      setStravaStatus(prev => ({ ...prev, linked: false }));
    } catch { /* ignored */ }
  }

  return (
    <AuthenticatedPageChrome bodyClassName="settings-page" profile={profile ? { displayName: profile.displayName, email: profile.email } : null}>
      <main className="dashboard-container settings-container">
        <section className="settings-hero">
          <span className="settings-hero__eyebrow">{t('settings.eyebrow')}</span>
          <h1 className="settings-hero__title">{t('settings.heading')}</h1>
          <p className="settings-hero__copy">{t('settings.copy')}</p>
        </section>

        <div className="settings-grid">
          {/* Appearance */}
          <section className="card settings-section">
            <h2 className="settings-section__title">{t('settings.appearance_title')}</h2>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>{t('profile.theme_title')}</strong>
                <p>{t('profile.theme_hint')}</p>
              </div>
              <select className="theme-select" value={theme} onChange={e => setTheme(e.target.value)}>
                <option value="light">{t('profile.theme_light')}</option>
                <option value="midnight">{t('profile.theme_midnight')}</option>
                <option value="high-contrast">{t('profile.theme_high_contrast')}</option>
                <option value="high-contrast-light">{t('profile.theme_high_contrast_light')}</option>
              </select>
            </div>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>{t('settings.language_title')}</strong>
                <p>{t('settings.language_hint')}</p>
              </div>
              <select className="theme-select" value={lang} onChange={e => setLang(e.target.value)}>
                <option value="zh-CN">中文</option>
                <option value="en">English</option>
              </select>
            </div>
          </section>

          {/* Units */}
          <section className="card settings-section">
            <h2 className="settings-section__title">{t('settings.units_title')}</h2>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>{t('settings.distance_unit_title')}</strong>
                <p>{t('settings.distance_unit_hint')}</p>
              </div>
              <div className="settings-unit-toggle">
                <button
                  type="button"
                  className={`settings-unit-btn${unit === 'km' ? ' active' : ''}`}
                  onClick={() => setUnit('km')}
                >
                  km
                </button>
                <button
                  type="button"
                  className={`settings-unit-btn${unit === 'mile' ? ' active' : ''}`}
                  onClick={() => setUnit('mile')}
                >
                  mi
                </button>
              </div>
            </div>
          </section>

          {/* Account */}
          <section className="card settings-section">
            <h2 className="settings-section__title">{t('settings.account_title')}</h2>
            <form className="settings-name-form" onSubmit={saveDisplayName}>
              <div className="settings-copy">
                <strong>{t('settings.display_name_title')}</strong>
                <p>{t('settings.display_name_hint')}</p>
              </div>
              <div className="settings-name-row">
                <input
                  className="settings-name-input"
                  type="text"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder={t('settings.display_name_placeholder')}
                  maxLength={60}
                />
                <button type="submit" className="btn-primary" disabled={nameSaving}>
                  {nameSaving ? t('settings.saving') : t('settings.save')}
                </button>
              </div>
              {nameMsg && <p className="settings-msg">{nameMsg}</p>}
            </form>
          </section>

          {/* Connected Services */}
          <section className="card settings-section">
            <h2 className="settings-section__title">{t('settings.connected_title')}</h2>
            <div className="settings-row settings-row--service">
              <div className="settings-copy">
                <strong>{t('settings.strava_title')}</strong>
                <p>{stravaStatus?.linked
                  ? t('settings.strava_connected', { email: stravaStatus.stravaEmail || '' })
                  : t('settings.strava_not_connected')}
                </p>
              </div>
              {stravaStatus?.linked ? (
                <button type="button" className="btn-secondary" onClick={disconnectStrava}>
                  {t('settings.strava_disconnect')}
                </button>
              ) : (
                <button type="button" className="btn-primary" onClick={connectStrava} disabled={stravaLinking}>
                  {stravaLinking ? t('profile.strava_link_connecting') : t('settings.strava_connect')}
                </button>
              )}
            </div>
          </section>

          {/* Danger zone */}
          <section className="card settings-section settings-section--danger">
            <h2 className="settings-section__title">{t('settings.danger_title')}</h2>
            <div className="settings-row">
              <div className="settings-copy">
                <strong>{t('settings.logout_title')}</strong>
                <p>{t('settings.logout_hint')}</p>
              </div>
              <button type="button" className="btn-secondary" onClick={() => { logout(); navigate('/login'); }}>
                {t('settings.logout_btn')}
              </button>
            </div>
          </section>
        </div>
      </main>
    </AuthenticatedPageChrome>
  );
}
