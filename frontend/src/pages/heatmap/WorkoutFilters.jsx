import {ADVANCED_METRICS,BASIC_METRICS,readMapFilters} from './workoutMapModel';
import {DateShortcuts} from './WorkoutMapControls';

export default function WorkoutFilters({draft,setDraft,apply,invalid,options={},zone,tr,factor,distanceUnit,children}) {
  const change=(key,value)=>setDraft(previous=>({...previous,[key]:value}));
  const metrics=keys=><div className="workout-map-pair">{keys.map(key=>{
    const unit=key.endsWith('Km')?distanceUnit:key.endsWith('SpeedKmh')?`${distanceUnit}/h`:key.endsWith('AscentM')?(factor===1?'m':'ft'):key.endsWith('HeartRate')?'bpm':'';
    const scale=key.endsWith('Km')||key.endsWith('SpeedKmh')?factor:key.endsWith('AscentM')&&factor!==1?.3048:1;
    return <label key={key}>{tr(key)} {unit?`(${unit})`:''}<input type="number" min="0" step="any" value={draft[key]==null||draft[key]===''?'':Number((draft[key]/scale).toFixed(3))} onChange={event=>change(key,event.target.value===''?undefined:Number(event.target.value)*scale)}/></label>;
  })}</div>;
  return <form className="workout-map-filter-form" onSubmit={event=>{event.preventDefault();if(!invalid)apply(draft);}}>
    <div className="workout-map-panel-body">
    <label>{tr('search')}<input type="search" placeholder={tr('searchPlaceholder')} maxLength={160} value={draft.q} onChange={event=>change('q',event.target.value)}/></label>
    <fieldset className="workout-map-filter-section"><legend>{tr('dates')}</legend><DateShortcuts value={draft} zone={zone} tr={tr} onChange={dates=>setDraft(previous=>({...previous,...dates}))}/>
    <div className="workout-map-pair">{['from','to'].map(key=><label key={key}>{tr(key)}<input type="date" value={draft[key]} onChange={event=>change(key,event.target.value)}/></label>)}</div></fieldset>
    <fieldset className="workout-map-filter-section"><legend>{tr('sport')}</legend><div className="workout-map-chips">{['','RUN','NON_RUN','UNKNOWN'].map(key=><button type="button" aria-pressed={draft.sport===key} key={key} onClick={()=>change('sport',key)}>{tr(key||'allSports')}</button>)}</div></fieldset>
    <label>{tr('gear')}<select aria-label={tr('gear')} value={draft.gear} onChange={event=>change('gear',event.target.value)}>
      <option value="">{tr('allGear')}</option><option value="UNKNOWN">{tr('unknownGear')}</option>
      {Object.keys(options.gear||{}).length?<optgroup label={tr('shoes')}>{Object.entries(options.gear).map(([id,name])=><option key={id} value={id}>{name||tr('unknownGear')}</option>)}</optgroup>:null}
      {options.sourceGear?.length?<optgroup label={tr('sourceGear')}>{options.sourceGear.map(name=><option key={name} value={'source:'+name}>{name}</option>)}</optgroup>:null}
    </select></label>
    {metrics(BASIC_METRICS)}
    <details className="workout-map-advanced"><summary>{tr('advanced')}</summary>
      {['sourceSport','subtype'].map(key=><label key={key}>{tr(key)}<select aria-label={tr(key)} value={draft[key]||''} onChange={event=>change(key,event.target.value)}>
        <option value="">{tr('any')}</option><option value="UNKNOWN">{tr('notRecorded')}</option>
        {(options[key==='sourceSport'?'sourceSports':'subtypes']||[]).map(value=><option key={value} value={value}>{value}</option>)}
      </select></label>)}
      <div className="workout-map-pair">{['commute','trainer'].map(key=><label key={key}>{tr(key)}<select aria-label={tr(key)} value={draft[key]||''} onChange={event=>change(key,event.target.value)}>
        {['','yes','no','unknown'].map(value=><option key={value} value={value}>{tr(value===''?'any':value==='unknown'?'notRecorded':value)}</option>)}
      </select></label>)}</div>
      {metrics(ADVANCED_METRICS)}
    </details>
    {invalid?<p role="alert">{tr('invalidRange')}</p>:null}
    {children}
    </div>
    <footer className="workout-map-filter-footer"><button type="button" onClick={()=>apply(readMapFilters())}>{tr('clear')}</button><button className="workout-map-primary" type="submit" disabled={!!invalid}>{tr('apply')}</button></footer>
  </form>;
}
