import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import {apiJson} from '../../api';
import {DEFAULT_MAP_PREFERENCES,MAP_TOKENS} from './workoutMapTokens';
import {STRAVA_SYNC_FINISHED_EVENT} from '../../utils/stravaAutoSync';
import {getHeatmapCacheKey,getHeatmapCacheWriteEpochStorageKey} from '../../utils/heatmap/cache';

const root='/api/profile/heatmap';
// Map query POSTs and GETs are read-only. Respect one server cooldown without
// replaying preference writes or leaving an obsolete view waiting in the queue.
async function read(url,options) {
  for(let attempt=0;;attempt++)try {return await apiJson(url,options);} catch(error){
    if(error.status!==429||attempt>=MAP_TOKENS.readThrottleRetries||options.signal?.aborted)throw error;
    const seconds=typeof error.retryAfter==='string'&&error.retryAfter.trim()!==''?Number(error.retryAfter):NaN;
    const delay=Number.isFinite(seconds)&&seconds>=0?Math.max(1,Math.ceil(seconds*1000)):MAP_TOKENS.readThrottleDefaultMs;
    if(delay>MAP_TOKENS.readThrottleMaxMs)throw error;
    await new Promise((resolve,reject)=>{
      const signal=options.signal,cancel=()=>{clearTimeout(timer);signal?.removeEventListener('abort',cancel);reject(new DOMException('Map read retired','AbortError'));};
      const timer=setTimeout(()=>{signal?.removeEventListener('abort',cancel);resolve();},delay);
      signal?.addEventListener('abort',cancel,{once:true});if(signal?.aborted)cancel();
    });
  }
}
const post=(url,body,signal)=>read(url,{method:'POST',body:JSON.stringify(body),headers:{'Content-Type':'application/json'},signal});

export default function useWorkoutMap(account,filters,accountEmail) {
  const filterKey=JSON.stringify(filters);
  const [attempt,retry]=useState(0),[settings,setSettings]=useState(null);
  const [data,setData]=useState({segments:[],state:'loading'});
  const [list,setList]=useState({items:[],state:'idle'});
  const [listOpen,setListOpen]=useState(false),[listPage,setListPage]=useState(null);
  const [notice,setNotice]=useState(null),saveRequest=useRef(null);
  const retained=useRef(null);
  useLayoutEffect(()=>{retained.current={account,filterKey,data};},[account,filterKey,data]);
  useEffect(()=>()=>saveRequest.current?.abort(),[account]);
  useEffect(()=>{
    const refresh=()=>retry(value=>value+1);
    const key=getHeatmapCacheKey(accountEmail),epochKey=key?getHeatmapCacheWriteEpochStorageKey(key):null;
    const storage=event=>{if(epochKey&&event.key===epochKey)refresh();};
    window.addEventListener(STRAVA_SYNC_FINISHED_EVENT,refresh);window.addEventListener('storage',storage);
    return()=>{window.removeEventListener(STRAVA_SYNC_FINISHED_EVENT,refresh);window.removeEventListener('storage',storage);};
  },[account,accountEmail]);
  useEffect(()=>{
    const controller=new AbortController();setSettings(previous=>previous?.account===account?previous:null);setNotice(null);
    read(root+'/preferences',{signal:controller.signal}).then(value=>{if(!controller.signal.aborted)setSettings({...value,account});})
      .catch(()=>{if(!controller.signal.aborted)setNotice('settingsError');});
    return ()=>controller.abort();
  },[account,attempt]);
  useEffect(()=>{
    const controller=new AbortController();let timer;
    setData(previous=>previous.account===account&&previous.filterKey===filterKey?{...previous,state:'loading'}:{account,filterKey,segments:[],state:'loading'});
    timer=setTimeout(async()=>{
      try {
        // Load all matching routes at the maximum supported detail once. The
        // renderer projects this retained geometry locally at every viewport.
        const query={filter:JSON.parse(filterKey),zoom:MAP_TOKENS.geometryZoom};let cursor=null,snapshot=null,parts=[];
        do {
          const page=await post(root+'/query',{...query,...(snapshot?{snapshot}:{}),...(cursor?{cursor}:{})},controller.signal);
          if(controller.signal.aborted)return;
          if(!Array.isArray(page.segments))throw new Error('invalid geometry');
          parts=parts.concat(page.segments);snapshot=page.snapshot;cursor=page.nextCursor;
          if(!page.complete&&!cursor)throw new Error('incomplete geometry');
          setData({...page,account,filterKey,segments:parts,state:cursor?'loading':'ready'});
        } while(cursor);
      } catch(error) {if(!controller.signal.aborted)setData(previous=>({...previous,segments:[],state:error.status===401?'unauthorized':error.status===409?'stale':'error'}));}
    },0);
    return ()=>{clearTimeout(timer);controller.abort();};
  },[account,filterKey,attempt]);
  useEffect(()=>{setListPage(null);setList({items:[],state:'idle'});},[account,filters,data.snapshot]);
  useEffect(()=>{
    if(!listOpen||!data.snapshot)return undefined;
    const controller=new AbortController();setList(previous=>({...previous,state:'loading'}));
    post(root+'/workouts/query',{filter:filters,snapshot:data.snapshot,...(listPage?{cursor:listPage}:{})},controller.signal)
      .then(value=>{if(!controller.signal.aborted)setList(previous=>({...value,account,filterKey,items:listPage?previous.items.concat(value.items):value.items,state:'ready'}));})
      .catch(()=>{if(!controller.signal.aborted)setList(previous=>({...previous,state:'error'}));});
    return ()=>controller.abort();
  },[account,filters,filterKey,data.snapshot,listOpen,listPage,attempt]);
  async function savePreferences(patch) {
    if(!settings||settings.account!==account)return;saveRequest.current?.abort();const controller=new AbortController();saveRequest.current=controller;
    const confirmed=settings;setSettings({...settings,preferences:{...settings.preferences,...patch}});setNotice('saving');
    try {
      const result=await apiJson(root+'/preferences',{signal:controller.signal,method:'PATCH',headers:{'Content-Type':'application/json','If-Match':String(settings.revision)},body:JSON.stringify(patch)});
      if(controller.signal.aborted)return;setSettings({...result,account});
      const current=retained.current;
      if(typeof result.snapshot==='string'&&current?.account===account&&current.data.account===account&&current.data.filterKey===current.filterKey&&current.data.state==='ready'&&current.data.snapshot===confirmed.snapshot){
        // The server accepted a display-only patch against this exact revision.
        // Retain geometry and adopt its opaque successor token for workout reads.
        setData(previous=>previous.account===account&&previous.snapshot===confirmed.snapshot&&previous.state==='ready'?{...previous,snapshot:result.snapshot}:previous);
      }else retry(value=>value+1);
      setNotice(null);
    } catch(error){if(!controller.signal.aborted){setSettings(confirmed);setNotice(error.status===409?'settingsConflict':'settingsError');}}
  }
  const ownSettings=settings?.account===account?settings:null;
  const ownData=data.account===account&&data.filterKey===filterKey?data:{segments:[],state:'loading'};
  const ownList=list.account===account&&list.filterKey===filterKey?list:{items:[],state:list.state==='error'?'error':'loading'};
  return {data:ownData,list:ownList,listOpen,setListOpen,loadMore:()=>setListPage(ownList.nextCursor),preferences:ownSettings?.preferences||DEFAULT_MAP_PREFERENCES,
    settingsReady:!!ownSettings,savePreferences,notice,retry:()=>retry(value=>value+1)};
}

export async function loadWorkout(id,snapshot,signal) {
  const detail=await read('/api/activities?id='+encodeURIComponent(id),{signal});
  const value=Array.isArray(detail)?detail.find(run=>String(run.id)===String(id)):detail;
  if(!value||String(value.id)!==String(id))throw new Error('Workout unavailable');
  return value;
}
export async function loadWorkoutChoices(ids,snapshot,filter,signal) {
  const result=await post(root+'/workouts/query',{ids,snapshot,filter},signal);
  if(result.snapshot!==snapshot||!Array.isArray(result.items))throw new Error('Workout selection changed');
  return result.items;
}
export async function loadWorkoutTrack(id,snapshot,signal) {
  let cursor=null,segments=[];
  do {
    const params=new URLSearchParams({snapshot,zoom:'20',...(cursor?{cursor}:{})});
    const page=await read(`${root}/workouts/${encodeURIComponent(id)}/track?${params}`,{signal});
    segments=segments.concat(page.segments);cursor=page.nextCursor;
    if(!page.complete&&!cursor)throw new Error('incomplete track');
  } while(cursor&&!signal.aborted);
  return segments;
}
export async function loadWorkoutTiles(id,snapshot,signal,cursor) {
  const params=new URLSearchParams({snapshot,...(cursor?{cursor}:{})});
  const page=await read(`${root}/workouts/${encodeURIComponent(id)}/tiles?${params}`,{signal});
  if(page.snapshot!==snapshot||page.tileZoom!==14||!Array.isArray(page.cells)||page.cells.length>500||page.cells.some(cell=>!Array.isArray(cell)||cell.length!==2||cell.some(value=>!Number.isInteger(value)||value<0||value>=2**page.tileZoom))||!page.complete&&!page.nextCursor)throw new Error('Coverage unavailable');
  return page;
}
export async function loadNewWorkoutTiles(id,snapshot,signal,first) {
  let page=first,cells=[],cursors=new Set();const count=first.newTileCount;
  if(first.snapshot!==snapshot||first.tileZoom!==MAP_TOKENS.coverageZoom)throw new Error('Coverage changed');
  if(!Number.isInteger(count)||count<0||count>MAP_TOKENS.coverageMaxCells)throw new Error('Coverage unavailable');
  while(true){
    if(signal.aborted)throw new Error('Coverage retired');
    if(page.newTileCount!==count)throw new Error('Coverage changed');cells=cells.concat(page.cells);
    if(cells.length>count)throw new Error('Coverage exceeds declared count');
    if(page.complete)break;
    if(cursors.has(page.nextCursor))throw new Error('Coverage cursor repeated');cursors.add(page.nextCursor);
    page=await loadWorkoutTiles(id,snapshot,signal,page.nextCursor);
  }
  if(cells.length!==count||new Set(cells.map(cell=>cell.join(':'))).size!==count)throw new Error('Coverage incomplete');
  return cells;
}
