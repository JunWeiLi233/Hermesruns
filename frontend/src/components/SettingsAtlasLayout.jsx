import AppIcon from './AppIcon';
import FooterNavLinks from './FooterNavLinks';

export default function SettingsAtlasLayout({
  t,
  navigate,
  initials,
  displayNameResolved,
  mantra,
  activeThemeLabel,
  resolvedLanguageLabel,
  resolvedUnitLabel,
  heroBadge,
  completionScore,
  digestEnabled,
  stravaStatus,
  stravaLabel,
  stravaLinking,
  connectStrava,
  disconnectStrava,
  toggleDigest,
  logout,
  saveProfile,
  nameSaving,
  nameMsg,
  displayName,
  setDisplayName,
  setMantra,
  themeCards,
  theme,
  setTheme,
  unit,
  setUnit,
  lang,
  setLang,
  syncHealthItems,
  wellnessRows = [],
  garminLane,
  setupChecklist,
}) {
  const stravaConnected = Boolean(stravaStatus?.linked);
  const digestStateLabel = digestEnabled ? t('settings.stitch_enabled') : t('settings.stitch_review');

  return (
    <div className="runner-shell-canvas settings-control-canvas settings-atlas-canvas">

      {/* ── Hero ── */}
      <section className="st-hero">
        <div className="st-hero-left">
          <div className="st-hero-avatar-wrap">
            <div className="st-hero-avatar">{initials}</div>
            <span className="st-hero-badge">{heroBadge}</span>
          </div>
          <div className="st-hero-copy">
            <h1 className="st-hero-name">{displayNameResolved}</h1>
            <p className="st-hero-desc">{mantra || t('settings.stitch_hero_copy')}</p>
            <div className="st-hero-chips">
              <span className="st-chip">{resolvedUnitLabel}</span>
              <span className="st-chip">{resolvedLanguageLabel}</span>
              <span className="st-chip">{activeThemeLabel}</span>
            </div>
          </div>
        </div>
        <div className="st-hero-right">
          <div className="st-hero-stat">
            <span>{t('settings.stitch_completion_title')}</span>
            <strong>{completionScore}%</strong>
            <div className="st-progress-track" aria-hidden="true">
              <div className="st-progress-fill" style={{ width: `${completionScore}%` }} />
            </div>
          </div>
        </div>
      </section>

      {/* ── Row 1: Account + Preferences ── */}
      <div className="st-main-grid">

        {/* Account */}
        <article className="st-card">
          <div className="st-card-head">
            <div>
              <p className="st-kicker">{t('settings.stitch_account_kicker')}</p>
              <h3 className="st-card-title">{t('settings.stitch_account_info')}</h3>
            </div>
          </div>
          <form className="st-account-form" onSubmit={saveProfile}>
            <div className="st-field">
              <label className="st-label" htmlFor="st-display-name">{t('settings.display_name_title')}</label>
              <input
                id="st-display-name"
                className="st-input"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('settings.display_name_placeholder')}
                maxLength={60}
              />
            </div>
            <div className="st-field">
              <label className="st-label" htmlFor="st-mantra">{t('settings.stitch_account_identity')}</label>
              <textarea
                id="st-mantra"
                className="st-textarea"
                value={mantra}
                onChange={(e) => setMantra(e.target.value)}
                placeholder={t('settings.stitch_account_identity_placeholder')}
                rows={3}
              />
            </div>
            <div className="st-account-actions">
              <button type="submit" className="st-btn-primary" disabled={nameSaving || !displayName.trim()}>
                {nameSaving ? t('settings.saving') : t('settings.save')}
              </button>
              {nameMsg ? <span className="st-msg">{nameMsg}</span> : null}
            </div>
          </form>
        </article>

        {/* Preferences */}
        <article className="st-card">
          <div className="st-card-head">
            <div>
              <p className="st-kicker">{t('settings.stitch_preferences')}</p>
              <h3 className="st-card-title">{t('settings.stitch_prefs_title')}</h3>
            </div>
          </div>

          {/* Units */}
          <div className="st-pref-row" style={{ borderTop: 'none', paddingTop: 0 }}>
            <div className="st-pref-label">
              <AppIcon name="straighten" className="runner-dashboard-side-link-icon" />
              <div>
                <strong>{t('settings.stitch_metric_label')} / {t('settings.stitch_imperial_label')}</strong>
                <span>{t('settings.stitch_unit_desc')}</span>
              </div>
            </div>
            <div className="st-segmented">
              <button type="button" className={unit === 'km' ? 'is-active' : ''} onClick={() => setUnit('km')}>
                {t('settings.stitch_metric_label')}
              </button>
              <button type="button" className={unit === 'mile' ? 'is-active' : ''} onClick={() => setUnit('mile')}>
                {t('settings.stitch_imperial_label')}
              </button>
            </div>
          </div>

          {/* Theme */}
          <div className="st-pref-row">
            <div className="st-pref-label">
              <AppIcon name="palette" className="runner-dashboard-side-link-icon" />
              <div>
                <strong>{t('settings.stitch_theme_title')}</strong>
                <span>{t('settings.stitch_theme_desc')}</span>
              </div>
            </div>
            <div className="st-theme-cards">
              {themeCards.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  className={`st-theme-card${theme === card.value ? ' is-active' : ''}`}
                  onClick={() => setTheme(card.value)}
                  aria-pressed={theme === card.value}
                  aria-label={card.label}
                >
                  <AppIcon name={card.icon} className="runner-dashboard-side-link-icon" />
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="st-pref-row">
            <div className="st-pref-label">
              <AppIcon name="translate" className="runner-dashboard-side-link-icon" />
              <div>
                <strong>{t('settings.language_title')}</strong>
                <span>{t('settings.language_hint')}</span>
              </div>
            </div>
            <div className="st-select-wrap">
              <select className="st-select" value={lang} onChange={(e) => setLang(e.target.value)}>
                <option value="zh-CN">中文（简体）</option>
                <option value="en">English (US)</option>
              </select>
            </div>
          </div>
        </article>
      </div>

      {/* ── Row 2: Checklist, Brief, Logout ── */}
      <div className="st-main-grid">

        {/* Setup checklist */}
        <article className="st-card">
          <div className="st-card-head">
            <div>
              <p className="st-kicker">{t('settings.stitch_checklist_kicker')}</p>
              <h3 className="st-card-title">{t('settings.stitch_setup_checklist_title')}</h3>
            </div>
          </div>
          <p className="st-checklist-desc">{t('settings.stitch_setup_checklist_copy')}</p>
          <div className="st-checklist">
            {setupChecklist.map((item) => (
              <div key={item.key} className={`st-checklist-item${item.done ? ' is-done' : ''}`}>
                <span className={`st-check-icon${item.done ? ' done' : ''}`}>
                  <AppIcon name={item.done ? 'check_circle' : 'radio_button_unchecked'} className="runner-dashboard-side-link-icon" />
                </span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </article>

        {/* Weekly brief + Logout */}
        <article className="st-card">
          <div className="st-card-head">
            <div>
              <p className="st-kicker">{t('settings.stitch_weekly_brief')}</p>
              <h3 className="st-card-title">{t('settings.stitch_weekly_brief')}</h3>
            </div>
          </div>
          <p className="st-brief-desc">{t('settings.stitch_weekly_brief_copy')}</p>
          <div className="st-brief-toggle">
            <span>{t('settings.stitch_brief_status')}: <strong>{digestStateLabel}</strong></span>
            <button
              type="button"
              className={`st-toggle-btn${digestEnabled ? ' is-on' : ''}`}
              onClick={toggleDigest}
              aria-pressed={digestEnabled}
            >
              <span className="st-toggle-thumb" />
            </button>
          </div>
          <div className="st-logout-section">
            <button
              type="button"
              className="st-logout-btn"
              onClick={() => { logout(); navigate('/login'); }}
            >
              <AppIcon name="logout" className="runner-dashboard-side-link-icon" />
              <span>{t('settings.logout_btn')}</span>
            </button>
            <span className="st-logout-hint">{t('settings.stitch_danger_copy')}</span>
          </div>
        </article>
      </div>

      {/* ── Connected Services (full-width) ── */}
      <section className="st-services">
        <div className="st-card-head">
          <div>
            <p className="st-kicker">{t('settings.connected_title')}</p>
            <h3 className="st-card-title">{t('settings.stitch_data_services_title')}</h3>
          </div>
        </div>

        <div className="st-services-grid">
          {/* Strava */}
          <div className={`st-service-card${stravaConnected ? ' is-connected' : ''}`}>
            <div className="st-service-head">
              <div className="st-service-icon is-strava">
                <AppIcon name="altitude" className="runner-dashboard-side-link-icon" />
              </div>
              <div className="st-service-info">
                <strong>STRAVA</strong>
                <span>{stravaLabel}</span>
              </div>
              <button
                type="button"
                className={`st-service-btn${stravaConnected ? '' : ' is-connect'}`}
                onClick={stravaConnected ? disconnectStrava : connectStrava}
                disabled={stravaLinking}
              >
                {stravaConnected
                  ? t('settings.stitch_manage')
                  : (stravaLinking ? t('profile.strava_link_connecting') : t('settings.stitch_connect'))}
              </button>
            </div>
          </div>

          {/* Garmin */}
          <div className="st-service-card">
            <div className="st-service-head">
              <div className="st-service-icon is-garmin">
                <AppIcon name="watch" className="runner-dashboard-side-link-icon" />
              </div>
              <div className="st-service-info">
                <strong>{garminLane.title}</strong>
                <span>{garminLane.summary}</span>
              </div>
              <button
                type="button"
                className="st-service-btn is-connect"
                onClick={() => navigate('/settings/garmin-import')}
              >
                {garminLane.primaryAction}
              </button>
            </div>
            <div className="st-service-meta">
              <div className="st-service-stat">
                <span>{garminLane.limitLabel}</span>
                <strong>{garminLane.limitValue}</strong>
              </div>
              <div className="st-service-stat">
                <span>{garminLane.manualLabel}</span>
                <strong>{garminLane.manualValue}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Sync health */}
        <div className="st-sync-section">
          <strong className="st-sync-title">{t('settings.stitch_sync_health_title')}</strong>
          <div className="st-sync-list">
            {syncHealthItems.map((item) => (
              <div key={item.key} className="st-sync-row">
                <div className="st-sync-copy">
                  <strong>{item.label}</strong>
                  <span>{item.value}</span>
                </div>
                <span className={`st-sync-pill is-${item.tone}`}>
                  {item.tone === 'live'
                    ? t('settings.stitch_connected_short')
                    : item.tone === 'ready'
                      ? t('settings.stitch_ready_short')
                      : t('settings.stitch_review')}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Wellness ── */}
      <div className="st-bottom-grid">
        <article className="st-card">
          <div className="st-card-head">
            <div>
              <p className="st-kicker">{t('settings.stitch_wellness_hub_title')}</p>
              <h3 className="st-card-title">{t('settings.stitch_wellness_hub_title')}</h3>
            </div>
          </div>
          <p className="st-wellness-desc">{t('settings.stitch_wellness_hub_copy')}</p>
          <div className="st-wellness-list">
            {wellnessRows.map((row) => (
              <div key={row.key} className="st-wellness-row">
                <div className="st-wellness-copy">
                  <strong>{t(row.labelKey)}</strong>
                  <span>{t('settings.stitch_wellness_source_label')}</span>
                </div>
                <span className="st-wellness-pill">{row.sourceLabel}</span>
              </div>
            ))}
          </div>
        </article>
      </div>

      <footer className="runner-shell-footer settings-atlas-footer">
        <FooterNavLinks />
        <p>{t('landing.stitch_footer_copy')}</p>
      </footer>
    </div>
  );
}
