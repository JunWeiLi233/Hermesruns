import { useEffect, useRef, useState } from 'react';
import AppIcon from './AppIcon';
import FooterNavLinks from './FooterNavLinks';
import RunActivityContributionGraph from './RunActivityContributionGraph';
import SettingsDataCard from './SettingsDataCard';
import SettingsTimeZoneRow from './SettingsTimeZoneRow';
import SettingsTrainingZones from './SettingsTrainingZones';

/* Settings v2 (design 25a): sticky section selector + one active group.
   Disconnecting Strava and deleting the account only ask here (requestStravaDisconnect,
   onRequestDeleteAccount): the confirmation dialogs live in Settings.jsx, outside .st-v2. */

const SECTION_IDS = ['profile', 'preferences', 'training', 'connections', 'notifications', 'activity', 'account'];

export default function SettingsAtlasLayout({
  initialSection,
  t,
  navigate,
  initials,
  displayNameResolved,
  mantra,
  activeThemeLabel,
  resolvedLanguageLabel,
  resolvedUnitLabel,
  completionScore,
  digestEnabled,
  stravaStatus,
  stravaLabel,
  stravaLinking,
  stravaNotice,
  connectStrava,
  requestStravaDisconnect,
  timeZone,
  onTimeZoneSaved,
  onRequestDeleteAccount,
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
  syncHealthItems = [],
  wellnessRows = [],
  garminLane,
  onOpenGarminImport,
  setupChecklist = [],
  runActivities = [],
  runActivityState = 'loading',
  avatarUrl,
  avatarSaving,
  avatarMsg,
  onAvatarUpload,
  onAvatarRemove,
}) {
  const [activeSection, setActiveSection] = useState(SECTION_IDS.includes(initialSection) ? initialSection : 'profile');
  // The address can ask for another tab while Settings stays open (a link to /settings?section=training from
  // here, or the browser's back and forward buttons), so a changed request moves the tab too.
  const [requestedSection, setRequestedSection] = useState(initialSection);
  if (initialSection !== requestedSection) {
    setRequestedSection(initialSection);
    if (SECTION_IDS.includes(initialSection)) setActiveSection(initialSection);
  }
  const [compactNavigation, setCompactNavigation] = useState(false);
  const avatarInputRef = useRef(null);
  const sectionTabsRef = useRef(null);
  const stravaConnected = Boolean(stravaStatus?.linked);
  const avatarActionLabel = avatarUrl ? t('settings.avatar_change') : t('settings.avatar_upload');
  const doneCount = setupChecklist.filter((item) => item.done).length;
  const sections = [
    ['profile', t('settings.stitch_account_info')],
    ['preferences', t('settings.stitch_prefs_title')],
    ['training', t('settings.training_tab')],
    ['connections', t('settings.stitch_data_services_title')],
    ['notifications', t('settings.v2_notifications_title')],
    ['activity', t('settings.v2_activity_title')],
    ['account', t('settings.v2_account_title')],
  ];

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 1100px)');
    if (!media) return undefined;
    const update = () => setCompactNavigation(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  function handleSectionKeyDown(event, index) {
    const nextIndex = {
      ArrowDown: (index + 1) % sections.length,
      ArrowRight: (index + 1) % sections.length,
      ArrowUp: (index - 1 + sections.length) % sections.length,
      ArrowLeft: (index - 1 + sections.length) % sections.length,
      Home: 0,
      End: sections.length - 1,
    }[event.key];
    if (nextIndex == null) return;
    event.preventDefault();
    const nextSection = sections[nextIndex][0];
    setActiveSection(nextSection);
    sectionTabsRef.current?.querySelector(`#st-v2-tab-${nextSection}`)?.focus();
  }

  function handleAvatarSelection(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onAvatarUpload?.(file);
  }

  const avatar = (size) => (
    <span className={`st-v2-avatar is-${size}`} aria-hidden="true">
      {avatarUrl ? <img src={avatarUrl} alt="" width="256" height="256" loading="eager" decoding="async" /> : initials}
    </span>
  );

  return (
    <div className="runner-shell-canvas settings-control-canvas settings-atlas-canvas st-v2">
      <div className="st-v2-layout">
        <aside className="st-v2-index">
          <div className="st-v2-identity">
            {avatar('md')}
            <div>
              <strong>{displayNameResolved}</strong>
              <span>{mantra || t('settings.stitch_hero_copy')}</span>
            </div>
          </div>

          <div className="st-v2-setup">
            <div className="st-v2-setup-head">
              <span>{t('settings.stitch_completion_title')}</span>
              <strong>{setupChecklist.length ? `${doneCount} / ${setupChecklist.length}` : `${completionScore}%`}</strong>
            </div>
            <div className="st-v2-progress" aria-hidden="true"><i style={{ width: `${completionScore}%` }} /></div>
            <ul>
              {setupChecklist.map((item) => (
                <li key={item.key} className={item.done ? 'is-done' : ''}>
                  <span className="st-v2-check" aria-hidden="true">{item.done ? '✓' : ''}</span>
                  {item.label}
                </li>
              ))}
            </ul>
          </div>

          <nav ref={sectionTabsRef} className="st-v2-nav" role="tablist" aria-orientation={compactNavigation ? 'horizontal' : 'vertical'} aria-label={t('settings.heading')}>
            {sections.map(([id, label], index) => (
              <button
                key={id}
                id={`st-v2-tab-${id}`}
                type="button"
                role="tab"
                className={activeSection === id ? 'is-active' : ''}
                aria-selected={activeSection === id}
                aria-controls={`st-v2-${id}`}
                tabIndex={activeSection === id ? 0 : -1}
                onClick={() => setActiveSection(id)}
                onKeyDown={(event) => handleSectionKeyDown(event, index)}
              >
                {label}
              </button>
            ))}
          </nav>
        </aside>

        <div className="st-v2-content">
          <h1 className="st-v2-title">{t('settings.heading')}</h1>

          <section id="st-v2-profile" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'profile'} aria-labelledby="st-v2-tab-profile">
            <h2 id="st-v2-profile-label" className="st-v2-group-label">{t('settings.stitch_account_info')}</h2>
            <form className="st-v2-card" onSubmit={saveProfile}>
              <div className="st-v2-row">
                <div className="st-v2-row-lead">
                  {avatar('lg')}
                  <div className="st-v2-row-copy">
                    <strong>{t('settings.avatar_title')}</strong>
                    <span>{t('settings.avatar_hint')}</span>
                    {avatarMsg ? <span role="status">{avatarMsg}</span> : null}
                  </div>
                </div>
                <div className="st-v2-row-actions">
                  <input
                    ref={avatarInputRef}
                    id="st-profile-avatar-input"
                    className="st-avatar-file-input"
                    tabIndex={-1}
                    type="file"
                    accept="image/png,image/jpeg"
                    aria-label={avatarActionLabel}
                    disabled={avatarSaving}
                    onChange={handleAvatarSelection}
                  />
                  <button type="button" className="st-v2-btn" disabled={avatarSaving} onClick={() => avatarInputRef.current?.click()}>
                    {avatarSaving ? t('settings.avatar_uploading') : avatarActionLabel}
                  </button>
                  {avatarUrl ? (
                    <button type="button" className="st-v2-btn is-quiet" disabled={avatarSaving} onClick={onAvatarRemove}>
                      {t('settings.avatar_remove')}
                    </button>
                  ) : null}
                </div>
              </div>
              <label className="st-v2-row st-v2-field" htmlFor="st-display-name">
                <span className="st-v2-field-label">{t('settings.display_name_title')}</span>
                <input
                  id="st-display-name"
                  className="st-v2-input"
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder={t('settings.display_name_placeholder')}
                  maxLength={60}
                />
              </label>
              <label className="st-v2-row st-v2-field" htmlFor="st-mantra">
                <span className="st-v2-field-label">{t('settings.stitch_account_identity')}</span>
                <input
                  id="st-mantra"
                  className="st-v2-input"
                  type="text"
                  value={mantra}
                  onChange={(e) => setMantra(e.target.value)}
                  placeholder={t('settings.stitch_account_identity_placeholder')}
                  maxLength={120}
                />
              </label>
              <div className="st-v2-row st-v2-save">
                {nameMsg ? <span className="st-v2-msg" role="status">{nameMsg}</span> : <span />}
                <button type="submit" className="st-v2-primary" disabled={nameSaving || !displayName.trim()}>
                  {nameSaving ? t('settings.saving') : t('settings.save')}
                </button>
              </div>
            </form>
          </section>

          <section id="st-v2-preferences" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'preferences'} aria-labelledby="st-v2-tab-preferences">
            <h2 id="st-v2-preferences-label" className="st-v2-group-label">{t('settings.stitch_prefs_title')}</h2>
            <div className="st-v2-card">
              <div className="st-v2-row">
                <div className="st-v2-row-copy">
                  <strong>{t('settings.v2_units_title')}</strong>
                  <span>{t('settings.stitch_unit_desc')}</span>
                </div>
                <div className="st-v2-segmented" role="group" aria-label={t('settings.v2_units_title')}>
                  <button type="button" className={unit === 'km' ? 'is-active' : ''} aria-pressed={unit === 'km'} onClick={() => setUnit('km')}>{t('settings.stitch_metric_label')}</button>
                  <button type="button" className={unit === 'mile' ? 'is-active' : ''} aria-pressed={unit === 'mile'} onClick={() => setUnit('mile')}>{t('settings.stitch_imperial_label')}</button>
                </div>
              </div>
              <div className="st-v2-row">
                <div className="st-v2-row-copy">
                  <strong>{t('settings.stitch_theme_title')}</strong>
                  <span>{activeThemeLabel}</span>
                </div>
                <div className="st-v2-themes">
                  {themeCards.map((card) => (
                    <button
                      key={card.value}
                      type="button"
                      className={`st-v2-theme is-${card.value}${theme === card.value ? ' is-active' : ''}`}
                      onClick={() => setTheme(card.value)}
                      aria-pressed={theme === card.value}
                      aria-label={card.label}
                      title={card.label}
                    />
                  ))}
                </div>
              </div>
              <div className="st-v2-row">
                <div className="st-v2-row-copy">
                  <strong id="settings-language-label">{t('settings.language_title')}</strong>
                  <span>{t('settings.language_hint')}</span>
                </div>
                <div className="st-v2-segmented" role="group" aria-labelledby="settings-language-label">
                  <button type="button" className={lang === 'en' ? 'is-active' : ''} aria-pressed={lang === 'en'} onClick={() => setLang('en')}>English</button>
                  <button type="button" className={lang === 'zh-CN' ? 'is-active' : ''} aria-pressed={lang === 'zh-CN'} onClick={() => setLang('zh-CN')}>简体中文</button>
                </div>
              </div>
              <SettingsTimeZoneRow t={t} timeZone={timeZone} onSaved={onTimeZoneSaved} />
            </div>
          </section>

          <section id="st-v2-training" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'training'} aria-labelledby="st-v2-tab-training">
            <h2 id="st-v2-training-label" className="st-v2-group-label">{t('settings.training_zones_title')}</h2>
            <SettingsTrainingZones t={t} active={activeSection === 'training'} />
          </section>

          <section id="st-v2-connections" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'connections'} aria-labelledby="st-v2-tab-connections">
            <h2 id="st-v2-connections-label" className="st-v2-group-label">{t('settings.stitch_data_services_title')}</h2>
            <div className="st-v2-card">
              <div className="st-v2-row">
                <div className="st-v2-row-lead">
                  <span className="st-v2-service is-strava" aria-hidden="true"><AppIcon name="altitude" /></span>
                  <div className="st-v2-row-copy">
                    <strong>Strava</strong>
                    <span className="st-v2-status"><i className={stravaConnected ? 'is-on' : ''} />{stravaLabel}</span>
                    {stravaNotice ? <span role="status">{stravaNotice}</span> : null}
                  </div>
                </div>
                <button
                  type="button"
                  className={stravaConnected ? 'st-v2-btn' : 'st-v2-btn is-dark'}
                  onClick={stravaConnected ? requestStravaDisconnect : connectStrava}
                  disabled={stravaLinking}
                >
                  {stravaConnected ? t('settings.strava_disconnect') : (stravaLinking ? t('profile.strava_link_connecting') : t('settings.stitch_connect'))}
                </button>
              </div>
              <div className="st-v2-row">
                <div className="st-v2-row-lead">
                  <span className="st-v2-service is-garmin" aria-hidden="true"><AppIcon name="watch" /></span>
                  <div className="st-v2-row-copy">
                    <strong>{garminLane.title}</strong>
                    <span>{garminLane.summary}</span>
                  </div>
                </div>
                <button type="button" className="st-v2-btn is-dark" onClick={onOpenGarminImport}>{garminLane.primaryAction}</button>
              </div>
              <div className="st-v2-row">
                <div className="st-v2-row-lead">
                  <span className="st-v2-service is-files" aria-hidden="true"><AppIcon name="upload" /></span>
                  <div className="st-v2-row-copy">
                    <strong>{garminLane.manualLabel}</strong>
                    <span>{garminLane.manualValue}</span>
                  </div>
                </div>
                <button type="button" className="st-v2-btn" onClick={() => navigate('/settings/import-data')}>{t('profile.import_data')}</button>
              </div>
              {syncHealthItems.length > 0 && (
                <div className="st-v2-row st-v2-sync">
                  <span className="st-v2-field-label">{t('settings.stitch_sync_health_title')}</span>
                  <ul>
                    {syncHealthItems.map((item) => (
                      <li key={item.key}>
                        <span>{item.label}</span>
                        <strong>{item.value}</strong>
                        <em className={`is-${item.tone}`}>
                          {item.tone === 'live' ? t('settings.stitch_connected_short') : item.tone === 'ready' ? t('settings.stitch_ready_short') : t('settings.stitch_review')}
                        </em>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section id="st-v2-notifications" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'notifications'} aria-labelledby="st-v2-tab-notifications">
            <h2 id="st-v2-notifications-label" className="st-v2-group-label">{t('settings.v2_notifications_title')}</h2>
            <div className="st-v2-card">
              <button
                type="button"
                className="st-v2-row st-v2-toggle-row"
                onClick={toggleDigest}
                role="switch"
                aria-checked={digestEnabled}
              >
                <span className="st-v2-row-copy">
                  <strong>{t('settings.stitch_weekly_brief')}</strong>
                  <span>{t('settings.stitch_weekly_brief_copy')}</span>
                </span>
                <span className={`st-v2-switch${digestEnabled ? ' is-on' : ''}`} aria-hidden="true" />
              </button>
              {wellnessRows.length > 0 && (
                <div className="st-v2-row st-v2-sync">
                  <span className="st-v2-field-label">{t('settings.stitch_wellness_hub_title')}</span>
                  <ul>
                    {wellnessRows.map((row) => (
                      <li key={row.key}>
                        <span>{t(row.labelKey)}</span>
                        <strong>{row.sourceLabel}</strong>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>

          <section id="st-v2-activity" className="st-v2-group st-v2-activity" role="tabpanel" hidden={activeSection !== 'activity'} aria-labelledby="st-v2-tab-activity">
            <h2 id="st-v2-activity-label" className="st-v2-group-label">{t('settings.v2_activity_title')}</h2>
            <RunActivityContributionGraph runs={runActivities} status={runActivityState} lang={lang} t={t} />
          </section>

          <section id="st-v2-account" className="st-v2-group" role="tabpanel" hidden={activeSection !== 'account'} aria-labelledby="st-v2-tab-account">
            <h2 id="st-v2-account-label" className="st-v2-group-label">{t('settings.v2_account_title')}</h2>
            <div className="st-v2-card">
              <button type="button" className="st-v2-row st-v2-logout" onClick={() => { logout(); navigate('/login'); }}>
                <span className="st-v2-row-copy">
                  <strong>{t('settings.logout_btn')}</strong>
                  <span>{t('settings.stitch_danger_copy')}</span>
                </span>
                <AppIcon name="chevron_right" />
              </button>
            </div>
            <SettingsDataCard t={t} onRequestDeleteAccount={onRequestDeleteAccount} />
            <p className="st-v2-meta">{[resolvedUnitLabel, resolvedLanguageLabel, activeThemeLabel].filter(Boolean).join(' · ')}</p>
          </section>
        </div>
      </div>

      <footer className="runner-shell-footer settings-atlas-footer">
        <FooterNavLinks />
        <p>{t('landing.stitch_footer_copy')}</p>
      </footer>
    </div>
  );
}
