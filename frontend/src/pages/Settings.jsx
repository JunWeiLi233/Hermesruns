import { useState, useEffect, useRef } from 'react';
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
  const [settingsActionAck, setSettingsActionAck] = useState('');
  const [stravaStatus, setStravaStatus] = useState(null);
  const [stravaLinking, setStravaLinking] = useState(false);
  const appearanceRef = useRef(null);
  const displayNameRef = useRef(null);
  const initialPrefSnapshotRef = useRef(null);
  const currentThemeLabel = t(`profile.theme_${theme.replace('-', '_')}`);
  const currentLanguageLabel = lang === 'zh-CN' ? '中文' : 'English';
  const currentUnitLabel = unit === 'mile' ? 'mi' : 'km';
  const connectedServicesLabel = stravaStatus?.linked ? 'Strava' : t('settings.strava_not_connected');
  const accountStatusItems = [
    {
      label: lang === 'zh-CN' ? '显示名称' : 'Display name',
      tone: displayName.trim() ? 'ready' : 'action',
      value: displayName.trim() || (lang === 'zh-CN' ? '待填写' : 'Needs name'),
    },
    {
      label: t('profile.theme_title'),
      tone: 'ready',
      value: currentThemeLabel,
    },
    {
      label: lang === 'zh-CN' ? 'Strava 新鲜度' : 'Strava freshness',
      tone: stravaStatus?.linked ? 'ready' : 'warning',
      value: stravaStatus?.linked
        ? (lang === 'zh-CN' ? '已连接，可同步' : 'Linked and ready')
        : (lang === 'zh-CN' ? '未连接' : 'Not linked'),
    },
  ];
  const nextAccountAction = !displayName.trim()
    ? (lang === 'zh-CN' ? '先补全显示名称，这样排行榜、奖励和分享视图会更完整。' : 'Start by filling in a display name so rewards, ranking, and sharing views feel complete.')
    : !stravaStatus?.linked
      ? (lang === 'zh-CN' ? '下一步建议连接 Strava，让同步和近期活动状态自动更新。' : 'Next best step: connect Strava so sync and recent activity stay fresh automatically.')
      : (lang === 'zh-CN' ? '账号状态良好，接下来更适合检查主题、语言和距离单位是否符合你的日常使用。' : 'Account status looks healthy. Next, make sure theme, language, and distance unit match your daily setup.');

  const nextAccountActionButton = !displayName.trim()
    ? {
      label: lang === 'zh-CN' ? '填写显示名称' : 'Fill display name',
      onClick: () => displayNameRef.current?.focus(),
    }
    : !stravaStatus?.linked
      ? {
        label: stravaLinking ? t('profile.strava_link_connecting') : t('settings.strava_connect'),
        onClick: connectStrava,
      }
      : {
        label: lang === 'zh-CN' ? '检查显示偏好' : 'Review preferences',
        onClick: () => appearanceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
      };

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

  useEffect(() => {
    const currentSnapshot = `${theme}|${lang}|${unit}`;
    if (initialPrefSnapshotRef.current == null) {
      initialPrefSnapshotRef.current = currentSnapshot;
      return;
    }
    if (initialPrefSnapshotRef.current !== currentSnapshot) {
      initialPrefSnapshotRef.current = currentSnapshot;
      setSettingsActionAck(lang === 'zh-CN' ? '偏好已更新，接下来只需要确认它们适合你的日常使用。' : 'Preferences updated. Next, just confirm they still match your daily setup.');
    }
  }, [lang, theme, unit]);

  useEffect(() => {
    if (settingsActionAck) {
      const timer = setTimeout(() => {
        setSettingsActionAck('');
      }, 10000);
      return () => clearTimeout(timer);
    }
  }, [settingsActionAck]);

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
      setSettingsActionAck(lang === 'zh-CN' ? '显示名称已保存，奖励、分享和账户摘要现在会使用新的名称。' : 'Display name saved. Rewards, sharing, and account summaries will now use the updated name.');
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
          <div className="hero-chip-row settings-summary-row">
            <span className="hero-chip">{t('settings.language_title')}: {currentLanguageLabel}</span>
            <span className="hero-chip">{t('settings.distance_unit_title')}: {currentUnitLabel}</span>
            <span className="hero-chip">{t('profile.theme_title')}: {currentThemeLabel}</span>
            <span className={`hero-chip${stravaStatus?.linked ? ' hero-chip--success' : ''}`}>
              {t('settings.connected_title')}: {connectedServicesLabel}
            </span>
          </div>
          <div className="status-chip-row settings-status-row">
            {accountStatusItems.map((item) => (
              <article key={item.label} className={`status-chip status-chip--${item.tone}`}>
                <span className="status-chip__label">{item.label}</span>
                <strong className="status-chip__value">{item.value}</strong>
              </article>
            ))}
          </div>
          <div className="settings-next-action-row">
            <p className="settings-next-action-helper">{nextAccountAction}</p>
            <button type="button" className="btn-primary btn-inline-md" onClick={nextAccountActionButton.onClick}>
              {nextAccountActionButton.label}
            </button>
          </div>
          {settingsActionAck && (
            <div className="settings-next-action-feedback status-chip status-chip--ready">
              <span className="status-chip__label">{lang === 'zh-CN' ? '刚完成' : 'Completed now'}</span>
              <strong className="status-chip__value">{lang === 'zh-CN' ? '当前推荐动作已生效' : 'Recommended action applied'}</strong>
              <span className="status-chip__helper">{settingsActionAck}</span>
            </div>
          )}
        </section>

        <div className="settings-grid">
          {/* Appearance */}
          <section ref={appearanceRef} className="card settings-section">
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
                  ref={displayNameRef}
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
