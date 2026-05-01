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
  ecosystemCount,
  digestLabel,
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
  quickControls,
  syncHealthItems,
  wellnessRows = [],
  garminLane,
  setupChecklist,
}) {
  const digestStateLabel = digestEnabled ? t('settings.stitch_enabled') : t('settings.stitch_review');
  const stravaConnected = Boolean(stravaStatus?.linked);

  return (
    <div className="runner-shell-canvas settings-control-canvas settings-atlas-canvas">
      <header className="settings-atlas-header">
        <div>
          <h1>{t('settings.heading')}</h1>
          <div className="settings-atlas-underline" aria-hidden="true" />
        </div>
        <div className="settings-atlas-header-meta">
          <span>{t('settings.stitch_control_matrix')}</span>
          <strong>{activeThemeLabel}</strong>
        </div>
      </header>

      <section className="settings-atlas-hero">
        <article className="settings-atlas-hero-main">
          <div className="settings-atlas-hero-avatar-wrap">
            <div className="settings-atlas-hero-avatar">{initials}</div>
            <span className="settings-atlas-hero-badge">{heroBadge}</span>
          </div>

          <div className="settings-atlas-hero-copy">
            <div className="settings-atlas-hero-title-row">
              <h2>{displayNameResolved}</h2>
              <span className="settings-atlas-tier-pill">PRO</span>
            </div>
            <p>{mantra || t('settings.stitch_hero_copy')}</p>
            <div className="settings-atlas-hero-pills">
              <span>{resolvedUnitLabel}</span>
              <span>{resolvedLanguageLabel}</span>
              <span>{activeThemeLabel}</span>
            </div>
          </div>
        </article>

        <aside className="settings-atlas-hero-stats">
          <article>
            <span>{t('settings.stitch_completion_title')}</span>
            <strong>{completionScore}%</strong>
            <div className="settings-atlas-progress-track" aria-hidden="true">
              <span className="settings-atlas-progress-fill" style={{ width: `${completionScore}%` }} />
            </div>
          </article>
          <article>
            <span>{t('settings.stitch_data_ecosystem')}</span>
            <strong>{t('settings.stitch_live_services', { count: ecosystemCount })}</strong>
          </article>
          <article>
            <span>{t('settings.stitch_weekly_brief')}</span>
            <strong className="settings-atlas-accent-copy">{digestLabel}</strong>
          </article>
        </aside>
      </section>

      <div className="settings-atlas-grid">
        <section className="settings-atlas-column">
          <div className="settings-atlas-column-head">
            <h3>{t('settings.stitch_preferences')}</h3>
          </div>

          <article className="settings-atlas-panel settings-atlas-panel--identity">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_account_info')}</strong>
              <span>{t('settings.stitch_account_identity')}</span>
            </div>

            <form id="settings-atlas-profile-form" className="settings-atlas-account-fields" onSubmit={saveProfile}>
              <div>
                <label className="settings-control-label" htmlFor="settings-atlas-display-name">{t('settings.display_name_title')}</label>
                <input id="settings-atlas-display-name" className="settings-control-input" type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder={t('settings.display_name_placeholder')} maxLength={60} />
              </div>

              <div>
                <label className="settings-control-label" htmlFor="settings-atlas-mantra">{t('settings.stitch_account_identity')}</label>
                <textarea id="settings-atlas-mantra" className="settings-control-textarea" value={mantra} onChange={(event) => setMantra(event.target.value)} placeholder={t('settings.stitch_account_identity_placeholder')} rows={4} />
              </div>

              <div className="settings-atlas-account-actions">
                <button type="submit" className="settings-atlas-primary-btn" disabled={nameSaving || !displayName.trim()}>
                  {nameSaving ? t('settings.saving') : t('settings.save')}
                </button>
                {nameMsg ? <p className="settings-control-message">{nameMsg}</p> : null}
              </div>
            </form>
          </article>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.distance_unit_title')}</strong>
              <span>{t('settings.distance_unit_hint')}</span>
            </div>
            <div className="settings-control-segmented settings-atlas-segmented">
              <button type="button" className={unit === 'km' ? 'is-active' : ''} onClick={() => setUnit('km')}>{t('settings.stitch_metric_label')}</button>
              <button type="button" className={unit === 'mile' ? 'is-active' : ''} onClick={() => setUnit('mile')}>{t('settings.stitch_imperial_label')}</button>
            </div>
          </article>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.language_title')}</strong>
              <span>{resolvedLanguageLabel}</span>
            </div>
            <div className="settings-control-select-shell settings-atlas-select-shell">
              <select id="settings-atlas-language" className="settings-control-select" value={lang} onChange={(event) => setLang(event.target.value)}>
                <option value="zh-CN">中文（简体）</option>
                <option value="en">English (US)</option>
              </select>
              <AppIcon name="expand_more" className="runner-dashboard-side-link-icon" />
            </div>
          </article>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('profile.theme_title')}</strong>
              <span>{activeThemeLabel}</span>
            </div>
            <div className="settings-atlas-theme-grid">
              {themeCards.map((card) => (
                <button
                  key={card.value}
                  type="button"
                  className={`settings-control-theme-card${theme === card.value ? ' is-active' : ''}`}
                  onClick={() => setTheme(card.value)}
                  aria-pressed={theme === card.value}
                  aria-label={card.label}
                >
                  <AppIcon name={card.icon} className="runner-dashboard-side-link-icon" />
                  <span>{card.label}</span>
                </button>
              ))}
            </div>
          </article>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_quick_controls_title')}</strong>
              <span>{t('settings.stitch_quick_controls_copy')}</span>
            </div>
            <div className="settings-atlas-quick-grid">
              {quickControls.map((control) => (
                <button
                  key={control.key}
                  type="button"
                  className="settings-atlas-quick-card"
                  onClick={control.action}
                >
                  <span className="settings-atlas-quick-icon">
                    <AppIcon name={control.icon} className="runner-dashboard-side-link-icon" />
                  </span>
                  <span className="settings-atlas-quick-copy">
                    <strong>{control.label}</strong>
                    <span>{control.value}</span>
                  </span>
                </button>
              ))}
            </div>
          </article>
        </section>

        <section className="settings-atlas-column">
          <div className="settings-atlas-column-head">
            <h3>{t('settings.danger_title')}</h3>
          </div>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_setup_checklist_title')}</strong>
              <span>{t('settings.stitch_setup_checklist_copy')}</span>
            </div>
            <div className="settings-atlas-checklist">
              {setupChecklist.map((item) => (
                <div key={item.key} className={`settings-atlas-checklist-item${item.done ? ' is-done' : ''}`}>
                  <span className="settings-atlas-checklist-icon">
                    <AppIcon name={item.done ? 'check_circle' : 'radio_button_unchecked'} className="runner-dashboard-side-link-icon" />
                  </span>
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
          </article>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_weekly_brief')}</strong>
              <span>{t('settings.stitch_weekly_brief_copy')}</span>
            </div>
            <div className="settings-atlas-brief-meta">
              <span>{t('settings.stitch_control_matrix')}</span>
              <strong>{digestStateLabel}</strong>
            </div>
            <button type="button" className="settings-atlas-digest-btn" onClick={toggleDigest}>
              {digestEnabled ? t('settings.stitch_digest_enabled') : t('settings.stitch_enable_digest')}
            </button>
          </article>

          <article className="settings-atlas-panel settings-atlas-panel--session">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.logout_btn')}</strong>
              <span>{t('settings.stitch_danger_copy')}</span>
            </div>
            <button type="button" className="settings-atlas-action-btn" onClick={() => { logout(); navigate('/login'); }}>
              <AppIcon name="logout" className="runner-dashboard-side-link-icon" />
              <span>{t('settings.logout_btn')}</span>
            </button>
          </article>

          <article className="settings-atlas-panel settings-atlas-panel--build">
            <div className="settings-atlas-build-meta">
              <div>
                <span>{t('settings.stitch_control_matrix')}</span>
                <strong>{resolvedLanguageLabel}</strong>
              </div>
              <div>
                <span>{t('profile.theme_title')}</span>
                <strong>{activeThemeLabel}</strong>
              </div>
              <div>
                <span>{t('settings.distance_unit_title')}</span>
                <strong>{resolvedUnitLabel}</strong>
              </div>
            </div>
          </article>
        </section>

        <section className="settings-atlas-column">
          <div className="settings-atlas-column-head">
            <h3>{t('settings.stitch_data_ecosystem')}</h3>
          </div>

          <article className="settings-atlas-panel settings-atlas-service-card">
            <div className="settings-atlas-service-main">
              <span className="settings-atlas-service-icon is-strava">
                <AppIcon name="altitude" className="runner-dashboard-side-link-icon" />
              </span>
              <div>
                <strong>STRAVA</strong>
                <p className={stravaConnected ? 'is-live' : ''}>{stravaLabel}</p>
              </div>
            </div>
            <button type="button" className={`settings-atlas-service-action${stravaConnected ? '' : ' is-connect'}`} onClick={stravaConnected ? disconnectStrava : connectStrava} disabled={stravaLinking}>
              {stravaConnected ? t('settings.stitch_manage') : (stravaLinking ? t('profile.strava_link_connecting') : t('settings.stitch_connect'))}
            </button>
          </article>

          <div className="settings-atlas-garmin-cluster">
            <article className="settings-atlas-panel settings-atlas-service-card settings-atlas-service-card--garmin">
              <div className="settings-atlas-service-lane">
                <div className="settings-atlas-service-kicker-row">
                  <span className="settings-atlas-service-kicker-line" aria-hidden="true" />
                  <span>{garminLane.eyebrow}</span>
                </div>

                <div className="settings-atlas-service-main settings-atlas-service-main--garmin">
                  <span className="settings-atlas-service-icon is-garmin" aria-hidden="true">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="8" />
                      <path d="M12 7v7" />
                      <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
                      <path d="M8 18h8" />
                    </svg>
                  </span>
                  <div>
                    <strong>{garminLane.title}</strong>
                    <p>{garminLane.summary}</p>
                  </div>
                </div>

                <div className={`settings-atlas-service-state-card is-${garminLane.tone}`}>
                  <span>{garminLane.eyebrow}</span>
                  <strong>{garminLane.status}</strong>
                </div>

                <div className="settings-atlas-service-meta-grid">
                  <article className="settings-atlas-service-metric">
                    <span>{garminLane.limitLabel}</span>
                    <strong>{garminLane.limitValue}</strong>
                  </article>
                  <article className="settings-atlas-service-metric">
                    <span>{garminLane.manualLabel}</span>
                    <strong>{garminLane.manualValue}</strong>
                  </article>
                </div>

                <p className="settings-atlas-service-note">{garminLane.credentialsNote}</p>
                <button type="button" className="settings-atlas-service-action is-connect" onClick={() => navigate('/settings/garmin-import')}>
                  {garminLane.primaryAction}
                </button>
              </div>
            </article>

            <button type="button" className="settings-atlas-panel settings-atlas-import-drop settings-atlas-import-drop--garmin" onClick={() => navigate('/settings/import-data')}>
              <div className="settings-atlas-import-drop-copy">
                <span className="settings-atlas-import-drop-kicker">{garminLane.manualValue}</span>
                <strong>{garminLane.manualLabel}</strong>
                <p>{t('profile.import_hint')}</p>
              </div>
              <AppIcon name="upload_file" className="runner-dashboard-side-link-icon" />
            </button>
          </div>

          <article className="settings-atlas-panel">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_sync_health_title')}</strong>
              <span>{t('settings.stitch_sync_health_copy')}</span>
            </div>
            <div className="settings-atlas-sync-stack">
              {syncHealthItems.map((item) => (
                <div key={item.key} className={`settings-atlas-sync-row is-${item.tone}`}>
                  <div className="settings-atlas-sync-copy">
                    <strong>{item.label}</strong>
                    <span>{item.value}</span>
                  </div>
                  <span className="settings-atlas-sync-pill">
                    {item.tone === 'live' ? t('settings.stitch_connected_short') : (item.tone === 'ready' ? t('settings.stitch_ready_short') : t('settings.stitch_review'))}
                  </span>
                </div>
              ))}
            </div>
          </article>

          <article className="settings-atlas-panel settings-atlas-panel--wellness-hub">
            <div className="settings-atlas-panel-head">
              <strong>{t('settings.stitch_wellness_hub_title')}</strong>
              <span>{t('settings.stitch_wellness_hub_copy')}</span>
            </div>
            <div className="settings-atlas-sync-stack settings-atlas-wellness-stack">
              {wellnessRows.map((row) => (
                <div key={row.key} className="settings-atlas-sync-row is-ready">
                  <div className="settings-atlas-sync-copy">
                    <strong>{t(row.labelKey)}</strong>
                    <span>{t('settings.stitch_wellness_source_label')}</span>
                  </div>
                  <span className="settings-atlas-sync-pill">{row.sourceLabel}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
      </div>

      <footer className="runner-shell-footer settings-atlas-footer">
        <FooterNavLinks />
        <p>{t('landing.stitch_footer_copy')}</p>
      </footer>
    </div>
  );
}
