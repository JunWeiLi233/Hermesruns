import { DEFAULT_PREFS, EMPTY_FILTER, filterErrors, selectActivities, sortActivities, statistics, totals, validZone } from './model.js';
import { IMPORT_LIMITS, parseActivity, validateFiles } from './parser.js';
import { seedActivities } from './seed.js';
import { freshWorkspace, indexedStore } from './store.js';
const sleepTick=()=>new Promise(resolve=>setTimeout(resolve,0));
export class ExplorerError extends Error { constructor(message,status=400){super(message);this.status=status;} }

// Implements the planned service boundary locally. No module network calls or fake email/auth successes.
// Screens call only these methods. A server adapter can implement this exact interface.
export function createLocalApi(store=indexedStore(), {digest=async bytes=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(n=>n.toString(16).padStart(2,'0')).join(''), parse=parseActivity, locks=globalThis.navigator?.locks}={}) {
  const listeners=new Set(); let chain=Promise.resolve(); const running=new Set();
  const channel=typeof BroadcastChannel!=='undefined'?new BroadcastChannel('hermes-explorer-local-v1'):null;
  channel?.unref?.();
  channel?.addEventListener('message',()=>listeners.forEach(fn=>fn()));
  const notify=()=>{listeners.forEach(fn=>fn());channel?.postMessage('changed');};
  const transaction=fn=>{
    const task=()=>locks?locks.request('hermes-explorer-local-v1',()=>fn()):fn();
    const result=chain.then(task,task);chain=result.catch(()=>{});return result;
  };
  const mutate=fn=>transaction(async()=>{const state=await store.load();const result=await fn(state);await store.save(state);notify();return result;});
  const requireOpen=state=>{if(!state.opened||state.receipt)throw new ExplorerError('Open your local workspace to continue.',401);};
  const owned=async()=>{const state=await store.load();requireOpen(state);return state;};
  const acknowledgeCancel=job=>{job.state='cancelled';for(const file of job.files)if(['queued','parsing'].includes(file.state)){file.state='cancelled';delete file.blob;}};
  async function runJob(id) {
    if(running.has(id))return;running.add(id);
    try{
      for(;;){
        const before=await store.load();const job=before.jobs.find(j=>j.id===id);
        if(!job||job.state==='complete'||job.state==='cancelled'||job.state==='failed'||before.receipt)return;
        const index=job.files.findIndex(file=>file.state==='queued'||file.state==='parsing');
        if(job.cancelRequested||index<0){await mutate(s=>{const j=s.jobs.find(j=>j.id===id);if(j){if(job.cancelRequested)acknowledgeCancel(j);else j.state=j.files.some(f=>f.state==='failed')?'failed':'complete';j.finishedAt=new Date().toISOString();}});return;}
        await mutate(s=>{const j=s.jobs.find(j=>j.id===id);if(j){j.state='parsing';j.files[index].state='parsing';}});
        await sleepTick();
        // The source and its checkpoint survive reload in IndexedDB. Parsing never samples tracks.
        const file=job.files[index];
        try{
          const buffer=await file.blob.arrayBuffer();const hash=file.hash||await digest(buffer);const activity=await parse(new TextDecoder().decode(buffer),file.name);
          await transaction(async()=>{
            const state=await store.load();if(state.receipt)return;
            const current=state.jobs.find(j=>j.id===id);if(!current)return;
            if(current.cancelRequested){acknowledgeCancel(current);await store.save(state);notify();return;}
            const target=current.files[index];const existing=state.activities.find(a=>a.source.hash===hash);
            if(existing){target.state='duplicate';target.activityId=existing.id;}
            else{
              if(state.activities.reduce((n,a)=>n+a.pointCount,0)+activity.pointCount>IMPORT_LIMITS.historyPoints)throw new ExplorerError('This local workspace is limited to 500,000 total points. The file was not saved.');
              activity.id=state.nextId++;activity.source.hash=hash;activity.source.attestedAt=new Date().toISOString();state.activities.push(activity);target.state='complete';target.activityId=activity.id;state.revision++;
            }
            delete target.blob;current.state='queued';await store.save(state,{asset:existing?undefined:{hash,file:file.blob}});notify();
          });
        }catch(error){await mutate(s=>{const j=s.jobs.find(j=>j.id===id);if(j){j.files[index].state='failed';j.files[index].error=error.message;delete j.files[index].blob;}});}
      }
    }finally{running.delete(id);}
  }
  async function recover(){const s=await store.load();if(s.receipt?.state==='purging')await purge();else for(const job of s.jobs)if(['queued','parsing'].includes(job.state))void runJob(job.id);}
  async function purge(){await transaction(async()=>{const state=await store.load();if(!state.receipt)return;const receipt={...state.receipt,state:'complete',completedAt:new Date().toISOString()};const empty=freshWorkspace();empty.receipt=receipt;await store.save(empty,{clear:true});notify();});}
  const api={
    mode:'local',
    async login(){throw new ExplorerError('Account sign-in needs the Hermes backend. No session was created.',503);},
    async requestPasswordReset(){throw new ExplorerError('Account recovery needs the Hermes mail service. No message was sent.',503);},
    subscribe(fn){listeners.add(fn);return()=>listeners.delete(fn);},
    dispose(){channel?.close();listeners.clear();},
    async bootstrap(){await recover();const state=await store.load();return {opened:state.opened,preferences:state.preferences,filter:state.filter,receipt:state.receipt,revision:state.revision,historyCount:state.activities.length};},
    async openWorkspace(){return mutate(s=>{s.opened=true;s.receipt=null;return {opened:true};});},
    async closeWorkspace(){return mutate(s=>{s.opened=false;});},
    async loadExamples(){return mutate(s=>{requireOpen(s);if(s.activities.length)throw new ExplorerError('Examples can only be added to an empty workspace.');s.activities=seedActivities();s.nextId=9;s.revision++;});},
    async getActivities({filter,sort='startTime',descending=true,cursor=0,limit=1000}={}){
      const s=await owned();const selected=selectActivities(s.activities,filter||s.filter,s.preferences.zone);
      const rows=sortActivities(selected,sort,descending);const offset=Number(cursor)||0;
      return {items:rows.slice(offset,offset+limit),total:rows.length,nextCursor:offset+limit<rows.length?offset+limit:null,revision:s.revision,historyCount:s.activities.length};
    },
    async getView(){const s=await owned();const items=selectActivities(s.activities,s.filter,s.preferences.zone);return {items,summary:{...totals(items),cells:new Set(items.flatMap(a=>a.cells)).size},statistics:statistics(items,s.preferences.zone),filter:s.filter,preferences:s.preferences,options:{gear:[...new Set(s.activities.map(a=>a.gear).filter(Boolean))]},historyCount:s.activities.length,revision:s.revision};},
    async getActivity(id){const s=await owned();const a=s.activities.find(a=>String(a.id)===String(id));if(!a)throw new ExplorerError('This activity is unavailable.',404);return {activity:a,revision:s.revision};},
    async getTrack(id){const {activity,revision}=await api.getActivity(id);return {segments:activity.segments,quality:activity.quality,revision};},
    async getSummary(filter){const s=await owned();const rows=selectActivities(s.activities,filter||s.filter,s.preferences.zone);return {...totals(rows),cells:new Set(rows.flatMap(a=>a.cells)).size,revision:s.revision};},
    async getStatistics(section='all',filter){const s=await owned();const result=statistics(selectActivities(s.activities,filter||s.filter,s.preferences.zone),s.preferences.zone);return {section,data:section==='all'?result:result[section],revision:s.revision};},
    async getFilterOptions(){const s=await owned();return {gear:[...new Set(s.activities.map(a=>a.gear).filter(Boolean))],sports:[...new Set(s.activities.map(a=>a.sport))]};},
    async setFilter(filter){if(Object.keys(filterErrors(filter)).length)throw new ExplorerError('Correct the filter fields before applying.');return mutate(s=>{requireOpen(s);s.filter={...EMPTY_FILTER,...filter};return s.filter;});},
    async getPreferences(){return (await owned()).preferences;},
    async updatePreferences(prefs){
      if(!validZone(prefs.zone)||!['km','mi'].includes(prefs.units)||!['light','dark','system'].includes(prefs.theme)||!['distance','moving','ascent'].includes(prefs.metric)||!['en','zh-CN'].includes(prefs.language)||!['USD','EUR','GBP','CNY','JPY','CAD','AUD'].includes(prefs.currency)||prefs.annualGoalKm!==''&&(!Number.isFinite(Number(prefs.annualGoalKm))||Number(prefs.annualGoalKm)<0))throw new ExplorerError('Check the units, time zone and annual goal.');
      return mutate(s=>{requireOpen(s);s.preferences={...s.preferences,...prefs,hideFromClubs:true,reportsEnabled:false};s.revision++;return s.preferences;});
    },
    async getJobs(){const s=await owned();return {items:s.jobs.map(({files,...j})=>({...j,files:files.map(({blob:_blob,...f})=>f)})).reverse(),revision:s.revision};},
    async getJob(id){const result=await api.getJobs();const job=result.items.find(j=>j.id===id);if(!job)throw new ExplorerError('Import request is unavailable.',404);return job;},
    async importActivities({files,attested,idempotencyKey=crypto.randomUUID()}){
      if(!attested)throw new ExplorerError('Confirm you have permission to use the source files.');validateFiles(files);
      await owned();const entries=[];
      for(const file of files)entries.push({name:file.name,size:file.size,state:'queued',blob:file,hash:await digest(await file.arrayBuffer())});
      const fingerprint=JSON.stringify(entries.map(file=>({name:file.name,hash:file.hash})));
      const result=await mutate(s=>{requireOpen(s);const existing=s.jobs.find(j=>j.idempotencyKey===idempotencyKey);if(existing){if(existing.fingerprint!==fingerprint)throw new ExplorerError('This import key was used for different files.',409);return existing.id;}
        if(s.jobs.some(j=>['queued','parsing'].includes(j.state)))throw new ExplorerError('Wait for the current batch or cancel it before adding another.',409);
        const id=crypto.randomUUID();s.jobs.push({id,idempotencyKey,fingerprint,state:'queued',createdAt:new Date().toISOString(),cancelRequested:false,files:entries});return id;});
      void runJob(result);return {id:result};
    },
    async cancelJob(id){return mutate(s=>{requireOpen(s);const job=s.jobs.find(j=>j.id===id);if(!job)throw new ExplorerError('Import request is unavailable.',404);if(['complete','failed','cancelled'].includes(job.state))return job;job.cancelRequested=true;return job;});},
    async getConnections(){await owned();return {items:[],capabilities:{provider:false,email:false}};},
    async updateEmailPreferences(){throw new ExplorerError('Report address verification needs the backend mail service. No email was changed.',503);},
    async unsubscribe(){throw new ExplorerError('Signed email links need the backend mail service. Local monthly delivery is already off.',503);},
    async deleteWorkspace({confirmation}){if(confirmation!=='DELETE')throw new ExplorerError('Type DELETE to remove this browser workspace.');const receipt=await mutate(s=>{requireOpen(s);s.opened=false;s.receipt={id:crypto.randomUUID(),state:'purging',requestedAt:new Date().toISOString()};return s.receipt;});void purge();return receipt;},
    async getDeletionReceipt(){return (await store.load()).receipt;},
    async resetFilters(){return api.setFilter({...EMPTY_FILTER});},
    defaults:DEFAULT_PREFS,
  };
  return api;
}
