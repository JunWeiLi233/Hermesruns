import {useCallback,useEffect,useRef,useState} from 'react';
import {Link,useNavigate} from 'react-router';
import {useI18n} from '../../contexts/I18nContext';
import {useUnit} from '../../contexts/UnitContext';
import {apiJson} from '../../api';
import {invalidateResourceCache} from '../../api/resourceCache';
import HermesLogo from '../../components/HermesLogo';
import TopbarUserMenu from '../../components/TopbarUserMenu';
import Modal from '../../components/Modal';
import {formatDistance} from '../../utils/format';
import {localMinute,manualPayload,resolveLocalStarts,validateGoal} from './planForm';
import './training-plan.css';

const kinds={REST:'rest',RECOVERY:'recovery',EASY:'easy',LONG_RUN:'long',TEMPO:'tempo',THRESHOLD:'tempo',INTERVALS:'intervals',CROSS_TRAIN:'recovery'};
export default function TrainingPlan(){
  const {t,lang}=useI18n();const {unit}=useUnit();const navigate=useNavigate();const text=(key,params)=>t(`run_plan.${key}`,params);
  const [data,setData]=useState(null);const [schedule,setSchedule]=useState([]);const [error,setError]=useState('');const [notice,setNotice]=useState('');const [loading,setLoading]=useState(true);
  const [goalOpen,setGoalOpen]=useState(false);const [runOpen,setRunOpen]=useState(false);const [review,setReview]=useState(false);const [busy,setBusy]=useState(false);const busyRef=useRef(false);
  const [goal,setGoal]=useState({distance:'5',date:'',name:''});const [run,setRun]=useState({start:localMinute(),distance:'',hours:'0',minutes:'',seconds:'0',name:'',occurrence:'0'});
  const [saved,setSaved]=useState(null);const saveKey=useRef(null);const requestRef=useRef(null);const mounted=useRef(true);
  const load=useCallback(async()=>{
    setLoading(true);setError('');
    try{const [today,rows]=await Promise.all([apiJson('/api/coach/today'),apiJson('/api/coach/schedule?days=14')]);
      if(!Array.isArray(rows)||!today||typeof today!=='object')throw new Error('Invalid response');
      if(mounted.current){setData(today);setSchedule(rows);}
    }catch{if(mounted.current)setError('load_error');}finally{if(mounted.current)setLoading(false);}
  },[]);
  useEffect(()=>{mounted.current=true;load();return()=>{mounted.current=false;};},[load]);
  const block=data?.state?.activeBlock;
  const today=data?.today;
  const dayKey=schedule[0]?.scheduledDate||localMinute().slice(0,10);
  const distance=km=>Number.isFinite(km)&&km>0?formatDistance(km,1,lang,unit):text('flexible');
  const workoutName=value=>text(kinds[value]||'run');
  const dateLabel=value=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return text('unavailable');return new Intl.DateTimeFormat(lang==='zh-CN'?'zh-CN':'en-US',{month:'short',day:'numeric',weekday:'short',timeZone:'UTC'}).format(new Date(`${value}T12:00:00Z`));};
  async function startGoal(){
    if(busyRef.current)return;const invalid=validateGoal(goal,dayKey);if(invalid){setError(invalid);return;}
    if(!review){setReview(true);return;}
    busyRef.current=true;setBusy(true);setError('');
    try{await apiJson('/api/coach/training-block',{method:'POST',body:JSON.stringify({raceDistanceKm:Number(goal.distance),targetRaceDate:goal.date,name:goal.name.trim()})});
      invalidateResourceCache('/api/coach');setGoalOpen(false);setReview(false);setNotice('goal_saved');await load();
    }catch{setError('goal_error');}finally{busyRef.current=false;setBusy(false);}
  }
  async function saveRun(){
    if(busyRef.current)return;
    const parsed=manualPayload(run,unit,saveKey.current);if(parsed.error){setError(parsed.error);return;}
    const value=parsed.value;
    const canonical=JSON.stringify({...value,clientKey:null});
    if(requestRef.current&&requestRef.current!==canonical){setError('retry_edited');return;}
    requestRef.current=canonical;busyRef.current=true;setBusy(true);setError('');
    try{const result=await apiJson('/api/manual-runs',{method:'POST',body:JSON.stringify(value)});
      if(!result?.id)throw new Error('Missing saved run');
      invalidateResourceCache('/api/activities');invalidateResourceCache('/api/coach');setSaved(result);setRunOpen(false);setNotice('run_saved');await load();
    }catch(e){setError(e?.status===409?'save_conflict':e?.status===410?'run_deleted':e?.status===401?'signin_again':'save_error');}
    finally{busyRef.current=false;setBusy(false);}
  }
  function openRun(){saveKey.current=crypto.randomUUID();requestRef.current=null;setRun({start:localMinute(),distance:'',hours:'0',minutes:'',seconds:'0',name:text('manual_name'),occurrence:'0'});setError('');setRunOpen(true);}
  const updateRun=(field,value)=>setRun(prev=>({...prev,[field]:value,...(field==='start'?{occurrence:'0'}:{})}));
  const starts=resolveLocalStarts(run.start);
  return <div className="plan-hub">
    <header className="plan-hub__header"><Link to="/profile" aria-label={text('home')}><HermesLogo variant="horizontal" className="plan-hub__logo"/></Link><nav aria-label={text('navigation')}><Link to="/today-run">{text('today')}</Link><Link to="/training-plan" aria-current="page">{text('title')}</Link><Link to="/runs">{text('runs')}</Link></nav><TopbarUserMenu/></header>
    <main className="plan-hub__main"><section className="plan-hub__intro"><div><p className="plan-hub__eyebrow">{text('eyebrow')}</p><h1>{text('heading')}</h1><p>{text('intro')}</p></div><button className="plan-hub__primary" onClick={()=>{setError('');setReview(false);setGoal({distance:'5',date:'',name:text('goal_name')});setGoalOpen(true);}} disabled={loading||!!error&&!data}>{block?text('change_goal'):text('create_goal')}</button></section>
      {error&&!goalOpen&&!runOpen&&<div className="plan-hub__notice is-error" role="alert">{text(error)}<button onClick={load}>{text('retry')}</button></div>}
      {notice&&<div className="plan-hub__notice" role="status">{text(notice)}{saved&&<Link to={`/runs/${saved.id}`}>{text('view_run')}</Link>}</div>}
      {loading&&!data?<p className="plan-hub__loading" role="status">{text('loading')}</p>:data&&<>
        <div className="plan-hub__grid"><section className="plan-hub__session" aria-labelledby="session-title"><div className="plan-hub__row"><p className="plan-hub__eyebrow">{text('today_session')}</p><span className="plan-hub__badge">{dateLabel(today?.scheduledDate||dayKey)}</span></div><h2 id="session-title">{today?workoutName(today.workoutType):text('no_session')}</h2><p>{today?.workoutType==='REST'?text('rest_detail'):today?text('session_detail'):text('unavailable')}</p>
          {today&&today.workoutType!=='REST'&&<dl className="plan-hub__metrics"><div><dt>{text('distance')}</dt><dd>{distance(today?.plannedDistanceKm)}</dd></div><div><dt>{text('duration')}</dt><dd>{today?.plannedDurationMinutes>0?text('minutes_value',{minutes:today.plannedDurationMinutes}):text('flexible')}</dd></div></dl>}
          <Link className="plan-hub__primary" to="/today-run">{text('view_session')}</Link><button className="plan-hub__secondary" onClick={openRun}>{text('log_run')}</button></section>
          <aside className="plan-hub__goal" aria-labelledby="goal-title"><p className="plan-hub__eyebrow">{text('current_goal')}</p><h2 id="goal-title">{block?.name||text('general_training')}</h2><p>{block?text('goal_summary',{distance:distance(block.raceDistanceKm),date:dateLabel(block.targetRaceDate)}):text('no_goal')}</p><dl className="plan-hub__metrics"><div><dt>{text('weekly_target')}</dt><dd>{distance(data.plan?.targetWeeklyKm)}</dd></div><div><dt>{text('sessions')}</dt><dd>{data.plan?.sessionsPerWeek||text('unavailable')}</dd></div></dl><p className="plan-hub__muted">{text('history_basis')}</p><Link to="/schedule">{text('open_calendar')}</Link></aside></div>
        <section className="plan-hub__schedule" aria-labelledby="schedule-title"><div className="plan-hub__row"><div><p className="plan-hub__eyebrow">{text('next_two_weeks')}</p><h2 id="schedule-title">{text('week_heading')}</h2></div><button className="plan-hub__secondary" onClick={openRun}>{text('log_run')}</button></div><div className="plan-hub__days">{schedule.map(row=><article key={row.scheduledDate} className={row.workoutType==='REST'?'plan-hub__day is-rest':'plan-hub__day'}><time dateTime={row.scheduledDate}>{dateLabel(row.scheduledDate)}</time><h3>{workoutName(row.workoutType)}</h3><p>{row.workoutType==='REST'?text('no_run'):distance(row.plannedDistanceKm)}</p><span>{row.workoutType==='REST'?text('recovery_space'):row.plannedDurationMinutes>0?text('minutes_value',{minutes:row.plannedDurationMinutes}):text('flexible')}</span></article>)}</div></section>
      </>}
      <footer className="plan-hub__footer"><p>{text('planner_note')}</p><Link to="/settings/import-data">{text('import_runs')}</Link><Link to="/privacy">{text('privacy')}</Link></footer>
    </main>
    <Modal isOpen={goalOpen} onClose={()=>{if(!busyRef.current)setGoalOpen(false);}} title={review?text('review_goal'):text('create_goal')} closeLabel={text('close')} cardClassName="plan-hub-modal" portalToBody>
      <form className="plan-hub__form" onSubmit={e=>{e.preventDefault();startGoal();}}>{review?<><p>{text('review_detail')}</p><dl><dt>{text('goal')}</dt><dd>{goal.name}</dd><dt>{text('distance')}</dt><dd>{distance(Number(goal.distance))}</dd><dt>{text('race_date')}</dt><dd>{dateLabel(goal.date)}</dd></dl>{block&&<p className="plan-hub__notice">{text('replace_notice')}</p>}<p>{text('review_history')}</p></>:<><label>{text('goal_label')}<input value={goal.name} maxLength={120} onChange={e=>setGoal({...goal,name:e.target.value})} required autoFocus/></label><fieldset><legend>{text('choose_distance')}</legend><div className="plan-hub__choices">{[5,10].map(km=><label key={km}><input type="radio" name="distance" value={km} checked={Number(goal.distance)===km} onChange={()=>setGoal({...goal,distance:String(km)})}/>{distance(km)}</label>)}</div></fieldset><label>{text('race_date')}<input type="date" value={goal.date} min={dayKey} onChange={e=>setGoal({...goal,date:e.target.value})} required/></label><p className="plan-hub__muted">{text('review_history')}</p></>}
        {error&&<p role="alert" className="plan-hub__error">{text(error)}</p>}<button className="plan-hub__primary" disabled={busy}>{busy?text('saving'):review?text('use_goal'):text('review_goal')}</button>{review&&<button className="plan-hub__secondary" type="button" onClick={()=>setReview(false)} disabled={busy}>{text('edit_goal')}</button>}</form>
    </Modal>
    <Modal isOpen={runOpen} onClose={()=>{if(!busyRef.current)setRunOpen(false);}} title={text('log_run')} closeLabel={text('close')} cardClassName="plan-hub-modal" portalToBody>
      <form className="plan-hub__form" onSubmit={e=>{e.preventDefault();saveRun();}}><p>{text('manual_detail')}</p><label>{text('run_name')}<input value={run.name} maxLength={120} onChange={e=>updateRun('name',e.target.value)} required autoFocus disabled={busy||!!requestRef.current}/></label><label>{text('start_time')}<input type="datetime-local" value={run.start} onChange={e=>updateRun('start',e.target.value)} required disabled={busy||!!requestRef.current}/></label><p className="plan-hub__muted">{text('browser_zone',{zone:Intl.DateTimeFormat().resolvedOptions().timeZone})}</p>
        {starts.length>1&&<label>{text('time_occurrence')}<select value={run.occurrence} onChange={e=>updateRun('occurrence',e.target.value)} disabled={busy||!!requestRef.current}>{starts.map((instant,index)=><option value={index} key={instant}>{text(index===0?'first_occurrence':'second_occurrence')} · {new Intl.DateTimeFormat(lang,{timeZoneName:'shortOffset',hour:'numeric',minute:'numeric'}).format(new Date(instant))}</option>)}</select></label>}
        <label>{text('distance_unit',{unit:unit==='mile'?text('mile'):text('km')})}<input inputMode="decimal" type="number" min="0.001" step="any" value={run.distance} onChange={e=>updateRun('distance',e.target.value)} required disabled={busy||!!requestRef.current}/></label><fieldset><legend>{text('elapsed')}</legend><div className="plan-hub__time">{['hours','minutes','seconds'].map(field=><label key={field}>{text(field)}<input inputMode="numeric" type="number" min="0" max={field==='hours'?168:59} value={run[field]} onChange={e=>updateRun(field,e.target.value)} required disabled={busy||!!requestRef.current}/></label>)}</div></fieldset><p className="plan-hub__muted">{text('elapsed_detail')}</p>
        {error&&<p role="alert" className="plan-hub__error">{text(error)}</p>}<button className="plan-hub__primary" disabled={busy}>{busy?text('saving'):requestRef.current?text('retry_save'):text('save_run')}</button>{requestRef.current&&!busy&&<button type="button" className="plan-hub__secondary" onClick={()=>navigate('/runs')}>{text('check_history')}</button>}</form>
    </Modal>
  </div>;
}
