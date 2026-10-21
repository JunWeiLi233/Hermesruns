import { useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useUnit } from '../../contexts/UnitContext';
import { Badge, Button, ChoiceGroup, Dialog, Empty, Field, Notice, Panel, Select, Skeleton, Stats, StepList, Weekdays, WorkoutRow } from './primitives';
import { addDays, defaultInputs, localDate, mondayOf, planCommand, planRequest } from './planApi';
import { discardPendingRun, pendingRun, queueManualRun, savePendingRun, MANUAL_RUN_CHANGED } from './manualOutbox';
import { readSetupEdit, saveSetupEdit, clearSetupEdit } from './setupEdits';
import SessionCapsEditor from './SessionCapsEditor';
import { planRead, preparePlanOfflineShell, usePlanCacheStatus } from '../../utils/trainingPlanCache';
import './training-plan.css';
import { useVersionedPlan } from './VersionedPlanRoute';

const base = '/api/run-plans';
const path = (id, tail = '') => `${base}/${id}${tail}`;
export const planSetupUrl = (id, versionId) => `/schedule?planView=setup${id ? `&planId=${encodeURIComponent(id)}` : ''}${versionId ? `&versionId=${encodeURIComponent(versionId)}` : ''}`;
export const planWorkoutUrl = (id, workoutId) => `/today-run?planId=${encodeURIComponent(id)}&workoutId=${encodeURIComponent(workoutId)}`;
const page = (id, tail = '') => tail.startsWith('/preview/') ? `/schedule?planView=preview&planId=${encodeURIComponent(id)}&versionId=${encodeURIComponent(tail.slice(9))}` : tail.startsWith('/workouts/') ? planWorkoutUrl(id,tail.slice(10)) : '/schedule';
function useCopy() { const { t, lang } = useI18n(); return { s: (key, vars) => t(`training_plan.${key}`, vars), lang }; }
function useRemote(url) {
  const {token}=useAuth();
  const [state, setState] = useState({ loading: true, data: null, error: null });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if(!url){setState({url,loading:false,data:null,error:null});return;}
    const control = new AbortController();
    planRead(url,token,()=>planRequest(url, { signal: control.signal })).then(data => { if (!control.signal.aborted) setState({ url, loading: false, data, error: null }); })
      .catch(error => { if (!control.signal.aborted) setState({ url, loading: false, data: null, error }); });
    return () => control.abort();
  }, [url, attempt,token]);
  useEffect(()=>{const refresh=()=>setAttempt(n=>n+1);window.addEventListener('hermes-plan-changed',refresh);return()=>window.removeEventListener('hermes-plan-changed',refresh);},[]);
  return { ...state, loading: state.loading || state.url !== url, data: state.url === url ? state.data : null, reload: () => { setState({ loading: true, data: null, error: null }); setAttempt(x => x + 1); } };
}
function errorCopy(error, s) {
  if (error?.status === 401) return s('authError');
  if (error?.status === 403 || error?.status === 404) return s('notFound');
  if (error?.status === 410) return s('deleted');
  if (error?.status === 429) return s('limited');
  if (error?.code === 'RULES_REVIEW_REQUIRED') return s('reviewGate');
  if (error?.code === 'EXPERIMENTAL_ACKNOWLEDGEMENT_REQUIRED') return s('experimentalAck');
  if (error?.code === 'EXTERNAL_PLAN') return s('externalPlan');
  if (error?.status === 409) return s('conflict');
  const codes = { PACE_LIMIT:'paceLimit', PACE_EVIDENCE_CHANGED:'paceEvidenceChanged', PACE_NO_UPDATE:'paceNoUpdate', OFFLINE_READ_ONLY:'offlineNoSnapshot', OFFLINE_NOT_CACHED:'offlineMissing', SESSION_CAPS_INVALID: 'capsInvalid', SESSION_CAPS_INFEASIBLE: 'capsInfeasible', MOVE_NOT_ALLOWED: 'moveInvalid', MOVE_WEEK_BOUNDARY: 'moveWeek', MOVE_DATE_OCCUPIED: 'moveOccupied', SETUP_STORAGE_UNAVAILABLE: 'setupStorageError', DATE_RANGE: 'dateError', BASELINE_REQUIRED: 'baselineError', BASELINE_INCONSISTENT: 'baselineInconsistent', RECOVERY_SPACING: 'spacingError', INSUFFICIENT_DAYS: 'spacingError', RUN_WALK_PREFERENCES: 'runWalkError', PRESERVED_HISTORY_CONFLICT: 'retainedError', PENDING_RUN_EXISTS: 'pending' };
  return s(codes[error?.code] || (error?.status === 400 || error?.status === 422 ? 'invalid' : 'error'));
}
function Problem({ error, retry }) {
  const { s } = useCopy();
  return <Notice tone="danger"><div className="tp-stack"><p>{errorCopy(error, s)}</p>{error?.status === 401 ? <a href={`/login?returnTo=${encodeURIComponent(location.pathname+location.search)}`} onClick={()=>{localStorage.removeItem('hermes_jwt');localStorage.removeItem('hermes_role');}}>{s('signIn')}</a> : retry && <Button offlineSafe variant="secondary" onClick={retry}>{s('retry')}</Button>}</div></Notice>;
}
function Pending({ remote, children }) {
  const { s } = useCopy();
  if (remote.loading) return <Panel><Skeleton label={s('loading')} /></Panel>;
  if (remote.error) return <Problem error={remote.error} retry={remote.reload} />;
  return children(remote.data);
}
function useFormatting() {
  const { s, lang } = useCopy(); const { isMile } = useUnit();
  const distance = meters => `${new Intl.NumberFormat(lang, { maximumFractionDigits: 2 }).format(meters / (isMile ? 1609.344 : 1000))} ${isMile ? 'mi' : 'km'}`;
  const duration = seconds => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  const target = d => d.targetDistanceM != null ? distance(d.targetDistanceM) : d.targetDurationS != null ? duration(d.targetDurationS) : s('restHelp');
  const date = value => new Intl.DateTimeFormat(lang, { month: 'short', day: 'numeric', weekday: 'short', timeZone: 'UTC' }).format(new Date(`${value}T12:00:00Z`));
  const kind = code => s(code === 'RUN_WALK' ? 'RUN_WALK_KIND' : code);
  const pace = secondsPerKm => `${duration(Math.round(secondsPerKm * (isMile ? 1.609344 : 1)))} / ${isMile ? 'mi' : 'km'}`;
  return { distance, duration, target, date, kind, pace };
}
function Check({ children, checked, onChange, required = false }) { return <label className="tp-check"><input type="checkbox" checked={checked} onChange={event => onChange(event.target.checked)} required={required} /><span>{children}</span></label>; }

export default function TrainingPlan({ mode = 'schedule' }) {
  const { email, token } = useAuth(); const location = useLocation();
  // Remount on account changes and route changes: pending requests cannot populate another account's UI.
  return <TrainingPlanSession key={`${email}:${token}:${location.pathname}:${location.search}`} mode={mode} />;
}
function TrainingPlanSession({ mode }) {
  const { s,lang } = useCopy(); const navigate = useNavigate(); const location = useLocation();
  const cacheStatus=usePlanCacheStatus();
  useEffect(()=>{preparePlanOfflineShell();},[]);
  const params=useParams();const query=new URLSearchParams(location.search);
  const planId=query.get('planId')||params.planId,versionId=query.get('versionId')||params.versionId,workoutId=query.get('workoutId')||params.workoutId;
  const setup=query.get('planView')==='setup'||location.pathname.includes('/setup');
  const root = useRemote(base); const profile = useRemote('/api/profile/me'); const planProfile = useRemote('/api/plan-profile');
  const ready = !root.loading && !profile.loading && !planProfile.loading;
  const owner = root.data?.ownerId;
  useEffect(()=>{
    if(!owner||cacheStatus!=='online')return;
    const control=new AbortController();const token=localStorage.getItem('hermes_jwt');
    for(const p of root.data.plans.filter(p=>p.state==='ACTIVE')) {
      const v=p.versions.find(v=>v.state==='ACTIVE');if(!v)continue;
      const url=path(p.id,`/versions/${v.id}`);
      planRead(url,token,()=>planRequest(url,{signal:control.signal})).catch(()=>{});
    }
    return()=>control.abort();
  },[owner,root.data,cacheStatus]);
  return <section className="tp-ui tp-embedded" aria-label={s('title')}><header className="tp-page-header"><h2>{setup ? s('setup') : versionId ? s('previewTitle') : workoutId ? s('details') : s('title')}</h2>{!setup && mode!=='today' && <Button variant="secondary" onClick={() => navigate(planSetupUrl())}>{s('new')}</Button>}{(setup||versionId||workoutId)&&<Button offlineSafe variant="ghost" onClick={()=>navigate(mode==='today'?'/today-run':'/schedule')}>{s('close')}</Button>}</header>
      {cacheStatus!=='online'&&<Notice tone="warning"><p>{s(Number(cacheStatus.split(':')[1])?'offlineSnapshot':'offlineNoSnapshot',{date:new Date(Number(cacheStatus.split(':')[1])).toLocaleString(lang)})}</p><Button offlineSafe variant="secondary" onClick={()=>window.location.reload()}>{s('refreshOnline')}</Button></Notice>}
      {ready && owner && <PendingRecovery owner={owner} />}
      {root.error || profile.error || planProfile.error ? <Problem error={root.error || profile.error || planProfile.error} retry={() => { root.reload(); profile.reload(); planProfile.reload(); }} /> : !ready ? <Panel><Skeleton label={s('loading')} /></Panel> : setup ? <Setup owner={owner} planId={planId} profile={profile.data} savedProfile={planProfile.data} /> : versionId ? <Preview owner={owner} planId={planId} versionId={versionId} /> : workoutId ? <PublishedWorkout owner={owner} planId={planId} workoutId={workoutId} /> : <PlanHome owner={owner} plans={root.data.plans} />}
    </section>;
}

export function SchedulePlanTools(){const {token}=useAuth();const selection=useVersionedPlan();if(!token)return null;return selection.error?<div className="tp-ui tp-embedded"><Problem error={selection.error} retry={selection.reload}/></div>:<TrainingPlan/>;}
export function TodayPlanDetails(){
  const {token}=useAuth();const route=useLocation();const navigate=useNavigate();const {s,lang}=useCopy();const selection=useVersionedPlan();const cacheStatus=usePlanCacheStatus();const q=new URLSearchParams(route.search);
  if(!token)return null;
  if(selection.error)return <div className="tp-ui tp-embedded"><Problem error={selection.error} retry={selection.reload}/></div>;
  const planId=q.get('planId')||selection.data?.plan?.id,workoutId=q.get('workoutId')||selection.data?.workout?.id;
  return <div className="tp-ui tp-embedded">{cacheStatus!=='online'&&<Notice tone="warning">{s(Number(cacheStatus.split(':')[1])?'offlineSnapshot':'offlineNoSnapshot',{date:new Date(Number(cacheStatus.split(':')[1])).toLocaleString(lang)})}</Notice>}{selection.root?.ownerId&&<PendingRecovery owner={selection.root.ownerId}/>} {planId&&workoutId&&(q.has('workoutId')?<TodayWorkoutEntry key={`${token}:${planId}:${workoutId}`} planId={planId} workoutId={workoutId}/>:<Button offlineSafe variant="secondary" onClick={()=>navigate(planWorkoutUrl(planId,workoutId))}>{s('details')}</Button>)}</div>;
}
function TodayWorkoutEntry({planId,workoutId}){const root=useRemote(base);return <Pending remote={root}>{data=><PublishedWorkout owner={data.ownerId} planId={planId} workoutId={workoutId}/>}</Pending>;}
export function RunPlanManualRunEntry({onDone}){const {email,token}=useAuth();return <ManualRunEntry key={`${email}:${token}`} onDone={onDone}/>;}
function ManualRunEntry({onDone}){const root=useRemote(base);return <div className="tp-ui tp-embedded"><Pending remote={root}>{data=><ManualRun owner={data.ownerId} onDone={onDone||(()=>{})}/>}</Pending></div>;}
export function usePublishedCalendar(plan,from){return useRemote(plan?path(plan.id,`/workouts?from=${from}&to=${addDays(from,6)}`):null);}

function PendingRecovery({owner}) {
  const {s}=useCopy();const [item,setItem]=useState(null);
  useEffect(()=>{
    let cancelled=false;
    const load=event=>{if(event?.detail?.owner&&event.detail.owner!==String(owner))return;pendingRun(owner).then(value=>{if(!cancelled)setItem(value);}).catch(()=>{});};
    load();window.addEventListener(MANUAL_RUN_CHANGED,load);window.addEventListener('focus',load);
    return()=>{cancelled=true;window.removeEventListener(MANUAL_RUN_CHANGED,load);window.removeEventListener('focus',load);};
  },[owner]);
  if(!item)return null;
  return <Notice tone="warning"><div className="tp-stack"><p>{s(item.saved?(item.linkIntent?'savedLink':'saved'):'pending')}</p><Link to={item.linkIntent?page(item.linkIntent.planId,`/workouts/${item.linkIntent.workoutId}`):'/runs?manual=1'}>{s('resumeSave')}</Link></div></Notice>;
}

function Setup({ owner, planId, profile, savedProfile }) {
  const { s, lang } = useCopy(); const { unit, setUnit, isMile } = useUnit(); const navigate = useNavigate();
  const setupLocation=useLocation();const sourceVersion=new URLSearchParams(setupLocation.search).get('versionId')||new URLSearchParams(setupLocation.search).get('version');
  const [restored,setRestored]=useState(false);
  const [step, setStep] = useState(0); const [busy, setBusy] = useState(false); const [error, setError] = useState(null); const [confirmed, setConfirmed] = useState(false); const [message, setMessage] = useState('');
  const heading = useRef(null); const currentPlan = useRef(null); const profileRevision = useRef(savedProfile.revision); const savedInputs = useRef(null);
  const [inputs, setInputs] = useState(() => ({ ...defaultInputs(profile?.timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC', isMile ? 'MI' : 'KM'), ...savedProfile.profile }));
  const [loaded, setLoaded] = useState(!planId);
  useEffect(() => {
    if(!planId)return;const control=new AbortController();setLoaded(false);
    (async()=>{
      const p=await planRequest(path(planId),{signal:control.signal});
      if(p.state==='EXTERNAL')throw Object.assign(Error('EXTERNAL_PLAN'),{status:409,code:'EXTERNAL_PLAN'});
      const version=sourceVersion?await planRequest(path(planId,`/versions/${sourceVersion}`),{signal:control.signal}):null;
      const saved=p.state==='ACTIVE'?await readSetupEdit(owner,planId).catch(()=>null):null;
      const recovery=saved&&saved.sourceVersion===(sourceVersion||null)?saved:null;
      if(control.signal.aborted)return;
      currentPlan.current=p;setInputs(recovery?.inputs||version?.inputs||p.inputs);setStep(recovery?.setupStep??p.setupStep??0);setRestored(Boolean(recovery));setLoaded(true);
    })().catch(e=>{if(!control.signal.aborted)setError(e);});
    return()=>control.abort();
  },[planId,owner,sourceVersion]);
  const update = (key, value) => { setInputs(i => ({ ...i, [key]: value, ...(key==='recentResult'?{paceScaleBps:null}:{}) })); setConfirmed(false); setError(null); };
  const steps = ['goal', 'fitness', 'week', 'style', 'review'];
  const weekdays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 19 + i))));
  const fullDays = Array.from({ length: 7 }, (_, i) => new Intl.DateTimeFormat(lang, { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2026, 9, 19 + i))));
  const distanceInput = key => ({ value: Number((inputs[key] / (isMile ? 1609.344 : 1000)).toFixed(4)), onChange: e => update(key, Math.round(Number(e.target.value) * (isMile ? 1609.344 : 1000))) });
  async function advance() {
    setBusy(true);setError(null);
    try {
      let p=currentPlan.current;
      const normalized={...inputs,units:isMile?'MI':'KM'};
      if(!p){const result=await planCommand(owner,base,{inputs:normalized,setupStep:step+1});p={...result,state:'DRAFT',inputs:normalized};currentPlan.current=p;navigate(planSetupUrl(p.id));}
      else {if(p.state==='DRAFT'){p=await planRequest(path(p.id),{method:'PATCH',headers:{'If-Match':`"${p.revision}"`},body:{inputs:normalized,setupStep:step+1}});currentPlan.current=p;}else if(p.state==='ACTIVE'){await saveSetupEdit(owner,p.id,{baseRevision:p.revision,inputs:normalized,setupStep:step+1,sourceVersion:sourceVersion||null});}setStep(n=>n+1);requestAnimationFrame(()=>heading.current?.focus());}
    } catch(e){setError(e);requestAnimationFrame(()=>heading.current?.focus());}finally{setBusy(false);}
  }
  async function persist(generate) {
    setBusy(true); setError(null); setMessage('');
    try {
      const normalized = { ...inputs, units: isMile ? 'MI' : 'KM' };
      let p = currentPlan.current;
      if (!p) { const result = await planCommand(owner, base, { inputs: normalized }); p = { ...result, state: 'DRAFT', inputs: normalized }; currentPlan.current = p; }
      else if (p.state === 'DRAFT') { p = await planRequest(path(p.id), { method: 'PATCH', headers: { 'If-Match': `"${p.revision}"` }, body: { inputs: normalized } }); currentPlan.current = p; }
      if(p.state==='ACTIVE')await saveSetupEdit(owner,p.id,{baseRevision:p.revision,inputs:normalized,setupStep:4,sourceVersion:sourceVersion||null});
      if (!generate) { setMessage(s(p.state==='ACTIVE'?'editsSaved':'draftSaved')); return; }
      // Profile creation and plan generation use the same confirmed values. Existing profile is conditional.
      if (p.state === 'DRAFT' && savedInputs.current !== JSON.stringify(normalized)) {
        const result = await planRequest('/api/plan-profile', { method: 'PUT', headers: profileRevision.current == null ? { 'If-None-Match': '*' } : { 'If-Match': `"${profileRevision.current}"` }, body: normalized });
        profileRevision.current = result.revision; savedInputs.current = JSON.stringify(normalized);
      }
      const version = await planCommand(owner, path(p.id, '/versions'), { inputs: normalized, baseRevision: p.revision });
      if(p.state==='ACTIVE')await clearSetupEdit(owner,p.id).catch(()=>{});
      navigate(page(p.id, `/preview/${version.id}`));
    } catch (e) {
      setError(e);
      const fields=e.fields||[];
      if(fields.some(f=>['startDate','endDate','goalDistanceM','timeZone','adultConfirmed','title'].includes(f)))setStep(0);
      else if(fields.some(f=>['baselineWeeklyM','longestRecentM','baselineRunsPerWeek','recentResult','trainingMode','canWalk20Minutes'].includes(f)))setStep(1);
      else if(fields.includes('sessionCaps'))setStep(3);
      else if(fields.some(f=>['availableWeekdays','runsPerWeek','longRunWeekday'].includes(f)))setStep(2);
      else if(fields.includes('difficulty'))setStep(3);
      requestAnimationFrame(() => {heading.current?.focus();document.querySelector('[role="alert"]')?.scrollIntoView({block:'center'});});
    }
    finally { setBusy(false); }
  }
  if (!loaded) return error ? <Problem error={error} retry={() => location.reload()} /> : <Skeleton label={s('loading')} />;
  return <div className="tp-grid tp-grid--rail"><Panel><ol className="tp-progress">{steps.map((item, i) => <li key={item} aria-current={step === i ? 'step' : undefined}>{i + 1}. {s(item)}</li>)}</ol>
    <h2 ref={heading} tabIndex={-1}>{s(steps[step])}</h2>{restored && <Notice>{s('editsRestored')}</Notice>}{error && <Problem error={error} />}{message && <Notice tone="success">{message}</Notice>}
    <form className="tp-stack" onSubmit={event => { event.preventDefault(); if (step < 4) advance(); else persist(true); }}>
      {step === 0 && <><Field label={s('name')} value={inputs.title} maxLength={120} required onChange={e => update('title', e.target.value)} /><ChoiceGroup legend={s('goalKind')} value={inputs.goalKind} onChange={v => update('goalKind', v)} options={['DISTANCE', 'RACE'].map(value => ({ value, title: s(value) }))} /><ChoiceGroup legend={s('distance')} value={String(inputs.goalDistanceM)} onChange={v => update('goalDistanceM', Number(v))} options={[5000, 10000].map(value => ({ value: String(value), title: `${value / 1000}K` }))} /><div className="tp-fields"><Field type="date" label={s('start')} value={inputs.startDate} onChange={e => update('startDate', e.target.value)} required /><Field type="date" label={s('end')} value={inputs.endDate} onChange={e => update('endDate', e.target.value)} required /></div><Field label={s('zone')} value={inputs.timeZone} onChange={e => update('timeZone', e.target.value)} maxLength={64} required />{inputs.goalKind === 'RACE' && <Field label={s('eventName')} value={inputs.eventName || ''} onChange={e => update('eventName', e.target.value)} maxLength={120} />}<Check checked={inputs.adultConfirmed} onChange={v => update('adultConfirmed', v)} required>{s('adult')}</Check></>}
      {step === 1 && <><Notice>{s('baselineHelp')}</Notice><BaselineEvidence evidence={savedProfile.baselineEvidence} onUse={suggestion=>{setInputs(i=>({...i,...suggestion}));setConfirmed(false);}}/><Select label={s('unit')} value={unit} onChange={e => setUnit(e.target.value)}><option value="km">km</option><option value="mile">mi</option></Select><ChoiceGroup legend={s('mode')} value={inputs.trainingMode} onChange={v => update('trainingMode', v)} options={[{ value: 'RUN_WALK', title: s('RUN_WALK'), description: s('walkHelp') }, { value: 'DISTANCE', title: s('DISTANCE_MODE'), description: s('distanceHelp') }]} /><Select label={s('ability')} value={inputs.experience} onChange={e => update('experience', e.target.value)}>{['BEGINNER', 'INTERMEDIATE', 'ADVANCED'].map(x => <option key={x} value={x}>{s(x)}</option>)}</Select><div className="tp-fields"><Field label={`${s('weekly')} (${isMile ? 'mi' : 'km'})`} type="number" min={0} step="any" required {...distanceInput('baselineWeeklyM')} /><Field label={`${s('longest')} (${isMile ? 'mi' : 'km'})`} type="number" min={0} step="any" required {...distanceInput('longestRecentM')} /></div><Field label={s('baselineCount')} type="number" min={0} max={7} step={1} value={inputs.baselineRunsPerWeek} onChange={e => update('baselineRunsPerWeek', Number(e.target.value))} required /><Check checked={inputs.canWalk20Minutes} onChange={v => update('canWalk20Minutes', v)}>{s('walk20')}</Check><Check checked={inputs.recentResult != null} onChange={v => update('recentResult', v ? { distanceM: 5000, seconds: 1800, date: localDate(inputs.timeZone) } : null)}>{s('result')}</Check>{inputs.recentResult && <div className="tp-fields"><Select label={s('distance')} value={inputs.recentResult.distanceM} onChange={e => update('recentResult', { ...inputs.recentResult, distanceM: Number(e.target.value) })}><option value={5000}>5K</option><option value={10000}>10K</option></Select><Field type="number" min={1} max={86400} label={s('seconds')} value={inputs.recentResult.seconds} required onChange={e => update('recentResult', { ...inputs.recentResult, seconds: Number(e.target.value) })} /><Field type="date" label={s('resultDate')} value={inputs.recentResult.date} required onChange={e => update('recentResult', { ...inputs.recentResult, date: e.target.value })} /></div>}</>}
      {step === 2 && <><Weekdays legend={s('days')} labels={weekdays} fullLabels={fullDays} days={inputs.availableWeekdays} onChange={v => update('availableWeekdays', v)} /><div className="tp-fields"><Select label={s('frequency')} value={inputs.runsPerWeek} onChange={e => update('runsPerWeek', Number(e.target.value))}>{[3, 4, 5].map(n => <option key={n} value={n} disabled={inputs.trainingMode==='RUN_WALK'&&n!==3}>{n}</option>)}</Select><Select label={s('longDay')} value={inputs.longRunWeekday} onChange={e => update('longRunWeekday', Number(e.target.value))}>{fullDays.map((d, i) => <option key={d} value={i + 1}>{d}</option>)}</Select></div><p className="tp-muted">{s('weekHelp')}</p></>}
      {step === 3 && <><ChoiceGroup legend={s('volume')} value={inputs.volume} onChange={v => update('volume', v)} options={['LOWER', 'STANDARD', 'HIGHER'].map(value => ({ value, title: s(value) }))} /><ChoiceGroup legend={s('difficulty')} value={inputs.difficulty} onChange={v => update('difficulty', v)} options={['EASY', 'STANDARD', 'HIGHER'].map(value => ({ value, title: s(value),disabled:value!=='EASY'&&(inputs.trainingMode==='RUN_WALK'||inputs.experience==='BEGINNER'),description:value!=='EASY'&&(inputs.trainingMode==='RUN_WALK'||inputs.experience==='BEGINNER')?s('easyOnly'):undefined }))} /><p className="tp-muted">{s('styleHelp')}</p><SessionCapsEditor key={`${inputs.trainingMode}:${isMile}`} caps={inputs.sessionCaps} mode={inputs.trainingMode} isMile={isMile} onChange={v=>update('sessionCaps',v)} s={s} /></>}
      {step === 4 && <><SetupSummary inputs={inputs} /><Notice>{s('reviewHelp')}</Notice><Check checked={confirmed} onChange={setConfirmed} required>{s('confirmBaseline')}</Check></>}
      <div className="tp-actions"><Button variant="ghost" disabled={busy} onClick={() => step ? setStep(n => n - 1) : navigate('/schedule')}>{s('back')}</Button><Button type="submit" busy={busy} disabled={step === 4 && !confirmed}>{busy ? s('generating') : step === 4 ? s('generate') : s('next')}</Button></div>
      {step === 4 && <Button variant="secondary" busy={busy} disabled={!confirmed} onClick={() => persist(false)}>{s('saveDraft')}</Button>}
    </form></Panel><Panel><p className="tp-eyebrow">{s('review')}</p><h2>{inputs.title || s('setup')}</h2><SetupSummary inputs={inputs} /><p className="tp-muted">{s('intro')}</p></Panel></div>;
}
function BaselineEvidence({evidence,onUse}) {
  const {s}=useCopy();const f=useFormatting();if(!evidence)return null;
  return <details><summary>{s('evidence')}</summary><div className="tp-stack"><p>{s('evidenceHelp')}</p><dl className="tp-summary">{evidence.weeks.map(w=><div key={w.from}><dt>{w.from} – {w.to}</dt><dd>{w.recordedRunCount} · {w.recordedDistanceM==null?'—':f.distance(w.recordedDistanceM)}</dd></div>)}</dl>{evidence.suggestion?<Button variant="secondary" onClick={()=>onUse(evidence.suggestion)}>{s('useEvidence')}</Button>:<p className="tp-muted">{s('noEvidence')}</p>}</div></details>;
}
function SetupSummary({ inputs }) {
  const { s,lang } = useCopy(); const f = useFormatting();
  const weekday=n=>new Intl.DateTimeFormat(lang,{weekday:'short',timeZone:'UTC'}).format(new Date(Date.UTC(2026,9,18+Number(n))));
  const rows=[[s('goal'),s(inputs.goalKind||'DISTANCE')],[s('distance'), f.distance(inputs.goalDistanceM)], [s('start'), inputs.startDate], [s('end'), inputs.endDate], [s('mode'), s(inputs.trainingMode === 'DISTANCE' ? 'DISTANCE_MODE' : 'RUN_WALK')], [s('frequency'), inputs.runsPerWeek], [s('weekly'), f.distance(inputs.baselineWeeklyM)],[s('baselineCount'),inputs.baselineRunsPerWeek],[s('longest'),f.distance(inputs.longestRecentM)],[s('days'),(inputs.availableWeekdays||[]).map(weekday).join(' · ')],[s('longDay'),weekday(inputs.longRunWeekday)], [s('zone'), inputs.timeZone], [s('volume'), s(inputs.volume)], [s('difficulty'), s(inputs.difficulty)]];
  for(const [key,value] of Object.entries(inputs.sessionCaps||{}))if(value!=null)rows.push([s(`cap_${key}`),key==='runWalkS'?f.duration(value):f.distance(value)]);
  if(inputs.paceScaleBps!=null&&inputs.paceScaleBps!==10000)rows.push([s('paceReview'),s('paceAdjusted')]);
  if(inputs.eventName)rows.push([s('eventName'),inputs.eventName]);
  if(inputs.recentResult)rows.push([s('result'),`${f.distance(inputs.recentResult.distanceM)} · ${f.duration(inputs.recentResult.seconds)} · ${inputs.recentResult.date}`]);
  return <dl className="tp-summary">{rows.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>;
}

function WeekView({ week, onOpen, candidateVersionId }) {
  const { s } = useCopy(); const f = useFormatting();
  return <Panel><div className="tp-section-head"><h2>{s('weekOf')} {f.date(week.startDate)}</h2><Badge tone="accent">{s(week.phase)}</Badge></div><Stats items={[{ label: s('trainingOnly'), value: [week.trainingDistanceM != null ? f.distance(week.trainingDistanceM) : null, week.trainingDurationS != null ? f.duration(week.trainingDurationS) : null].filter(x=>x!=null).join(' · ') || '—' }, { label: s('sessions'), value: String(week.runCount) }, ...(week.eventDistanceM ? [{ label: s('goalDistance'), value: f.distance(week.eventDistanceM) }] : [])]} /><div role="list">{week.days.map(day => <div role="listitem" key={day.id || day.localDate}><WorkoutRow day={f.date(day.localDate)} title={f.kind(day.workoutType)} target={f.target(day)} status={day.workoutType === 'REST' ? undefined : s(day.state)} rest={day.workoutType === 'REST'} onOpen={() => onOpen(day)} />{candidateVersionId && day.versionId && day.versionId!==candidateVersionId && <small className="tp-muted">{s('retained')}</small>}</div>)}</div></Panel>;
}
function Preview({ owner, planId, versionId }) {
  const remote = useRemote(path(planId, `/versions/${versionId}`));
  return <Pending remote={remote}>{data => <PreviewReady owner={owner} data={data} reload={remote.reload} />}</Pending>;
}
function PreviewReady({ owner, data, reload }) {
  const { s } = useCopy(); const f = useFormatting(); const navigate = useNavigate(); const location=useLocation(); const [dialog, setDialog] = useState(false); const [reviewed, setReviewed] = useState(false); const [acks, setAcks] = useState([]); const [error, setError] = useState(null); const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState(() => new URLSearchParams(location.search).get('workout'));
  const workout = data.weeks.flatMap(w => w.days).find(d => d.id === search);
  const [experimentalAck,setExperimentalAck]=useState(false);
  const activationAllowed=data.activationAllowed??data.rulesApproved;
  async function activate() {
    setBusy(true);setError(null);
    try { await planCommand(owner, path(data.planId, '/activate'), { versionId: data.id, contentHash: data.contentHash, baseRevision: data.baseRevision, activePlanId: data.activePlanId, activePlanRevision: data.activePlanRevision, acknowledgedWarnings: acks, acknowledgedExperimental: experimentalAck }); navigate('/schedule'); }
    catch(e) { setError(e); if(e.status === 409){setDialog(false);setAcks([]);setReviewed(false);reload();} }
    finally { setBusy(false); }
  }
  function openDay(day) {setSearch(day.id);}
  function closeDay() {setSearch(null);}
  return <><div className="tp-section-head"><p className="tp-muted">{s('previewHelp')}</p><Button variant="secondary" disabled={data.stale || !activationAllowed || data.state !== 'READY'} onClick={()=>setDialog(true)}>{s('activation')}</Button></div>{error && <Problem error={error} retry={reload} />}{data.retainedWorkoutIds?.length>0 && <Notice>{s('retainedNotice',{count:data.retainedWorkoutIds.length})}</Notice>}{data.replacedWorkoutIds?.length>0 && <Notice>{s('replacementNotice',{count:data.replacedWorkoutIds.length})}</Notice>}{data.change?.kind==='PACE_REVIEW'&&<Notice>{s('pacePreviewSummary',{direction:s(`pace_${data.change.direction}`),count:data.change.sampleCount})}</Notice>}{data.change?.kind==='WORKOUT_MOVE' && <Notice>{s('moveSummary',{from:data.change.fromDate,to:data.change.toDate})}</Notice>}{data.stale && <Notice tone="warning">{s('stale')}</Notice>}<Notice tone="warning">{s('experimentalNotice')}</Notice>{!activationAllowed && <Notice tone="warning">{s('reviewGate')}</Notice>}
    <div className="tp-grid tp-grid--rail"><div className="tp-stack"><Panel><h2>{data.title}</h2><Stats items={[{ label:s('weeks'),value:String(data.weeks.length) },{ label:s('daysTotal'),value:String(data.weeks.reduce((n,w)=>n+w.days.length,0)) },{ label:s('sessions'),value:String(data.weeks.reduce((n,w)=>n+w.runCount,0)) }]} /><p className="tp-muted">{s('noEstimate')}</p></Panel>{data.weeks.map(week => <WeekView key={week.startDate} week={week} onOpen={openDay} candidateVersionId={data.id} />)}</div>
      <Panel><h2>{s('review')}</h2><SetupSummary inputs={data.inputs} />{data.warnings.map(note => <Notice key={note} tone="warning">{s(note)}</Notice>)}<Button disabled={data.stale || !activationAllowed || data.state !== 'READY'} onClick={() => setDialog(true)}>{s('activate')}</Button><Button variant="secondary" onClick={() => navigate(planSetupUrl(data.planId,data.id))}>{s('edit')}</Button></Panel></div>
    <Dialog open={dialog} onClose={() => setDialog(false)} title={s('activation')} closeLabel={s('close')}><div className="tp-stack"><p>{s('activationHelp')}</p><Notice tone="warning">{s('experimentalNotice')}</Notice>{data.warnings.map(note => <div key={note}><Notice tone="warning">{s(note)}</Notice><Check checked={acks.includes(note)} onChange={v => setAcks(a => v ? [...a,note] : a.filter(x=>x!==note))}>{s('ack')}</Check></div>)}{data.experimentalActivation && <Check checked={experimentalAck} onChange={setExperimentalAck}>{s('experimentalAck')}</Check>}<Check checked={reviewed} onChange={setReviewed}>{s('activateConfirm')}</Check>{error && <Problem error={error} />}<Button busy={busy} disabled={!reviewed || (data.experimentalActivation && !experimentalAck) || acks.length !== data.warnings.length} onClick={activate}>{s('activate')}</Button></div></Dialog>
    <Dialog open={Boolean(workout)} onClose={closeDay} title={s('candidate')} closeLabel={s('close')}>{workout && <div className="tp-stack"><p>{f.date(workout.localDate)} · {f.kind(workout.workoutType)} · {f.target(workout)}</p><SessionSteps workout={workout} /></div>}</Dialog>
  </>;
}

function PlanHome({ owner, plans }) {
  const {s}=useCopy();const navigate=useNavigate();const selection=useVersionedPlan();
  const active=selection.data?.plan;
  return <>{active&&<Panel><div className="tp-section-head"><h3>{active.title}</h3><Badge tone="success">{s('ACTIVE')}</Badge><Button variant="secondary" onClick={()=>navigate(planSetupUrl(active.id))}>{s('edit')}</Button><Archive owner={owner} plan={active}/></div>{selection.data.state!=='TODAY'&&<Notice>{s(selection.data.state)}</Notice>}</Panel>}{active&&<PaceReview owner={owner} plan={active} onChanged={selection.reload}/>}
    {plans.length>0&&<details><summary>{s('drafts')}</summary><Panel>{plans.map(p=><div key={p.id} className="tp-section-head"><strong>{p.title}</strong><Badge>{s(p.state)}</Badge><div className="tp-actions">{p.state==='DRAFT'&&<Button variant="secondary" onClick={()=>navigate(planSetupUrl(p.id))}>{s('resume')}</Button>}{p.versions[0]&&<Button offlineSafe variant="ghost" onClick={()=>navigate(page(p.id,`/preview/${p.versions[0].id}`))}>{s('preview')}</Button>}</div></div>)}</Panel></details>}
    {!active&&plans.length===0&&<p className="tp-muted">{s('emptyCopy')}</p>}
  </>;
}
function PaceReview({owner,plan,onChanged}) {
  const {s}=useCopy();const f=useFormatting();const navigate=useNavigate();const remote=useRemote(path(plan.id,'/pace-review'));
  const [busy,setBusy]=useState(false);const [error,setError]=useState(null);
  async function decide(accept,data) {
    setBusy(true);setError(null);
    try {
      const result=await planCommand(owner,path(plan.id,accept?'/pace-preview':'/pace-dismiss'),{baseRevision:data.planRevision,evidenceHash:data.evidenceHash});
      if(accept)navigate(page(plan.id,`/preview/${result.id}`));else{remote.reload();onChanged?.();}
    }catch(e){setError(e);if(e.status===409)remote.reload();}finally{setBusy(false);}
  }
  return <Panel><h2>{s('paceReview')}</h2><Pending remote={remote}>{data=><div className="tp-stack">
    <p>{s(`paceState_${data.state}`,{count:data.sampleCount})}</p>
    {data.state==='RECOMMENDED'&&<><Notice>{s('paceProposal',{direction:s(`pace_${data.direction}`)})}</Notice><p className="tp-muted">{s('paceEvidenceHelp')}</p></>}
    {data.sources?.length>0&&<ul>{data.sources.map(source=><li key={source.activityId}><Link to={`/runs/${source.activityId}`}>{source.name}</Link><p>{source.localDate} · {s('paceActual')}: {f.pace(source.actualPace)} · {s('pacePlanned')}: {f.pace(source.plannedPace)}</p></li>)}</ul>}
    {data.excludedSources?.length>0&&<details><summary>{s('paceExcluded')}</summary><div className="tp-stack"><p className="tp-muted">{s('paceExcludedHelp')}</p><ul>{data.excludedSources.map(source=><li key={source.activityId}><Link to={`/runs/${source.activityId}`}>{source.name}</Link><p>{source.localDate} · {s(`paceExcluded_${source.reason}`)}</p></li>)}</ul></div></details>}
    {error&&<Problem error={error}/>}{data.state==='RECOMMENDED'&&<div className="tp-actions"><Button busy={busy} onClick={()=>decide(true,data)}>{s('reviewPace')}</Button><Button variant="secondary" busy={busy} onClick={()=>decide(false,data)}>{s('declinePace')}</Button></div>}
  </div>}</Pending></Panel>;
}

function Archive({ owner, plan }) {
  const { s } = useCopy();const [open,setOpen]=useState(false);const [busy,setBusy]=useState(false);const [error,setError]=useState(null);
  async function archive(){setBusy(true);try{await planCommand(owner,path(plan.id,'/archive'),{revision:plan.revision});location.assign('/schedule');}catch(e){setError(e);}finally{setBusy(false);}}
  return <><Button variant="ghost" onClick={()=>setOpen(true)}>{s('archive')}</Button><Dialog open={open} onClose={()=>setOpen(false)} title={s('archive')} closeLabel={s('close')}><div className="tp-stack"><p>{s('archiveHelp')}</p>{error&&<Problem error={error}/>}<Button busy={busy} onClick={archive}>{s('confirm')}</Button></div></Dialog></>;
}
function SessionSteps({ workout }) {
  const { s }=useCopy();const f=useFormatting();
  return workout.workoutType==='REST'?<Notice>{s('restHelp')}</Notice>:<><h2>{s('steps')}</h2><StepList steps={workout.steps.map(step=>({label:s(step.stepType),target:step.distanceM!=null?f.distance(step.distanceM):f.duration(step.durationS),instruction:`${s(step.effortKey==='EASY'?'EASY_EFFORT':step.effortKey==='STEADY'?'STEADY_EFFORT':step.effortKey==='WALK'?'WALK_EFFORT':step.effortKey)}${step.paceMinSPerKm?` · ${s('pace')}: ${f.pace(step.paceMinSPerKm)}–${f.pace(step.paceMaxSPerKm)}`:''}`}))}/><p className="tp-muted">{s('effortHelp')}</p></>;
}
function PublishedWorkout({ owner, planId, workoutId }) {
  const remote=useRemote(path(planId,`/workouts/${workoutId}`));
  return <Pending remote={remote}>{data=><WorkoutReady key={data.workout.revision} owner={owner} data={data} reload={remote.reload}/>}</Pending>;
}
function WorkoutReady({ owner, data, reload }) {
  const { s }=useCopy();const f=useFormatting();const {workout:w,plan,link}=data;const [dialog,setDialog]=useState(null);const [error,setError]=useState(null);const [busy,setBusy]=useState(false);
  async function status(action,payload){setBusy(true);setError(null);try{await planCommand(owner,path(plan.id,`/workouts/${w.id}/${action}`),{revision:w.revision,...payload});setDialog(null);reload();}catch(e){setError(e);if(e.status===409)reload();}finally{setBusy(false);}}
  return <><Link to="/schedule">{s('back')}</Link><div className="tp-grid tp-grid--rail"><Panel><div className="tp-section-head"><h2>{f.kind(w.workoutType)}</h2><Badge tone={w.state==='COMPLETED'?'success':'neutral'}>{s(w.state)}</Badge></div><p>{f.date(w.localDate)} · {plan.title}</p><Stats items={[{label:s('planned'),value:f.target(w)},{label:s('week'),value:s(w.phase)}]}/><SessionSteps workout={w}/></Panel><Panel><h2>{s('review')}</h2>{error&&<Problem error={error} retry={reload}/>}<p>{s(w.completionSource)}</p>{link?<><Link to={`/runs/${link.activityId}`}>{s('linked')}</Link>{plan.state==='ACTIVE'&&<Button variant="secondary" onClick={()=>setDialog('unlink')}>{s('unlink')}</Button>}</>:w.workoutType!=='REST'&&plan.state==='ACTIVE'?<><Button onClick={()=>setDialog('link')}>{s('link')}</Button><Button variant="secondary" onClick={()=>setDialog('manual')}>{s('manual')}</Button>{w.state==='PLANNED'?<>{w.workoutType!=='EVENT'&&w.localDate>localDate(plan.inputs.timeZone)&&<Button variant="secondary" onClick={()=>setDialog('move')}>{s('moveWorkout')}</Button>}<Button variant="ghost" onClick={()=>setDialog('complete')}>{s('unlogged')}</Button><Button variant="ghost" onClick={()=>status('status',{state:'SKIPPED'})} busy={busy}>{s('skip')}</Button></>:<Button variant="ghost" onClick={()=>status('status',{state:'PLANNED'})} busy={busy}>{s('reopen')}</Button>}</>:null}</Panel></div>
    <Dialog open={dialog==='unlink'||dialog==='complete'} title={s(dialog==='unlink'?'unlink':'unlogged')} closeLabel={s('close')} onClose={()=>setDialog(null)}><div className="tp-stack"><p>{s(dialog==='unlink'?'unlinkHelp':'unloggedHelp')}</p><Button busy={busy} onClick={()=>dialog==='unlink'?status('unlink',{}):status('status',{state:'COMPLETED'})}>{s('confirm')}</Button></div></Dialog>
    <Dialog open={dialog==='link'} title={s('linkTitle')} closeLabel={s('close')} onClose={()=>setDialog(null)}>{dialog==='link'&&<RunPicker owner={owner} plan={plan} workout={w} onLinked={()=>{setDialog(null);reload();}}/>}</Dialog>
    <Dialog open={dialog==='move'} title={s('moveWorkout')} closeLabel={s('close')} onClose={()=>setDialog(null)}>{dialog==='move'&&<MoveWorkout owner={owner} plan={plan} workout={w} onConflict={reload}/>}</Dialog>
    <Dialog open={dialog==='manual'} title={s('manual')} closeLabel={s('close')} onClose={()=>setDialog(null)}>{dialog==='manual'&&<ManualRun owner={owner} plan={plan} workout={w} onDone={()=>{setDialog('link');}}/>}</Dialog>
  </>;
}
function MoveWorkout({owner,plan,workout,onConflict}) {
  const {s}=useCopy();const navigate=useNavigate();const [date,setDate]=useState('');const [busy,setBusy]=useState(false);const [error,setError]=useState(null);
  const first=mondayOf(workout.localDate),last=addDays(first,6);
  async function preview(event) {
    event.preventDefault();setBusy(true);setError(null);
    try {
      const v=await planCommand(owner,path(plan.id,`/workouts/${workout.id}/move-preview`),{baseRevision:plan.revision,revision:workout.revision,targetDate:date});
      navigate(page(plan.id,`/preview/${v.id}`));
    } catch(e){setError(e);if(e.status===409)onConflict();}finally{setBusy(false);}
  }
  return <form className="tp-stack" onSubmit={preview}><p>{s('moveHelp')}</p><p>{s('zone')}: {plan.inputs.timeZone}</p>
    <Field type="date" label={s('moveDate')} min={[first,plan.inputs.startDate,addDays(localDate(plan.inputs.timeZone),1)].sort().at(-1)} max={[last,plan.inputs.endDate].sort()[0]} value={date} required onChange={e=>{setDate(e.target.value);setError(null);}}/>
    {error&&<Problem error={error}/>}<Button type="submit" busy={busy} disabled={!date}>{s('previewMove')}</Button></form>;
}

function RunPicker({owner,plan,workout,onLinked}) {
  const {s}=useCopy();const f=useFormatting();const [range,setRange]=useState({from:addDays(workout.localDate,-7),to:addDays(workout.localDate,7)});const [requested,setRequested]=useState(range);const [cursor,setCursor]=useState(null);const [items,setItems]=useState([]);const [selected,setSelected]=useState('');const [decision,setDecision]=useState('');const [acks,setAcks]=useState([]);const [busy,setBusy]=useState(false);const [error,setError]=useState(null);
  const url=path(plan.id,`/workouts/${workout.id}/activity-candidates?from=${requested.from}&to=${requested.to}${cursor?`&cursor=${cursor}`:''}`);const remote=useRemote(url);
  const list=[...items,...(remote.data?.activities||[])];const chosen=list.find(a=>a.id===selected);
  async function link(){setBusy(true);setError(null);try{await planCommand(owner,path(plan.id,`/workouts/${workout.id}/link`),{revision:workout.revision,activityId:chosen.id,metricHash:chosen.metricHash,decision,acknowledgedWarnings:acks});const pending=await pendingRun(owner);if(pending?.saved?.id===chosen.id)await discardPendingRun(owner);onLinked();}catch(e){setError(e);setSelected('');setAcks([]);remote.reload();}finally{setBusy(false);}}
  return <div className="tp-stack"><p>{s('linkHelp')}</p><form className="tp-stack" onSubmit={e=>{e.preventDefault();setItems([]);setCursor(null);setSelected('');setAcks([]);setRequested({...range});remote.reload();}}><div className="tp-fields"><Field label={s('from')} type="date" value={range.from} onChange={e=>setRange(r=>({...r,from:e.target.value}))} required/><Field label={s('to')} type="date" value={range.to} onChange={e=>setRange(r=>({...r,to:e.target.value}))} required/></div><Button type="submit" variant="secondary">{s('loadRuns')}</Button></form>{error&&<Problem error={error}/>}<Pending remote={remote}>{result=><>{list.length===0?<Notice>{s('candidatesEmpty')}</Notice>:<ChoiceGroup legend={s('actual')} value={selected} onChange={v=>{setSelected(v);setAcks([]);setDecision('');}} options={list.map(a=>({value:a.id,title:a.name||s('actual'),description:`${a.localDate?f.date(a.localDate):s('UNKNOWN_ACTIVITY_DATE')} · ${f.distance(a.distanceM)} · ${f.duration(a.durationS)}`}))}/>} {result.nextCursor&&<Button variant="secondary" onClick={()=>{setItems(list);setCursor(result.nextCursor);setSelected('');setAcks([]);}}>{s('more')}</Button>}</>}</Pending>{chosen&&<><ChoiceGroup legend={s('decision')} value={decision} onChange={setDecision} options={[{value:'COMPLETE',title:s('COMPLETE')},{value:'PARTIAL',title:s('PARTIAL_DECISION')}]}/>{chosen.warnings.map(note=><div key={note}><Notice tone="warning">{s(note)}</Notice><Check checked={acks.includes(note)} onChange={v=>setAcks(a=>v?[...a,note]:a.filter(x=>x!==note))}>{s('ack')}</Check></div>)}<Button busy={busy} disabled={!decision||acks.length!==chosen.warnings.length||remote.loading} onClick={link}>{s('linkConfirm')}</Button></>}</div>;
}
function ManualRun({owner,plan,workout,onDone}) {
  const {s}=useCopy();const {isMile}=useUnit();const [pending,setPending]=useState(null);const [error,setError]=useState(null);const [busy,setBusy]=useState(false);const [saved,setSaved]=useState(false);
  const saving=useRef(false);
  const [form,setForm]=useState({name:'',startedAt:new Date(Date.now()-3600000).toISOString().slice(0,19)+'Z',distance:'',minutes:''});
  useEffect(()=>{let cancelled=false;pendingRun(owner).then(async item=>{if(cancelled)return;setPending(item);if(!workout&&item?.saved&&!item.linkIntent)await discardPendingRun(owner).catch(()=>{if(!cancelled)setError({code:'STORAGE_CLEANUP'});});}).catch(()=>{if(!cancelled)setError({code:'STORAGE'});});return()=>{cancelled=true;};},[owner,workout]);
  async function save(retry){if(saving.current)return;saving.current=true;setBusy(true);setError(null);try{if(!retry){await queueManualRun(owner,{name:form.name,startedAt:new Date(form.startedAt).toISOString(),timeZone:plan?.inputs.timeZone||Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',distanceMeters:Math.round(Number(form.distance)*(isMile?1609.344:1000)),elapsedSeconds:Math.round(Number(form.minutes)*60)},plan&&workout?{planId:plan.id,workoutId:workout.id}:null);}const item=await savePendingRun(owner);setPending(item);setSaved(true);if(!workout&&!item.linkIntent)await discardPendingRun(owner).catch(()=>setError({code:'STORAGE_CLEANUP'}));}catch(e){setError(e);setPending(await pendingRun(owner).catch(()=>null));}finally{saving.current=false;setBusy(false);}}
  if(!workout&&pending?.linkIntent)return <Notice>{s('pending')}<Link to={page(pending.linkIntent.planId,`/workouts/${pending.linkIntent.workoutId}`)}>{s('resumeSave')}</Link></Notice>;
  return <div className="tp-stack"><p>{s(workout?'manualHelp':'extraRunHelp')}</p>{error&&(error.code==='STORAGE'?<Notice tone="danger">{s('storageError')}</Notice>:error.code==='STORAGE_CLEANUP'?<Notice tone="warning">{s('storageCleanupError')}</Notice>:<Problem error={error}/>)}{saved||pending?.saved?<><Notice tone="success">{s(workout?'savedLink':'saved')}</Notice><Link to={`/runs/${pending.saved.id}`}>{s('linked')}</Link><Button offlineSafe={!workout} onClick={onDone}>{s(workout?'link':'done')}</Button></>:pending?<><Notice tone="warning">{s('pending')}</Notice><p>{pending.body.name} · {pending.body.startedAt}</p><Button busy={busy} disabled={error?.status===410} onClick={()=>save(true)}>{s('resumeSave')}</Button><Button variant="ghost" onClick={async()=>{await discardPendingRun(owner);setPending(null);setError(null);}}>{s('discard')}</Button></>:<form className="tp-stack" onSubmit={e=>{e.preventDefault();save(false);}}><Field label={s('runName')} value={form.name} onChange={e=>setForm(v=>({...v,name:e.target.value}))} required maxLength={120}/><Field label={s('startedAt')} value={form.startedAt} onChange={e=>setForm(v=>({...v,startedAt:e.target.value}))} required/><Field label={`${s('runDistance')} (${isMile?'mi':'km'})`} type="number" min="0.001" step="any" value={form.distance} onChange={e=>setForm(v=>({...v,distance:e.target.value}))} required/><Field label={s('minutes')} type="number" min="0.017" step="any" value={form.minutes} onChange={e=>setForm(v=>({...v,minutes:e.target.value}))} required/><Button offlineSafe busy={busy} type="submit">{s('saveRun')}</Button></form>}</div>;
}
