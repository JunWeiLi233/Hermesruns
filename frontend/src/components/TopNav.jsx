import { useState, useRef, useEffect } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';

export default function TopNav({ showProfile = false, profile, backLink, rightContent }) {
  const { logout } = useAuth();
  const { t } = useI18n();
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

  const displayEmail = profile?.email || '';

  return (
    <header className="top-nav">
      {backLink ? (
        <Link to={backLink.to} className="logo logo-link">{backLink.label || 'HERMES'}</Link>
      ) : (
        <Link to="/profile" className="logo logo-link">HERMES</Link>
      )}

      <div className="top-nav-actions">
        <div className="top-nav-shortcuts">
          <NavLink
            to="/races"
            className={({ isActive }) => `top-nav-shortcut${isActive ? ' active' : ''}`}
          >
            {t('races.nav_label')}
          </NavLink>
        </div>

        {showProfile && (
          <>
            <div className="user-profile">
              <div className="runner-identity">
                <span className="user-name">{displayName}</span>
                <span className="user-email">{displayEmail}</span>
              </div>
              <div className="avatar">&#127939;</div>
            </div>

            <div className="runner-menu-shell" ref={menuRef}>
              <button
                className="btn-runner-menu"
                type="button"
                aria-expanded={menuOpen}
                onClick={() => setMenuOpen(prev => !prev)}
              >
                {t('profile.runner_menu') || 'Runner Menu'}
              </button>
              <div className={`runner-menu${menuOpen ? '' : ' hidden'}`}>
                <button
                  type="button"
                  className="runner-menu-item"
                  data-runner-action="settings"
                  onClick={() => { setMenuOpen(false); profile?.onSettings?.(); }}
                >
                  {t('profile.settings') || 'Settings'}
                </button>
                <button
                  type="button"
                  className="runner-menu-item"
                  data-runner-action="change-name"
                  onClick={() => { setMenuOpen(false); profile?.onChangeName?.(); }}
                >
                  {t('profile.change_name') || 'Change Name'}
                </button>
                <button
                  type="button"
                  className="runner-menu-item"
                  data-runner-action="import-data"
                  onClick={() => { setMenuOpen(false); profile?.onImportData?.(); }}
                >
                  {t('profile.import_data') || 'Import Data'}
                </button>
              </div>
            </div>
          </>
        )}

        {rightContent}

        {showProfile && (
          <button className="btn-logout" onClick={logout}>
            {t('profile.logout')}
          </button>
        )}
      </div>
    </header>
  );
}
