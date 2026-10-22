import { lazy, Suspense, useEffect, useId, useState } from 'react';
import { useSearchParams } from 'react-router';
import Modal from '../../../components/Modal';
import ModalLoadingSkeleton from '../../../components/ModalLoadingSkeleton';
import AppIcon from '../../../components/AppIcon';
import { useI18n } from '../../../contexts/I18nContext';
import { apiJson } from '../../../api';
import { useWorkspace } from '../ui/workspace';
import TrainingDataProvider from './TrainingDataProvider';
import './AthleteTools.css';
import '../screens/comparison.css';
import '../screens/periods.css';
import '../screens/sport-totals.css';

const Compare = lazy(() => import('../screens/S12'));
const Totals = lazy(() => import('../screens/S14'));
const Periods = lazy(() => import('../screens/S15'));
const Fitness = lazy(() => import('../screens/S13'));
const Wellness = lazy(() => import('../screens/S16'));
const Chat = lazy(() => import('../screens/S23'));
const ManualRun = lazy(() => import('../../../pages/training-plan/TrainingPlan').then(module => ({ default: module.RunPlanManualRunEntry })));

function useToolQuery() {
  const [params, setParams] = useSearchParams();
  const change = (updates) => setParams(previous => {
    const next = new URLSearchParams(previous);
    Object.entries(updates).forEach(([key, value]) => value == null ? next.delete(key) : next.set(key, value));
    return next;
  });
  return [params, change];
}

function ToolModal({ open, title, onClose, children, workspace = true }) {
  const { t } = useI18n();
  const comparing = title === 'session_comparisons';
  const totals = title === 'sport_totals';
  const periods = title === 'period_comparison';
  const loadingVariant = { manual_run: 'manual-run', session_comparisons: 'session-comparison', sport_totals: 'sport-totals', period_comparison: 'period-comparison', recovery_journal: 'recovery-journal', fitnessModel: 'fitness-model', session_conversation: 'session-conversation' }[title];
  const fallback = <ModalLoadingSkeleton variant={loadingVariant} />;
  const subtitle = comparing ? 'compare.subtitle' : periods ? 'periods.subtitle' : null;
  return <Modal isOpen={open} onClose={onClose} title={subtitle ? <><span>{t(`training_integration.${title}`)}</span><small>{t(`training_integration.${subtitle}`)}</small></> : t(`training_integration.${title}`)} closeLabel={t('profile.close')} shellClassName={comparing ? 'comparison-modal-shell' : totals ? 'sport-totals-modal-shell' : periods ? 'periods-modal-shell' : ''} cardClassName={`athlete-tools-modal${comparing ? ' comparison-modal' : ''}${totals ? ' sport-totals-modal' : ''}${periods ? ' periods-modal' : ''}`} portalToBody>
    <div className="athlete-tools-content">
      <Suspense fallback={fallback}>
        {workspace ? <TrainingDataProvider loadingFallback={fallback}><TrainingFrame>{children}</TrainingFrame></TrainingDataProvider> : children}
      </Suspense>
    </div>
  </Modal>;
}

function TrainingFrame({ children }) {
  const { theme } = useWorkspace();
  return <div className="icu-design training-app hermes-training-integrated" data-theme={theme || 'light'}>{children}</div>;
}

function ToolButton({ name, onClick, icon }) {
  const { t } = useI18n();
  return <button type="button" className="runner-shell-inline-btn" onClick={onClick}>{icon ? <AppIcon name={icon} aria-hidden="true" /> : null}{t(`training_integration.${name}`)}</button>;
}

export function RunsTrainingTools({ onSaved }) {
  const [params, change] = useToolQuery();
  const manual = params.get('manual') === '1';
  const compare = params.get('view') === 'compare';
  const close = () => change({ manual: null, ...(compare ? { view: null } : {}) });
  return <div className="athlete-tools-actions">
    <ToolButton name="manual_run" onClick={() => change({ manual: '1', view: null })} />
    <ToolButton name="session_comparisons" onClick={() => change({ view: 'compare', manual: null })} />
    <ToolModal open={manual || compare} title={manual ? 'manual_run' : 'session_comparisons'} onClose={close} workspace={!manual}>
      {manual ? <ManualRun onDone={() => { close(); onSaved?.(); }} /> : <Compare />}
    </ToolModal>
  </div>;
}

export function AnalysisTrainingTools() {
  const [params, change] = useToolQuery();
  const view = params.get('view');
  const open = view === 'totals' || view === 'compare';
  return <div className="athlete-tools-actions">
    <ToolButton name="sport_totals" icon="bar_chart" onClick={() => change({ view: 'totals' })} />
    <ToolButton name="period_comparison" icon="view_week" onClick={() => change({ view: 'compare' })} />
    <ToolModal open={open} title={view === 'totals' ? 'sport_totals' : 'period_comparison'} onClose={() => change({ view: null })}>
      {view === 'totals' ? <Totals embedded /> : <Periods />}
    </ToolModal>
  </div>;
}

export function RecoveryJournalTool() {
  const [params, change] = useToolQuery();
  return <div className="athlete-tools-actions">
    <ToolButton name="recovery_journal" onClick={() => change({ journal: '1' })} />
    <ToolModal open={params.get('journal') === '1'} title="recovery_journal" onClose={() => change({ journal: null })}><Wellness /></ToolModal>
  </div>;
}

export function FitnessModelTool() {
  const [params,change]=useToolQuery();
  return <div className="athlete-tools-actions"><ToolButton name="fitnessModel" onClick={()=>change({fitness:'1'})}/>
    <ToolModal open={params.get('fitness')==='1'} title="fitnessModel" onClose={()=>change({fitness:null})}><Fitness/></ToolModal>
  </div>;
}

function ResolvedSessionConversation({ canonicalId }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let active = true;
    apiJson(`/api/training/activities/by-canonical/${encodeURIComponent(canonicalId)}`)
      .then(activity => { if (active) setResult({ activity }); })
      .catch(error => { if (active) setResult({ error }); });
    return () => { active = false; };
  }, [canonicalId]);
  if (result?.error) return <p role="alert">{result.error.message}</p>;
  if (!result?.activity?.id) return <ModalLoadingSkeleton variant="session-conversation" />;
  return <Chat activityId={result.activity.id} />;
}

export function SessionConversationTool({ canonicalId }) {
  const [params, change] = useToolQuery();
  return <>
    <ToolButton name="session_conversation" onClick={() => change({ conversation: '1' })} />
    <ToolModal open={!!params.get('conversation')} title="session_conversation" onClose={() => change({ conversation: null })}>
      <ResolvedSessionConversation key={canonicalId} canonicalId={canonicalId} />
    </ToolModal>
  </>;
}

function ImportStatusForm() {
  const { api } = useWorkspace();
  const { t } = useI18n();
  const inputId = useId();
  const [jobId, setJobId] = useState('');
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  return <form className="athlete-tools-job" onSubmit={async event => {
    event.preventDefault();
    if (!jobId.trim() || busy) return;
    setBusy(true); setResult(null);
    try { setResult({ job: await api.getJob({ jobId: jobId.trim() }) }); }
    catch (error) { setResult({ error }); }
    finally { setBusy(false); }
  }}>
    <label htmlFor={inputId}>{t('training_integration.job_id')}</label>
    <input id={inputId} value={jobId} onChange={event => { setJobId(event.target.value); setResult(null); }} required />
    <button type="submit" className="runner-shell-inline-btn" disabled={!jobId.trim() || busy}>{t('training_integration.check_status')}</button>
    {result?.error && <p role="alert">{result.error.message}</p>}
    {result?.job && <p role="status">{t('training_integration.import_status')}: {result.job.state}{result.job.errorCode ? ` · ${result.job.errorCode}` : ''}</p>}
  </form>;
}

export function QueuedImportStatus() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return <details className="athlete-tools-import" open={open} onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>{t('training_integration.check_import')}</summary>
    {open && <TrainingDataProvider><ImportStatusForm /></TrainingDataProvider>}
  </details>;
}
