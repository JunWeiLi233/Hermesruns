import {calendarPeriod} from './workoutMapModel';

const PERIODS=['allTime','thisYear','last30','last7','thisMonth','lastMonth'];

export function DateShortcuts({value,zone,onChange,tr,compact=false}) {
  const active=PERIODS.find(key=>{
    if(key!=='allTime'&&!zone)return false;
    const dates=calendarPeriod(key,zone);
    return (value.from||'')===dates.from&&(value.to||'')===dates.to;
  });
  return <div className={compact?'workout-map-dates':'workout-map-chips'} role={compact?'group':undefined} aria-label={compact?tr('quickDates'):undefined}>
    {(compact?PERIODS.slice(0,3):PERIODS).map(key=><button type="button" key={key} disabled={key!=='allTime'&&!zone} aria-pressed={active===key} onClick={()=>onChange(calendarPeriod(key,zone))}>{tr(key)}</button>)}
  </div>;
}

export function MapControlIcon({name}) {
  const paths={layers:'m12 4 8 4-8 4-8-4 8-4Z M4 12l8 4 8-4 M4 16l8 4 8-4',collapse:'M20 10h-6V4 M14 10l7-7 M4 14h6v6 M10 14l-7 7',fit:'M4 9V5a1 1 0 0 1 1-1h4 M15 4h4a1 1 0 0 1 1 1v4 M20 15v4a1 1 0 0 1-1 1h-4 M9 20H5a1 1 0 0 1-1-1v-4',pin:'M12 21s6-6 6-11a6 6 0 1 0-12 0c0 5 6 11 6 11Z M14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0'};
  return <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]}/></svg>;
}

const SWATCHES=['#a0392a','#e34b0b','#1c1917','#3072d6'];

export function WorkoutDisplay({preferences,model,tr,weightDraft,setWeightDraft,commitWeight,number}) {
  return <>
    <div className="workout-map-panel-body">
      <fieldset disabled={!model.settingsReady||model.notice==='saving'}>
        {['mode','basemap'].map(key=><fieldset className="workout-map-choice-group" key={key}>
          <legend>{tr(key)}</legend>
          <div className="workout-map-choice-grid">
            {(key==='mode'?['lines','heat']:['streets','dark']).map(value=><label className="workout-map-choice" key={value}>
              <input type="radio" name={key} aria-label={tr(value)} checked={preferences[key]===value} onChange={()=>model.savePreferences({[key]:value})}/>
              <span className="workout-map-choice-content">
                {key==='mode'?<svg className={`workout-map-route-preview is-${value}`} viewBox="0 0 140 64" aria-hidden="true"><path d="M9 50h25V19h35v24h39V12h22 M9 54h30V24h35v21h39V15 M16 18h38v24h36v12" fill="none" stroke={preferences.color} strokeWidth={value==='heat'?5:1.5} strokeOpacity={value==='heat'?.3:.8} strokeLinecap="round" strokeLinejoin="round"/></svg>:<span aria-hidden="true" className={`workout-map-base-preview is-${value}`}/>}
                <strong>{tr(value)}</strong>
              </span>
            </label>)}
          </div>
        </fieldset>)}
        <label className="workout-map-width"><span>{tr('weight')}<output>{number(weightDraft??preferences.weight,2)}</output></span><input aria-label={tr('weight')} type="range" min="0.75" max="6" step="0.05" value={weightDraft??preferences.weight} onChange={event=>setWeightDraft(Number(event.target.value))} onPointerUp={commitWeight} onPointerCancel={()=>setWeightDraft(null)} onBlur={commitWeight} onKeyUp={event=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End','PageUp','PageDown'].includes(event.key))commitWeight(event);}}/><span className="workout-map-range-ends"><span>{tr('fine')}</span><span>{tr('bold')}</span></span></label>
        <fieldset className="workout-map-colors"><legend>{tr('colors')}</legend>
          {['color','hoverColor','highlightColor'].map(key=><div className="workout-map-color" key={key}>
            <span>{tr(key)}</span><div className="workout-map-swatches" role="group" aria-label={tr(key)}>
              {SWATCHES.map(color=><button type="button" className="workout-map-swatch" key={color} style={{'--swatch':color}} aria-label={`${tr(key)} ${color}`} aria-pressed={preferences[key]===color} onClick={()=>model.savePreferences({[key]:color})}/>)}
              <label className={`workout-map-custom-color${SWATCHES.includes(preferences[key])?'':' is-selected'}`}><span className="workout-map-sr">{tr(key)}</span><input aria-label={tr(key)} type="color" value={preferences[key]} onChange={event=>model.savePreferences({[key]:event.target.value})}/></label>
            </div>
          </div>)}
        </fieldset>
      </fieldset>
    </div>
    <footer className="workout-map-save" role="status"><span className={model.notice?'is-pending':''} aria-hidden="true"/>{tr(model.notice||(!model.settingsReady?'loading':'saved'))}{model.notice&&model.notice!=='saving'?<button onClick={model.retry}>{tr('retry')}</button>:null}</footer>
  </>;
}
