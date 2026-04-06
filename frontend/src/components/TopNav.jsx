import { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import { useUnit } from '../contexts/UnitContext';
import HermesLogo from './HermesLogo';

export default function TopNav({ showProfile = false, profile, backLink, rightContent }) {
  const { logout } = useAuth();
  const { t } = useI18n();
  const { unit, setUnit } = useUnit();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const displayName = profile?.displayName?.trim()
    || (profile?.email ? profile.email.split('@')[0].replace(/^./, c => c.toUpperCase()) : '')
    || t('profile.default_name');

  const initials = displayName.slice(0, 1).toUpperCase();
  const menuItems = [
    profile?.onSettings ? {
      key: 'settings',
      label: t('profile.settings') || 'Settings',
      onClick: profile.onSettings,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
        </svg>
      ),
    } : null,
    profile?.onChangeName ? {
      key: 'change-name',
      label: t('profile.change_name') || 'Change Name',
      onClick: profile.onChangeName,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
      ),
    } : null,
    profile?.onImportData ? {
      key: 'import-data',
      label: t('profile.garmin_menu_entry') || t('profile.garmin_connect_import') || 'Garmin Import',
      onClick: profile.onImportData,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7v7" />
          <path d="m9.5 11.5 2.5 2.5 2.5-2.5" />
          <path d="M8 18h8" />
        </svg>
      ),
    } : null,
  ].filter(Boolean);

  return (
    <header className="top-nav">
      {backLink ? (
        <Link to={backLink.to} className="logo logo-link">
          {backLink.label && backLink.label !== 'HERMES' ? backLink.label : <HermesLogo />}
        </Link>
      ) : (
        <Link to="/profile" className="logo logo-link"><HermesLogo /></Link>
      )}

      <div className="top-nav-actions">
        <div className="top-nav-shortcuts">
          <NavLink
            to="/races"
            className={({ isActive }) => `top-nav-shortcut${isActive ? ' active' : ''}`}
          >
            {t('races.nav_label')}
          </NavLink>
          <NavLink
            to="/muscle-training"
            className={({ isActive }) => `top-nav-shortcut${isActive ? ' active' : ''}`}
          >
            {t('muscle_training.nav_label')}
          </NavLink>
          <div className="unit-toggle">
            <button type="button" className={unit === 'km' ? 'active' : ''} onClick={() => setUnit('km')}>km</button>
            <button type="button" className={unit === 'mile' ? 'active' : ''} onClick={() => setUnit('mile')}>mi</button>
          </div>
        </div>

        {showProfile && (
          <div className="user-menu-shell" ref={menuRef}>
            <button
              type="button"
              className="user-menu-trigger"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(prev => !prev)}
            >
              <div className="user-menu-avatar">{initials}</div>
              <span className="user-menu-name">{displayName}</span>
              <svg className={`user-menu-chevron${menuOpen ? ' open' : ''}`} width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            <div className={`user-menu-dropdown${menuOpen ? ' visible' : ''}`}>
              <div className="user-menu-header">
                <span className="user-menu-header-name">{displayName}</span>
                <span className="user-menu-header-email">{profile?.email || ''}</span>
              </div>
              {menuItems.length > 0 && <div className="user-menu-divider" />}
              {menuItems.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="user-menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    item.onClick();
                  }}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
              <div className="user-menu-divider" />
              <button type="button" className="user-menu-item user-menu-item-logout" onClick={() => { setMenuOpen(false); logout(); }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                {t('profile.logout')}
              </button>
            </div>
          </div>
        )}

        {rightContent}
      </div>
    </header>
  );
}
