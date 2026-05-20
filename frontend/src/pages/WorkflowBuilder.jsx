import { Component, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useI18n } from '../contexts/I18nContext';
import AppIcon from '../components/AppIcon';
import FooterNavLinks from '../components/FooterNavLinks';
import HermesLogo from '../components/HermesLogo';
import NodePalette from '../components/workflow/NodePalette';
import RunnerShellTopNav from '../components/RunnerShellTopNav';
import TopbarNotifications from '../components/TopbarNotifications';
import WorkflowCanvas from '../components/workflow/WorkflowCanvas';
import useWorkflowStore from '../stores/useWorkflowStore';
import { getRunnerShellNavItems } from '../utils/runnerShellNav';
import { WORKFLOW_TEMPLATES } from '../utils/workflowTemplates';

// ─── Error boundary ──────────────────────────────────────────────────────────

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

// ─── Template icon map ───────────────────────────────────────────────────────

const TEMPLATE_ICONS = {
  'tpl-vdot': 'speed',
  'tpl-race-brief': 'flag',
  'tpl-recovery': 'healing',
};

// ─── WorkflowHero ─────────────────────────────────────────────────────────────

function WorkflowHero({ t, templateCount }) {
  return (
    <div className="wf-hero">
      <div>
        <span className="wf-kicker">{t('workflow_builder.hero_kicker')}</span>
        <h1 className="wf-hero-title">{t('workflow_builder.hero_title')}</h1>
        <p className="wf-hero-copy">{t('workflow_builder.hero_copy')}</p>
      </div>
      <div className="wf-chip-group" role="list" aria-label={t('workflow_builder.hero_metrics_aria')}>
        <span className="wf-chip" role="listitem">
          <span className="material-symbols-outlined" aria-hidden="true">auto_awesome</span>
          {t('workflow_builder.hero_stat_examples', { count: templateCount })}
        </span>
        <span className="wf-chip" role="listitem">
          <span className="material-symbols-outlined" aria-hidden="true">drag_indicator</span>
          {t('workflow_builder.hero_stat_palette')}
        </span>
        <span className="wf-chip" role="listitem">
          <span className="material-symbols-outlined" aria-hidden="true">save</span>
          {t('workflow_builder.hero_stat_autosave')}
        </span>
      </div>
    </div>
  );
}

// ─── CanvasStatusCard ─────────────────────────────────────────────────────────

function CanvasStatusCard({ t, executionStatus, statusCopy, onStartBlank }) {
  const dotClass = executionStatus === 'running'
    ? 'wf-status-dot wf-status-dot--running'
    : executionStatus === 'error'
      ? 'wf-status-dot wf-status-dot--error'
      : 'wf-status-dot wf-status-dot--idle';

  return (
    <div className="wf-canvas-card">
      <div>
        <span className="wf-kicker">{t('workflow_builder.workspace_kicker')}</span>
        <h2 className="wf-card-title">{t('workflow_builder.workspace_title')}</h2>
        <div className="wf-canvas-card-status">
          <span className={dotClass} aria-hidden="true" />
          <span>{statusCopy}</span>
        </div>
      </div>

      {/* mock canvas preview */}
      <div className="wf-mock-canvas" aria-hidden="true">
        <div className="wf-mock-node wf-mock-node--input">{t('workflow_builder.input_node_type')}</div>
        <div className="wf-mock-edge" />
        <div className="wf-mock-node wf-mock-node--agent">{t('workflow_builder.agent_node_type')}</div>
        <div className="wf-mock-edge" />
        <div className="wf-mock-node wf-mock-node--output">{t('workflow_builder.output_node_type')}</div>
      </div>

      <button type="button" className="wf-start-blank-btn" onClick={onStartBlank}>
        {t('workflow_builder.workspace_blank_cta')}
      </button>
    </div>
  );
}

// ─── HowItWorks ───────────────────────────────────────────────────────────────

function HowItWorks({ t }) {
  const steps = [
    { title: t('workflow_builder.step_one_title'), copy: t('workflow_builder.step_one_copy') },
    { title: t('workflow_builder.step_two_title'), copy: t('workflow_builder.step_two_copy') },
    { title: t('workflow_builder.step_three_title'), copy: t('workflow_builder.step_three_copy') },
  ];

  return (
    <div className="wf-steps-card">
      <span className="wf-kicker">{t('workflow_builder.instructions_kicker')}</span>
      <h2 className="wf-card-title">{t('workflow_builder.instructions_title')}</h2>
      <ol className="wf-step-list" aria-label={t('workflow_builder.instructions_title')}>
        {steps.map((step, i) => (
          <li key={step.title} className="wf-step-item">
            <span className="wf-step-num" aria-hidden="true">0{i + 1}</span>
            <div className="wf-step-text">
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── StarterTemplates ─────────────────────────────────────────────────────────

function StarterTemplates({ t, templates, activeTemplateId, onLoad }) {
  return (
    <div className="wf-templates-card">
      <span className="wf-kicker">{t('workflow_builder.examples_kicker')}</span>
      <h2 className="wf-card-title">{t('workflow_builder.examples_title')}</h2>
      <div className="wf-template-list" role="list" aria-label={t('workflow_builder.examples_aria')}>
        {templates.map((tpl) => {
          const isLoaded = activeTemplateId === tpl.id;
          const iconName = TEMPLATE_ICONS[tpl.id] || 'auto_awesome';
          return (
            <article
              key={tpl.id}
              className={`wf-template-item${isLoaded ? ' is-loaded' : ''}`}
              role="listitem"
              data-template-id={tpl.id}
            >
              <span
                className="wf-template-accent"
                style={{ '--wf-tpl-accent': tpl.accent }}
                aria-hidden="true"
              />
              <div className="wf-template-icon" aria-hidden="true">
                <span className="material-symbols-outlined">{iconName}</span>
              </div>
              <div className="wf-template-copy">
                <h3>{tpl.title}</h3>
                <p>{tpl.description}</p>
              </div>
              <button
                type="button"
                className={`wf-template-btn${isLoaded ? ' is-loaded' : ''}`}
                onClick={() => onLoad(tpl.id)}
                aria-pressed={isLoaded}
              >
                {isLoaded ? t('workflow_builder.example_loaded') : t('workflow_builder.example_cta')}
              </button>
            </article>
          );
        })}
      </div>
    </div>
  );
}

// ─── CanvasWorkspace ──────────────────────────────────────────────────────────

function CanvasWorkspace({
  t,
  statusCopy,
  executionStatus,
  isCanvasLoading,
  isCanvasEmpty,
  canvasError,
  canvasInstanceKey,
  onError,
  onStartBlank,
  onRun,
  onClear,
  addNode,
  onDragStart,
}) {
  const isRunning = executionStatus === 'running';

  const dotClass = executionStatus === 'running'
    ? 'wf-status-dot wf-status-dot--running'
    : executionStatus === 'error'
      ? 'wf-status-dot wf-status-dot--error'
      : 'wf-status-dot wf-status-dot--idle';

  const renderCanvasError = () => (
    <div className="workflow-builder-state workflow-builder-state--error" role="alert">
      <span className="workflow-builder-state-kicker">{t('workflow_builder.error_kicker')}</span>
      <h2>{t('workflow_builder.error_title')}</h2>
      <p>{t('workflow_builder.error_copy')}</p>
      {canvasError?.message ? (
        <p className="workflow-builder-state-detail">{canvasError.message}</p>
      ) : null}
    </div>
  );

  return (
    <section className="wf-workspace" aria-label={t('workflow_builder.canvas_label')}>
      {/* head: title + status + action buttons */}
      <div className="wf-workspace-head">
        <div className="wf-workspace-copy">
          <span className="wf-kicker">{t('workflow_builder.workspace_kicker')}</span>
          <h2>{t('workflow_builder.workspace_title')}</h2>
          <div className="wf-workspace-status">
            <span className={dotClass} aria-hidden="true" />
            <span>{statusCopy}</span>
          </div>
        </div>
        <div className="wf-workspace-actions">
          <button
            type="button"
            className="wf-action-run"
            onClick={onRun}
            disabled={isRunning}
            aria-label={t('workflow_builder.workspace_run')}
            aria-busy={isRunning}
          >
            <AppIcon name={isRunning ? 'sync' : 'play_arrow'} aria-hidden="true" />
            {t('workflow_builder.workspace_run')}
          </button>
          <button
            type="button"
            className="wf-action-clear"
            onClick={onClear}
            aria-label={t('workflow_builder.workspace_clear')}
          >
            <AppIcon name="delete_sweep" aria-hidden="true" />
            {t('workflow_builder.workspace_clear')}
          </button>
        </div>
      </div>

      {/* body: canvas + palette side-by-side */}
      <div className="wf-workspace-body">
        <div className="wf-workspace-canvas">
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
            onError={onError}
            fallback={renderCanvasError()}
          >
            {!isCanvasLoading ? <WorkflowCanvas /> : null}
          </WorkflowCanvasBoundary>

          {isCanvasEmpty ? (
            <div className="wf-workspace-empty" aria-live="polite">
              <span className="wf-workspace-empty-kicker">{t('workflow_builder.empty_kicker')}</span>
              <h2>{t('workflow_builder.empty_title')}</h2>
              <p>{t('workflow_builder.empty_copy')}</p>
              <button type="button" className="wf-start-blank-btn" onClick={onStartBlank}>
                {t('workflow_builder.empty_cta')}
              </button>
            </div>
          ) : null}
        </div>

        {/* real NodePalette in palette-mock wrapper */}
        <div className="wf-palette-mock">
          <NodePalette
            executionStatus={executionStatus}
            onAddNode={addNode}
            onDragStart={onDragStart}
            onExecute={onRun}
            onClear={onClear}
          />
        </div>
      </div>
    </section>
  );
}

// ─── WorkflowBuilder page ─────────────────────────────────────────────────────

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
  const loadTemplate = useWorkflowStore((s) => s.loadTemplate);
  const clearCanvas = useWorkflowStore((s) => s.clearCanvas);
  const runWorkflow = useWorkflowStore((s) => s.runWorkflow);
  const activeTemplateId = useWorkflowStore((s) => s.activeTemplateId);
  const executionStatus = useWorkflowStore((s) => s.executionStatus);
  const executionMessage = useWorkflowStore((s) => s.executionMessage);

  const displayName = user?.displayName || user?.email || '';
  const initials = displayName.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  const isCanvasEmpty = !isCanvasLoading && !canvasError && nodes.length === 0;

  const navItems = useMemo(() => getRunnerShellNavItems({ t, lang, activeKey: 'workflows' }), [lang, t]);

  const starterWorkflows = useMemo(() => WORKFLOW_TEMPLATES.map((tpl) => ({
    id: tpl.id,
    accent: tpl.accent,
    title: t(`workflow_builder.templates.${tpl.id}.title`),
    description: t(`workflow_builder.templates.${tpl.id}.description`),
  })), [t]);

  const activeTemplate = useMemo(
    () => starterWorkflows.find((tpl) => tpl.id === activeTemplateId) || null,
    [activeTemplateId, starterWorkflows],
  );

  // derived status copy
  const workspaceStatusCopy = canvasError?.message
    || (executionStatus === 'running'
      ? t('workflow_builder.status_running')
      : executionStatus === 'success'
        ? t('workflow_builder.status_success')
        : executionStatus === 'error'
          ? executionMessage || t('workflow_builder.status_error')
          : activeTemplate
            ? t('workflow_builder.status_template_loaded')
            : t('workflow_builder.status_idle'));

  // canvas mount delay
  useEffect(() => {
    setIsCanvasLoading(true);
    const frameId = window.requestAnimationFrame(() => setIsCanvasLoading(false));
    return () => window.cancelAnimationFrame(frameId);
  }, [canvasInstanceKey]);

  const handleStartBlank = () => {
    addNode('input', { x: 120, y: 120 });
  };

  const handleTemplateLoad = (templateId) => {
    const loaded = loadTemplate(templateId);
    if (!loaded) return;
    setCanvasError(null);
    setCanvasInstanceKey((k) => k + 1);
  };

  const handleRun = () => runWorkflow();

  const handleClear = () => {
    clearCanvas();
    setCanvasError(null);
    setCanvasInstanceKey((k) => k + 1);
  };

  const handleCanvasError = (err) => setCanvasError(err);

  const handleDragStart = (_event, _type) => { /* drag data already set in NodePalette */ };

  return (
    <div className={`runner-shell-page workflow-builder-page runner-dashboard-page${isSidebarCollapsed ? ' is-sidebar-collapsed' : ''}`}>
      {/* ── sidebar ── */}
      <aside className="runner-shell-sidebar">
        <div className="runner-shell-brand runner-dashboard-brand">
          <div className="runner-dashboard-brand-copy">
            <HermesLogo dark />
            <span>{t('analysis.stitch_brand_subtitle')}</span>
          </div>
          <button
            type="button"
            className="runner-dashboard-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((v) => !v)}
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

      {/* ── main ── */}
      <main className="runner-shell-main">
        <header className="runner-shell-topbar runner-dashboard-shell-topbar workflow-builder-topbar">
          <div className="runner-shell-topbar-left">
            <RunnerShellTopNav
              navItems={navItems}
              activeLabel={t('profile.dashboard_nav_workflows')}
              navigate={navigate}
            >
              <span className="workflow-builder-topnav-pill">{t('workflow_builder.hero_kicker')}</span>
            </RunnerShellTopNav>
          </div>
          <div className="runner-shell-topbar-actions">
            <div className="runner-shell-topbar-profile-actions workflow-builder-topbar-actions">
              <TopbarNotifications onOpenRuns={() => navigate('/runs')} />
              <button
                type="button"
                className="runner-shell-icon-btn"
                onClick={() => navigate('/settings')}
                aria-label={t('analysis.stitch_open_settings')}
              >
                <AppIcon name="settings" className="runner-dashboard-side-link-icon" />
              </button>
              <button
                type="button"
                className="runner-shell-avatar"
                aria-label={displayName}
                onClick={() => navigate('/profile')}
              >
                {initials}
              </button>
            </div>
          </div>
        </header>

        {/* ── inner content: three kinetic sections ── */}
        <div className="runner-shell-canvas workflow-builder-shell-canvas">

          {/* Section 1: hero-grid — hero copy + canvas status card */}
          <div className="wf-hero-grid">
            <WorkflowHero t={t} templateCount={starterWorkflows.length} />
            <CanvasStatusCard
              t={t}
              executionStatus={executionStatus}
              statusCopy={workspaceStatusCopy}
              onStartBlank={handleStartBlank}
            />
          </div>

          {/* Section 2: info-grid — how-it-works steps + starter templates */}
          <div className="wf-info-grid">
            <HowItWorks t={t} />
            <StarterTemplates
              t={t}
              templates={starterWorkflows}
              activeTemplateId={activeTemplateId}
              onLoad={handleTemplateLoad}
            />
          </div>

          {/* Section 3: full-width workspace with real canvas + NodePalette */}
          <CanvasWorkspace
            t={t}
            statusCopy={workspaceStatusCopy}
            executionStatus={executionStatus}
            isCanvasLoading={isCanvasLoading}
            isCanvasEmpty={isCanvasEmpty}
            canvasError={canvasError}
            canvasInstanceKey={canvasInstanceKey}
            onError={handleCanvasError}
            onStartBlank={handleStartBlank}
            onRun={handleRun}
            onClear={handleClear}
            addNode={addNode}
            onDragStart={handleDragStart}
          />

          <footer className="runner-shell-footer runner-dashboard-footer">
            <FooterNavLinks />
          </footer>
        </div>
      </main>
    </div>
  );
}
