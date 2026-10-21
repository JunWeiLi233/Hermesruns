import { DEFAULT_PREFS, EMPTY_FILTER } from './model.js';

// Only the cookie authenticates requests. The session-bound CSRF proof stays in memory.
export function createHttpApi({fetcher=globalThis.fetch.bind(globalThis),pollMs=4000}={}) {
  let csrf='',revision=null,last='',timer=null,checking=false,disposed=false;
  const listeners=new Set();
  const emit=()=>{if(!disposed)for(const listener of listeners)listener();};
  async function request(path,{method='GET',body,headers={},signal}={}) {
    const form=body instanceof FormData;
    const response=await fetcher(`/api/explorer${path}`,{method,credentials:'same-origin',cache:'no-store',signal,
      headers:{'X-Explorer-Request':'1',...(csrf?{'X-Explorer-CSRF':csrf}:{}),...(!form&&body!==undefined?{'Content-Type':'application/json'}:{}),...headers},
      ...(body!==undefined?{body:form?body:JSON.stringify(body)}:{})});
    const value=await response.json().catch(()=>({}));
    if(!response.ok){const error=Object.assign(new Error(value.message||value.error||`The service returned ${response.status}.`),{status:response.status});if(response.status===401||response.status===410){csrf='';revision=null;queueMicrotask(emit);}throw error;}
    return value;
  }
  async function bootstrap(){const data=await request('/session');csrf=data.csrf||'';return {...data,preferences:{...DEFAULT_PREFS,...data.preferences}};}
  async function mutation(path,body,method='POST',headers={}){const value=await request(path,{method,body,headers});emit();return value;}
  const api={
    mode:'server',defaults:DEFAULT_PREFS,
    async login(body){const result=await request('/session/login',{method:'POST',body});csrf=result.csrf;emit();return result;},
    signup:body=>request('/session/signup',{method:'POST',body}),
    requestPasswordReset:body=>request('/session/password-reset/request',{method:'POST',body}),
    confirmPasswordReset:body=>request('/session/password-reset/confirm',{method:'POST',body}),
    resendVerification:body=>request('/session/resend-verification',{method:'POST',body}),
    getPasswordRules:()=>request('/session/password-rules'),
    getAccountConfiguration:()=>request('/session/configuration'),
    bootstrap,
    async closeWorkspace(){await request('/session/logout',{method:'POST',body:{}});csrf='';revision=null;emit();},
    async getView(){
      for(let attempt=0;attempt<3;attempt++)try{
        const preferences=await request('/preferences');const expected=preferences.revision;
        const [page,summary,statistics,options]=await Promise.all([
          api.getActivities({limit:100,revision:expected}),api.getSummary(undefined,expected),api.getStatistics('all',undefined,expected),api.getFilterOptions(),
        ]);
        if([page,summary,statistics,options].some(data=>data.revision!==expected))continue;revision=expected;
        return {items:page.items,total:page.total,nextCursor:page.nextCursor,summary,statistics:statistics.data,options,filter:{...EMPTY_FILTER,...preferences.filter},preferences:{...DEFAULT_PREFS,...preferences.preferences},historyCount:page.historyCount,revision};
      }catch(error){if(error.status!==409||attempt===2)throw error;}
      throw Object.assign(new Error('Your history is updating. Reload the selection.'),{status:409});
    },
    getActivities:({filter,sort='startTime',descending=true,cursor=0,limit=100,revision:expected}={})=>request(`/activities${filter?'/query':''}?${new URLSearchParams({sort,descending,cursor,limit,...(expected!=null?{revision:expected}:{})})}`,filter?{method:'POST',body:filter}:{}),
    async getActivity(id){for(let attempt=0;attempt<3;attempt++)try{const data=await request(`/activities/${encodeURIComponent(id)}`);const track=await api.getTrack(id,data.revision);return {...data,activity:{...data.activity,...track}};}catch(error){if(error.status!==409||attempt===2)throw error;}},
    getTrack:(id,expected)=>request(`/activities/${encodeURIComponent(id)}/track${expected!=null?`?revision=${expected}`:''}`),
    getSummary:(_filter,expected)=>request(`/map/summary${expected!=null?`?revision=${expected}`:''}`),
    getStatistics:(section='all',_filter,expected)=>request(`/statistics/${encodeURIComponent(section)}${expected!=null?`?revision=${expected}`:''}`),
    getOverlay:(bounds,expected,{signal}={})=>request(`/map/query${expected!=null?`?revision=${expected}`:''}`,{method:'POST',body:bounds,signal}),
    getFilterOptions:()=>request('/filter-options'),
    setFilter:filter=>mutation('/filter',filter,'PUT',revision!=null?{'If-Match':String(revision)}:{}),
    resetFilters:()=>api.setFilter(EMPTY_FILTER),
    getPreferences:()=>request('/preferences'),
    updatePreferences(values){const allowed=['units','zone','theme','currency','metric','annualGoalKm','hideFromClubs','language'];return mutation('/preferences',Object.fromEntries(allowed.filter(key=>key in values).map(key=>[key,values[key]])),'PATCH',revision!=null?{'If-Match':String(revision)}:{});},
    getJobs:()=>request('/jobs'),getJob:id=>request(`/jobs/${encodeURIComponent(id)}`),cancelJob:id=>mutation(`/jobs/${encodeURIComponent(id)}/cancel`,{}),
    importActivities({files,attested,idempotencyKey}){const form=new FormData();for(const file of files)form.append('files',file);form.append('attested',String(attested));return mutation('/imports',form,'POST',{'Idempotency-Key':idempotencyKey});},
    getConnections:()=>request('/connections'),
    requestReportVerification:email=>mutation('/email-preferences/verification',{email}),
    updateEmailPreferences:values=>mutation('/email-preferences',values,'PATCH'),
    confirmReportEmail:token=>mutation('/public/verify-report-email',{token}),
    unsubscribe:token=>mutation('/public/unsubscribe',{token}),
    async deleteWorkspace(values){const result=await request('/account/deletion',{method:'POST',body:values});sessionStorage.setItem('explorer-deletion-receipt',result.token);csrf='';revision=null;emit();return result;},
    getDeletionReceipt(){const token=sessionStorage.getItem('explorer-deletion-receipt');return token?request('/public/deletion-receipt',{method:'POST',body:{token}}):Promise.resolve(null);},
    subscribe(listener){listeners.add(listener);if(!timer&&pollMs>0)timer=setInterval(async()=>{if(checking||disposed||document.visibilityState==='hidden')return;checking=true;try{const session=await bootstrap();let jobs=[];if(session.opened)jobs=(await api.getJobs()).items;const next=JSON.stringify([session.opened,session.revision,jobs.map(job=>[job.id,job.state,job.completed,job.cancelRequested])]);if(next!==last){last=next;emit();}}catch(error){if(error.status===401||error.status===410)emit();}finally{checking=false;}},pollMs);return()=>{listeners.delete(listener);if(!listeners.size){clearInterval(timer);timer=null;}};},
    dispose(){disposed=true;listeners.clear();clearInterval(timer);timer=null;csrf='';},
  };
  return api;
}
