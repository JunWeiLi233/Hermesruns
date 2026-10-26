/** Same named async methods as the local client. DTO identity mapping is the M0 integration gate. */
export const contracts = {
  getMe: ['GET', '/api/training/me'],
  updateProfile: ['PATCH', '/api/training/me'],
  login: ['POST', '/api/training/auth/login'],
  signup: ['POST', '/api/training/auth/signup'],
  logout: ['POST', '/api/training/auth/logout'],
  createTeam: ['POST', '/api/training/teams'],
  getRoster: ['GET', '/api/training/roster'],
  searchAthletes: ['GET', '/api/training/athletes/search'],
  getActivities: ['GET', '/api/training/athletes/{athleteId}/activities'],
  getActivity: ['GET', '/api/training/activities/{activityId}'],
  updateActivity: ['PATCH', '/api/training/activities/{activityId}'],
  saveIntervals: ['PUT', '/api/training/activities/{activityId}/intervals'],
  createManual: ['POST', '/api/training/athletes/{athleteId}/activities/manual'],
  getCalendar: ['GET', '/api/training/athletes/{athleteId}/calendar'],
  createEvent: ['POST', '/api/training/athletes/{athleteId}/events'],
  updateEvent: ['PATCH', '/api/training/events/{eventId}'],
  linkCompletion: ['POST', '/api/training/events/{eventId}/completion'],
  getFitness: ['GET', '/api/training/athletes/{athleteId}/fitness'],
  getWellness: ['GET', '/api/training/athletes/{athleteId}/wellness'],
  saveWellness: ['PUT', '/api/training/athletes/{athleteId}/wellness/{date}'],
  createFolder: ['POST', '/api/training/folders'],
  savePlan: ['POST', '/api/training/plans'],
  previewPlan: ['POST', '/api/training/plans/{planId}/applications/preview'],
  commitBulk: ['POST', '/api/training/bulk-operations/{operationId}/commit'],
  getRequests: ['GET', '/api/training/me/access-requests'],
  requestAccess: ['POST', '/api/training/athletes/{athleteId}/access-requests'],
  decideAccess: ['POST', '/api/training/access-relationships/{relationshipId}/decision'],
  getAccess: ['GET', '/api/training/me/access'],
  revokeAll: ['POST', '/api/training/me/access/revoke-all'],
  getTeams: ['GET', '/api/training/teams'],
  updateTeam: ['PATCH', '/api/training/teams/{teamId}'],
  updateMember: ['PATCH', '/api/training/teams/{teamId}/members/{userId}'],
  joinTeam: ['POST', '/api/training/teams/{teamId}/join-requests'],
  decideTeamConsent: ['PUT', '/api/training/teams/{teamId}/consent'],
  getJoinCard: ['GET', '/api/training/teams/by-slug/northfield'],
  getConversations: ['GET', '/api/training/conversations'],
  getMessages: ['GET', '/api/training/conversations/{conversationId}/messages'],
  sendMessage: ['POST', '/api/training/conversations/{conversationId}/messages'],
  getComparisons: ['GET', '/api/training/comparisons'],
  saveComparison: ['POST', '/api/training/comparisons'],
  getConnections: ['GET', '/api/training/connections'],
  getSeasons: ['GET', '/api/training/athletes/{athleteId}/season-plans'],
  saveSeason: ['POST', '/api/training/athletes/{athleteId}/season-plans']
};
export function createHttpClient({fetchImpl=fetch,getToken=()=>null,actorId='',base=''}={}) {
  let currentActor=actorId, securityVersion=0, csrf=null;
  const activityThreads=new Map();
  const pendingCommands=new Map();
  const listeners=new Set(), changed=()=>listeners.forEach(fn=>fn());
  const api={mode:'http'};
  async function request(method,path,p={},quiet=false) {
    const used=new Set();
    path=path.replace(/\{(\w+)\}/g,(_,key)=>{used.add(key);return encodeURIComponent(p[key]);});
    const payload=Object.fromEntries(Object.entries(p).filter(([key,value])=>!used.has(key)&&!['key','revision'].includes(key)&&value!==undefined));
    const headers={Accept:'application/json'},token=getToken(),unsafe=!['GET','HEAD'].includes(method);
    if(token)headers.Authorization=`Bearer ${token}`;
    const trackCommand=unsafe&&!path.includes('/auth/');
    const fingerprint=trackCommand?Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(`${currentActor}:${method}:${path}:${JSON.stringify(payload)}:${p.file?`${p.file.name}:${p.file.size}:${p.file.lastModified}`:''}`)))).map(byte=>byte.toString(16).padStart(2,'0')).join(''):'';
    if(unsafe){if(trackCommand&&!pendingCommands.has(fingerprint)){if(pendingCommands.size>=100)pendingCommands.delete(pendingCommands.keys().next().value);pendingCommands.set(fingerprint,p.key||crypto.randomUUID());}headers['Idempotency-Key']=p.key||pendingCommands.get(fingerprint)||crypto.randomUUID();if(!token){if(!csrf)csrf=await request('GET','/api/training/auth/csrf',{},true);headers[csrf.headerName]=csrf.token;}}
    if(p.revision!=null)headers['If-Match']=String(p.revision);
    let body;
    if(method==='GET'){const query=new URLSearchParams();Object.entries(payload).forEach(([key,value])=>query.set(key,typeof value==='object'?JSON.stringify(value):String(value)));if(query.size)path+='?'+query;}
    else if(p.file){body=new FormData();body.append('file',p.file);}
    else {headers['Content-Type']='application/json';body=JSON.stringify(payload);}
    const response=await fetchImpl(base+path,{method,headers,body,cache:'no-store',credentials:token?'omit':'same-origin'});
    if(response.status>=400&&response.status<500)pendingCommands.delete(fingerprint);
    if(!response.ok){const data=await response.json().catch(()=>({}));if(response.status===401&&currentActor){currentActor='';securityVersion++;changed();}if(response.status===403)csrf=null;throw Object.assign(Error(data.message||data.error||data.code||`Request failed (${response.status})`),{status:response.status,fieldErrors:data.fieldErrors});}
    const data=response.status===204?{}:await response.json();
    if(unsafe)pendingCommands.delete(fingerprint);
    if(unsafe&&!quiet){if(/access|teams|auth/.test(path))securityVersion++;changed();}return data;
  }
  for(const [name,[method,path]]of Object.entries(contracts))api[name]=(p={})=>request(method,path,p);
  api.getMe=async()=>{const me=await request('GET','/api/training/me');currentActor=me.id;return me;};
  api.login=async p=>{const result=await request('POST','/api/training/auth/login',p);if(!result.user)throw Error('Complete administrator MFA through the existing Hermes sign-in.');currentActor=result.user.id;securityVersion++;changed();return result;};
  api.logout=async()=>{await request('POST','/api/training/auth/logout');currentActor='';csrf=null;securityVersion++;changed();};
  api.getLibrary=async()=>{const [workouts,folders,plans]=await Promise.all(['/api/training/workouts','/api/training/folders','/api/training/plans'].map(path=>request('GET',path)));return {workouts:workouts.items,folders:folders.items,plans:plans.items};};
  api.saveWorkout=p=>request('POST',p.workoutId?'/api/training/workouts/{workoutId}/versions':'/api/training/workouts',p);
  api.getJoinCard=async(p={})=>p.slug?request('GET',`/api/training/teams/by-slug/${encodeURIComponent(p.slug)}`):{};
  api.previewConfiguration=p=>request('POST','/api/training/configuration-previews',p);
  api.getActivityConversation=async p=>{const key=`${currentActor}:${securityVersion}:${p.activityId}`;if(!activityThreads.has(key))activityThreads.set(key,request('POST','/api/training/conversations',{kind:'activity',activityId:p.activityId},true).catch(error=>{activityThreads.delete(key);throw error;}));return activityThreads.get(key);};
  api.openConversation=p=>request('POST','/api/training/conversations',p);
  api.getActivityOverlays=async p=>({items:await Promise.all(p.activityIds.slice(0,8).map(activityId=>api.getActivity({activityId})))});
  api.importFile=async({file})=>{
    const job=await request('POST','/api/training/imports',{file});
    for(let count=0;count<120;count++){
      const state=await api.getJob({jobId:job.id});
      if(state.state==='succeeded'){changed();return {...state.result,jobId:job.id,activityId:state.result?.activities?.[0]?.id};}
      if(['dead','cancelled'].includes(state.state))throw Error(state.errorCode||'Import did not finish.');
      await new Promise(resolve=>setTimeout(resolve,1000));
    }
    return {state:'processing; check GET /api/training/jobs/'+job.id,jobId:job.id};
  };
  api.getJob=p=>request('GET','/api/training/jobs/{jobId}',p);
  api.importActivity=async()=>{throw Error('Server import requires an original file; use the file picker.');};
  api.requestPasswordReset=p=>request('POST','/api/auth/password-reset/request',p);
  api.getActor=()=>currentActor;
  api.refresh=()=>changed();
  api.deleteAccount=async p=>{await request('DELETE','/api/training/me',p);currentActor='';securityVersion++;changed();};
  api.getSecurityKey=()=>`${currentActor}:${securityVersion}`;
  api.invalidateAccessCache=()=>{securityVersion++;changed();};
  api.getDemoActors=()=>[];
  api.subscribe=fn=>{listeners.add(fn);return()=>listeners.delete(fn);};
  api.setActor=()=>{throw Error('Server identity is established by authentication.');};
  return api;
}
