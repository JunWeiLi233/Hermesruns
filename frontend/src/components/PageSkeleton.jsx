import { useMemo } from 'react';
import { useI18n } from '../contexts/I18nContext';
import { createLoadingDesign } from './loading/LoadingDesign';
import LoadingStatus, { useLoadingStatus } from './loading/LoadingStatus';
import useLoadingViewport from './loading/useLoadingViewport';
import './loading/loading-design.css';

function resolveState(variant, activeTab, pathname, search) {
  if (variant === 'analysis-insight') {
    const leaf = pathname.replace(/\/+$/, '').split('/').pop();
    return { 'load-balance': 'analysis-load', intensity: 'analysis-intensity', 'injury-risk': 'analysis-injury', 'coach-insight': 'analysis-coach' }[leaf] || 'analysis-insight';
  }
  if (variant === 'settings') {
    const section = new URLSearchParams(search).get('section');
    return `settings-${['profile', 'preferences', 'training', 'connections', 'notifications', 'activity', 'account'].includes(section) ? section : 'profile'}`;
  }
  if (variant === 'admin') return `admin-${['overview', 'users', 'courseMaps', 'shoes', 'jobs', 'audit', 'settings'].includes(activeTab) ? activeTab : 'overview'}`;
  if (variant === 'legal') return pathname.replace(/\/+$/, '') === '/privacy' ? 'privacy' : 'terms';
  return { auth: 'login', runner: 'runner-fallback', garmin: 'legacy-garmin', 'admin-login': 'legacy-admin-login' }[variant] || variant;
}

export default function PageSkeleton({ variant = 'runner', activeTab = 'overview', pathname = typeof window === 'undefined' ? '' : window.location.pathname, search = typeof window === 'undefined' ? '' : window.location.search }) {
  const { t } = useI18n();
  const mobile = useLoadingViewport();
  const design = useMemo(() => createLoadingDesign({ mobile, t }), [mobile, t]);
  const requested = resolveState(variant, activeTab, pathname, search);
  const state = design.states.find(item => item.id === requested && item.kind === 'page') || design.states.find(item => item.id === 'runner-fallback');
  const status = useLoadingStatus(state.what);
  return <div className={`loading-design loading-design--page loading-design--${state.shell}`} data-loading-state={state.id}>
    <div aria-busy="true">{design.renderPage(state.id)}</div>
    <LoadingStatus {...status} />
  </div>;
}
