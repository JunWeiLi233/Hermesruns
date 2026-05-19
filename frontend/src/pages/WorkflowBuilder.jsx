import { Component, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import useWorkflowStore from '../stores/useWorkflowStore';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';

class WorkflowCanvasBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error) {
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }

    return this.props.children;
  }
}

export default function WorkflowBuilder() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isCanvasLoading, setIsCanvasLoading] = useState(true);
  const [canvasError, setCanvasError] = useState(null);
  const [canvasInstanceKey, setCanvasInstanceKey] = useState(0);
  const nodes = useWorkflowStore((s) => s.nodes);
  const addNode = useWorkflowStore((s) => s.addNode);

  const displayName = user?.displayName || user?.email || '';
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const isCanvasEmpty = !isCanvasLoading && !canvasError && nodes.length === 0;
  const navItems = useMemo(() => getRunnerShellNavItems({
    t,
    lang,
    activeKey: 'workflows',
  }), [lang, t]);

  useEffect(() => {
    setIsCanvasLoading(true);
    const frameId = window.requestAnimationFrame(() => {
      setIsCanvasLoading(false);
    });

    return () => window.cancelAnimationFrame(frameId);
  }, [canvasInstanceKey]);

  const handleCanvasRetry = () => {
    setCanvasError(null);
    setCanvasInstanceKey((key) => key + 1);
  };

  const handleEmptyCta = () => {
    addNode('input', { x: 120, y: 120 });
  };

  const renderCanvasError = () => (
    <div className="workflow-builder-state workflow-builder-state--error" role="alert">
      <span className="workflow-builder-state-kicker">{t('workflow_builder.error_kicker')}</span>
      <h2>{t('workflow_builder.error_title')}</h2>
      <p>{t('workflow_builder.error_copy')}</p>
      {canvasError?.message ? (
        <p className="workflow-builder-state-detail">{canvasError.message}</p>
      ) : null}
      <button type="button" className="workflow-builder-state-cta" onClick={handleCanvasRetry}>
        {t('workflow_builder.retry')}
      </button>
    </div>
  );

  return (
    <div className={`runner-shell-page workflow-builder-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((c) => !c)}
            aria-label={t(isSidebarCollapsed ? 'profile.sidebar_expand' : 'profile.sidebar_collapse')}
            aria-pressed={isSidebarCollapsed}
          >
            <span className="runner-dashboard-toggle-glyph" aria-hidden="true">{isSidebarCollapsed ? '>' : '<'}</span>
          </button>
        </div>

        <nav className="runner-shell-side-nav">
          {navItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`runner-shell-side-link${item.active ? ' is-active' : ''}`}
              onClick={() => navigate(item.route)}
            >
              <AppIcon name={item.icon} className="runner-dashboard-side-link-icon" />
              <span className="runner-dashboard-side-link-label">{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="runner-shell-sidebar-footer">
          <button
            type="button"
            className="runner-shell-workout-btn runner-dashboard-workout-btn"
            onClick={() => navigate('/today-run')}
            aria-label={t('profile.dashboard_start_workout')}
          >
            <span className="runner-dashboard-workout-glyph" aria-hidden="true">&gt;</span>
            <span className="runner-dashboard-workout-btn-label">{t('profile.dashboard_start_workout')}</span>
          </button>
        </div>
      </aside>

      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('profile.dashboard_nav_workflows')}
              navigate={navigate}
            />
          </div>

          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions analysis-stitch-topbar-profile-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button type="button" className="runner-shell-icon-btn" onClick={() => navigate('/settings')} aria-label={t('analysis.stitch_open_settings')}>
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button type="button" className="runner-shell-avatar" aria-label={displayName} onClick={() => navigate('/profile')}>
                {initials}
              </button>
            </div>
          </div>
        </header>

        <div className="runner-shell-canvas workflow-builder-canvas">
          {isCanvasLoading ? (
            <div className="workflow-builder-state workflow-builder-state--loading" role="status" aria-live="polite">
              <span className="workflow-builder-state-spinner" aria-hidden="true" />
              <span className="workflow-builder-state-kicker">{t('workflow_builder.loading_kicker')}</span>
              <h2>{t('workflow_builder.loading_title')}</h2>
              <p>{t('workflow_builder.loading_copy')}</p>
            </div>
          ) : null}
          <WorkflowCanvasBoundary
            key={canvasInstanceKey}
            onError={setCanvasError}
            fallback={renderCanvasError()}
          >
            {!isCanvasLoading ? <WorkflowCanvas /> : null}
          </WorkflowCanvasBoundary>
          {isCanvasEmpty ? (
            <div className="workflow-builder-empty" aria-live="polite">
              <span className="workflow-builder-state-kicker">{t('workflow_builder.empty_kicker')}</span>
              <h2>{t('workflow_builder.empty_title')}</h2>
              <p>{t('workflow_builder.empty_copy')}</p>
              <button type="button" className="workflow-builder-state-cta" onClick={handleEmptyCta}>
                {t('workflow_builder.empty_cta')}
              </button>
            </div>
          ) : null}
        </div>

        <FooterNavLinks />
      </main>
    </div>
  );
}
