import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState} from 'react';
import {Link,useLocation,useNavigate} from 'react-router';
import {useAuth} from '../../contexts/AuthContext';
import {useI18n} from '../../contexts/I18nContext';
import {useUnit} from '../../contexts/UnitContext';
import AppIcon from '../../components/AppIcon';
import TopbarNotifications from '../../components/TopbarNotifications';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import {DateShortcuts,MapControlIcon,WorkoutDisplay} from './WorkoutMapControls';
import {getActivityDateKey} from '../../utils/timeZone';
import {readMapFilters,writeMapFilters,invalidMapRange} from './workoutMapModel';
import {createWorkoutMap} from './workoutMapRenderer';
import useWorkoutMap,{loadWorkout,loadWorkoutChoices,loadWorkoutTrack,loadWorkoutTiles,loadNewWorkoutTiles} from './useWorkoutMap';
import WorkoutFilters from './WorkoutFilters';
import {MAP_TOKENS} from './workoutMapTokens';
import 'leaflet/dist/leaflet.css';
import './workout-map.css';

export default function WorkoutHeatmap() {
  const {token,email}=useAuth(),{t,lang}=useI18n(),{unit}=useUnit(),location=useLocation(),navigate=useNavigate();
  const tr=key=>t(`heatmapExplorer.workoutMap.${key}`);
  const filters=useMemo(()=>readMapFilters(location.search),[location.search]);
  const [panel,setPanel]=useState(null),[draft,setDraft]=useState(filters);
  const [picked,setPicked]=useState(null),[candidates,setCandidates]=useState([]),[highlight,setHighlight]=useState(null);
  const [choices,setChoices]=useState([]),[candidateCount,setCandidateCount]=useState(0);
  const [coverage,setCoverage]=useState({state:'idle'});
  const [mapError,setMapError]=useState(false),[mapReady,setMapReady]=useState(false),[mapAttempt,setMapAttempt]=useState(0);
  const [weightDraft,setWeightDraft]=useState(null);
  const [summaryOpen,setSummaryOpen]=useState(true);
  const node=useRef(null),renderer=useRef(null),initialFit=useRef(false),dialog=useRef(null),triggers=useRef({}),pickRequest=useRef(null),selectionSnapshot=useRef(null);
  const model=useWorkoutMap(token,filters,email),{data,preferences}=model;
  const [calendar,setCalendar]=useState({account:token,zone:null});
  // Query reloads retire geometry and its metadata. Keep the known account
  // calendar for shortcuts, but never carry it into a different account.
  useEffect(()=>{if(data.zone)setCalendar({account:token,zone:data.zone});},[token,data.zone]);
  const calendarZone=data.zone||(calendar.account===token?calendar.zone:null);
  const viewPreferences=useMemo(()=>weightDraft==null?preferences:{...preferences,weight:weightDraft},[preferences,weightDraft]);
  const latest=useRef({});useLayoutEffect(()=>{latest.current={model,filters,token};});
  const factor=unit==='mile'?1.609344:1,distanceUnit=unit==='mile'?'mi':'km';
  const number=(value,digits=1)=>Number(value).toLocaleString(lang,{maximumFractionDigits:digits});
  const distance=(value,digits=1)=>Number.isFinite(value)?`${number(value/factor,digits)} ${distanceUnit}`:'—';
  const duration=value=>Number.isFinite(value)?`${Math.floor(value/3600)}:${String(Math.floor(value%3600/60)).padStart(2,'0')}:${String(Math.round(value%60)).padStart(2,'0')}`:'—';
  const pick=useCallback(async selection=>{
    const ids=Array.isArray(selection)?selection:selection.ids,total=Array.isArray(selection)?selection.length:selection.total;
    pickRequest.current?.abort();const controller=new AbortController();pickRequest.current=controller;
    setPanel(null);setHighlight(null);setCoverage({state:'loading'});setCandidates(ids);setChoices(previous=>previous.filter(item=>ids.includes(String(item.id))));setCandidateCount(total);setPicked({id:ids[0],state:'loading'});
    try {
      const {model,filters}=latest.current,snapshot=model.data.snapshot;
      const [value,items]=await Promise.all([loadWorkout(ids[0],snapshot,controller.signal),loadWorkoutChoices(ids,snapshot,filters,controller.signal)]);
      const summary=items.find(item=>String(item.id)===String(ids[0]));if(!summary)throw new Error('Workout no longer matches');
      if(!controller.signal.aborted){
        setChoices(items);setPicked({...value,...summary,state:'ready'});
        void loadWorkoutTiles(ids[0],snapshot,controller.signal).then(page=>{if(!controller.signal.aborted)setCoverage({...page,state:'ready'});}).catch(()=>{if(!controller.signal.aborted)setCoverage({state:'error'});});
      }
    } catch {if(!controller.signal.aborted)setPicked({id:ids[0],state:'error'});}
  },[]);
  const startLabel=tr('start');
  useEffect(()=>{
    let retired=false,instance;
    setMapReady(false);initialFit.current=false;setMapError(false);
    import('leaflet').then(module=>{
      if(retired)return;
      instance=createWorkoutMap(module.default||module,node.current,{onPick:pick,onReady:()=>setMapReady(true),onError:()=>setMapError(true),startLabel});
      renderer.current=instance;
      instance.update(latest.current.model.data.segments,latest.current.model.preferences,null,{complete:latest.current.model.data.state==='ready'});
      // Data may already have arrived while the map module loaded.
      const current=latest.current.model.data;if(current.snapshot&&!initialFit.current){initialFit.current=true;instance.fit(current.focusBounds||current.bounds);}
    }).catch(()=>{if(!retired)setMapError(true);});
    return ()=>{retired=true;instance?.destroy();renderer.current=null;pickRequest.current?.abort();};
  },[token,pick,startLabel,mapAttempt]);
  useEffect(()=>{
    renderer.current?.update(data.segments,viewPreferences,highlight,{complete:data.state==='ready'});
    if(data.snapshot&&renderer.current&&!initialFit.current){initialFit.current=true;renderer.current.fit(data.focusBounds||data.bounds);}
  },[data,viewPreferences,highlight]);
  useEffect(()=>{pickRequest.current?.abort();setPicked(null);setHighlight(null);setCandidates([]);setChoices([]);setCandidateCount(0);setDraft(filters);},[filters,token]);
  useEffect(()=>{
    const previous=selectionSnapshot.current;selectionSnapshot.current=data.snapshot;
    if(previous&&data.snapshot&&previous!==data.snapshot){
      if(picked)void pick({ids:candidates.length?candidates:[String(picked.id)],total:candidateCount});
      else if(highlight)setHighlight(null);
    }
  },[data.snapshot,pick,picked,candidates,highlight,candidateCount]);
  const popupOpen=!!picked;
  const popupState=picked?.state;
  useEffect(()=>{
    if(!panel&&!popupOpen)return undefined;
    const frame=requestAnimationFrame(()=>{if(!dialog.current?.contains(document.activeElement))dialog.current?.querySelector('button,input,select,a')?.focus();});
    return ()=>cancelAnimationFrame(frame);
  },[panel,popupOpen,popupState,model.notice]);
  function close() {
    pickRequest.current?.abort();setPicked(null);setCoverage({state:'idle'});setCandidates([]);setChoices([]);setPanel(null);setWeightDraft(null);
    (triggers.current[panel]||node.current)?.focus();
  }
  useEffect(()=>{
    const escape=event=>{if(event.key!=='Escape'||event.defaultPrevented||event.target.closest?.('.workout-map-account'))return;event.stopPropagation();if(panel||picked)close();else{setHighlight(null);node.current?.focus();}};
    document.addEventListener('keydown',escape);return()=>document.removeEventListener('keydown',escape);
  });
  function apply(value) {setPicked(null);setHighlight(null);setDraft(value);navigate({pathname:location.pathname,search:writeMapFilters(value)},{replace:true});}
  async function isolate(newTiles=false) {
    pickRequest.current?.abort();const controller=new AbortController();pickRequest.current=controller;
    const id=picked.id;setPicked(previous=>({...previous,state:'trackLoading'}));
    try {
      const [segments,cells]=await Promise.all([loadWorkoutTrack(id,data.snapshot,controller.signal),newTiles?loadNewWorkoutTiles(id,data.snapshot,controller.signal,coverage):Promise.resolve([])]);if(controller.signal.aborted)return;
      if(!segments.length){setPicked(previous=>({...previous,state:'noGps'}));return;}
      setHighlight({id,segments,cells});setPicked(null);setCandidates([]);
      requestAnimationFrame(()=>triggers.current.clear?.focus());
    } catch {if(!controller.signal.aborted)setPicked(previous=>({...previous,state:newTiles?'coverageFailed':'trackError'}));}
  }
  function toggleSummary(){setSummaryOpen(value=>!value);requestAnimationFrame(()=>triggers.current.summary?.focus());}
  function toggle(value){pickRequest.current?.abort();setPicked(null);setCandidates([]);setWeightDraft(null);setDraft(filters);setPanel(previous=>previous===value?null:value);}
  function commitWeight(event){const weight=Number(event.currentTarget.value);if(weightDraft!=null&&weight!==Number(preferences.weight))void model.savePreferences({weight});setWeightDraft(null);}
  const filterCount=Object.entries(filters).filter(([key,value])=>value!==''&&!(key==='sport'&&value==='RUN')).length;
  const invalid=invalidMapRange(draft);
  const run=picked||{},km=run.distanceKm==null?NaN:Number(run.distanceKm),seconds=run.movingSeconds??run.movingTimeSeconds;
  const pace=km>0&&seconds>0?seconds/(km/factor):null;
  const paceSeconds=pace==null?null:Math.floor(pace);
  const status=mapError?'mapError':['error','stale','unauthorized'].includes(data.state)?data.state:data.state==='loading'?'loading':data.summary?.activityCount===0?'empty':data.summary?.gpsActivityCount===0?'noGps':null;
  return <main className={`heatmap-page heatmap-page--simple workout-map${panel||picked?' has-panel':''}${summaryOpen?'':' is-summary-collapsed'}`}>
    <div ref={node} className="workout-map-surface" tabIndex={0} role="region" aria-label={tr('mapLabel')}/>
    {summaryOpen?<section className="workout-map-summary" aria-label={tr('summary')}>
      <div className="workout-map-summary-row">
        <div className="workout-map-heading"><h1>{tr('title')}</h1><span className="workout-map-total" aria-live="polite">{data.summary?`${number(data.summary.activityCount,0)} ${tr('workouts')} · ${distance(data.summary.distanceKm)}`:tr('loading')}</span></div>
        <div className="workout-map-tools">
          {['filters','display'].map(key=><button key={key} ref={element=>{triggers.current[key]=element;}} className={`workout-map-icon${panel===key?' is-active':''}${key==='filters'?' workout-map-filter-trigger':''}`} aria-label={tr(key)} aria-expanded={panel===key} aria-controls={panel===key?'workout-map-panel':undefined} onClick={()=>toggle(key)}>{key==='filters'?<AppIcon name="filter"/>:<MapControlIcon name="layers"/>}{key==='filters'?<span className="workout-map-filter-label">{tr(key)}</span>:null}{key==='filters'&&filterCount>0?<span className="workout-map-badge">{filterCount}</span>:null}</button>)}
          <button className="workout-map-icon workout-map-collapse" ref={element=>{triggers.current.summary=element;}} aria-label={tr('collapseSummary')} aria-expanded="true" onClick={toggleSummary}><MapControlIcon name="collapse"/></button>
        </div>
      </div>
      <DateShortcuts compact value={filters} zone={calendarZone} tr={tr} onChange={dates=>apply({...filters,...dates})}/>
    </section>:<button className="workout-map-summary-toggle" ref={element=>{triggers.current.summary=element;}} aria-label={tr('expandSummary')} aria-expanded="false" onClick={toggleSummary}><MapControlIcon name="pin"/>{filterCount>0?<span className="workout-map-badge">{filterCount}</span>:null}</button>}
    <nav className="workout-map-account" aria-label={tr('account')}>
      <Link className="workout-map-home" to="/profile" aria-label={tr('home')}><AppIcon name="dashboard"/></Link>
      <TopbarNotifications onOpenRuns={()=>navigate('/runs')}/>
      <Link to="/settings" aria-label={t('settings.heading')}><AppIcon name="settings"/></Link>
      <TopbarUserMenu initials={(email||'H').slice(0,1).toUpperCase()}/>
    </nav>
    <div className="workout-map-zoom">
      <button aria-label={tr('zoomIn')} disabled={!mapReady} onClick={()=>renderer.current?.zoom(1)}>+</button>
      <button aria-label={tr('zoomOut')} disabled={!mapReady} onClick={()=>renderer.current?.zoom(-1)}>−</button>
      <button aria-label={tr('fit')} disabled={!mapReady||!data.bounds} onClick={()=>renderer.current?.fit(data.bounds)}><MapControlIcon name="fit"/></button>
    </div>
    {highlight?<button className="workout-map-clear" aria-label={tr('clearHighlight')} ref={element=>{triggers.current.clear=element;}} onClick={()=>{setHighlight(null);node.current?.focus();}}>{tr('clearHighlight')} ×</button>:null}
    {status&&!panel?<div className="workout-map-status" role={['error','stale','unauthorized','mapError'].includes(status)?'alert':'status'}>{tr(status)}{['error','stale','mapError'].includes(status)?<button onClick={()=>{model.retry();if(mapError)setMapAttempt(value=>value+1);}}>{tr('retry')}</button>:null}</div>:null}
    {panel?<section ref={dialog} id="workout-map-panel" className="workout-map-panel" aria-label={tr(panel)}>
      <header><h1>{tr(panel)}</h1><button className="workout-map-icon" aria-label={tr('close')} onClick={close}>×</button></header>
      {status?<div className="workout-map-panel-notice" role={['error','stale','unauthorized','mapError'].includes(status)?'alert':'status'}>{tr(status)}{['error','stale','mapError'].includes(status)?<button onClick={()=>{model.retry();if(mapError)setMapAttempt(value=>value+1);}}>{tr('retry')}</button>:null}</div>:null}
      {panel==='filters'?<>
        <WorkoutFilters draft={draft} setDraft={setDraft} apply={apply} invalid={invalid} options={data.options} zone={calendarZone} tr={tr} factor={factor} distanceUnit={distanceUnit}>
        <details open={model.listOpen} onToggle={event=>model.setListOpen(event.currentTarget.open)}><summary>{tr('browse')}</summary>
          {model.list.items.map(item=><button type="button" className="workout-map-list-item" key={item.id} onClick={()=>pick([String(item.id)])}><strong>{item.name||tr('unnamed')}</strong><span>{item.date} · {distance(item.distanceKm)}</span></button>)}
          {model.list.state==='loading'?<p role="status">{tr('loading')}</p>:null}
          {model.list.state==='error'?<button type="button" onClick={model.retry}>{tr('retry')}</button>:null}
          {model.list.nextCursor?<button type="button" disabled={model.list.state==='loading'} onClick={model.loadMore}>{tr('more')}</button>:null}
        </details>
        </WorkoutFilters>
      </>:<WorkoutDisplay preferences={preferences} model={model} tr={tr} weightDraft={weightDraft} setWeightDraft={setWeightDraft} commitWeight={commitWeight} number={number}/>}
    </section>:null}
    {picked?<section ref={dialog} className="workout-map-panel workout-map-popup" role="dialog" aria-modal="false" aria-label={tr('workout')}>
      <header><h1>{run.name||tr('workout')}</h1><button className="workout-map-icon" aria-label={tr('close')} onClick={close}>×</button></header>
      {candidates.length>1?<label>{tr('overlap')}<select aria-label={tr('overlap')} disabled={run.state==='loading'} value={String(run.id)} onChange={event=>{const ids=[event.target.value,...candidates.filter(id=>id!==event.target.value)];pick({ids,total:candidateCount});}}>{(choices.length?choices:candidates.map(id=>({id}))).map(item=><option key={item.id} value={String(item.id)}>{item.name?`${item.name} · ${item.date||tr('notRecorded')} · ${distance(item.distanceKm)}`:tr('loading')}</option>)}</select></label>:null}
      {candidateCount>candidates.length?<p className="workout-map-overlap-note">{tr('overlapLimited')} <button onClick={()=>{toggle('filters');model.setListOpen(true);}}>{tr('browseAll')}</button></p>:null}
      {run.state==='loading'?<p role="status">{tr('loading')}</p>:run.state==='error'?<p role="alert">{tr('workoutError')}<button onClick={()=>pick({ids:candidates,total:candidateCount})}>{tr('retry')}</button></p>:<>
        <dl>{[[tr('distance'),distance(km,2)],[tr('moving'),duration(seconds)],[tr('pace'),paceSeconds!=null?`${Math.floor(paceSeconds/60)}:${String(paceSeconds%60).padStart(2,'0')} /${distanceUnit}`:'—'],[tr('speed'),Number.isFinite(km)&&seconds>0?`${number(km/factor/(seconds/3600),2)} ${distanceUnit}/h`:'—'],[tr('ascent'),(run.ascentM??run.totalElevationGain)!=null?`${number((run.ascentM??run.totalElevationGain)/(unit==='mile'?.3048:1))} ${unit==='mile'?'ft':'m'}`:'—'],[tr('date'),run.date||getActivityDateKey(run,data.zone)||'—'],[tr('shoes'),run.gear||run.shoeName||tr('notRecorded')],[tr('sourceGear'),run.sourceGear||tr('notRecorded')],[tr('device'),run.device||tr('notRecorded')],[tr('source'),run.provider||'—'],[tr('tileCounts'),coverage.state==='loading'?'…':`${coverage.tileCount??'—'} / ${coverage.newTileCount??'—'}`]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
        {coverage.state==='error'?<p role="status">{tr('coverageError')} <button onClick={()=>pick({ids:candidates,total:candidateCount})}>{tr('coverageRetry')}</button></p>:<p className="workout-map-overlap-note">{tr('tileBasis')}</p>}
        {coverage.newTileCount>MAP_TOKENS.coverageMaxCells?<p role="status">{tr('coverageLarge')}</p>:null}
        <div className="workout-map-actions"><button disabled={run.state==='trackLoading'} onClick={()=>isolate()}>{tr(run.state==='trackLoading'?'loading':'highlight')}</button><button disabled={run.state==='trackLoading'||coverage.state!=='ready'||!(coverage.newTileCount>0)||coverage.newTileCount>MAP_TOKENS.coverageMaxCells} onClick={()=>isolate(true)}>{tr('newCoverage')}</button><Link to={`/runs/${encodeURIComponent(run.id)}`}>{tr('details')}</Link></div>
        {['noGps','trackError'].includes(run.state)?<p role="status">{tr(run.state)}</p>:null}
        {run.state==='coverageFailed'?<p role="status">{tr('coverageError')}</p>:null}
      </>}
    </section>:null}
  </main>;
}
