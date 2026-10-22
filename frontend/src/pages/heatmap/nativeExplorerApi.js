import { createHttpApi } from '../../features/heatmap-explorer/core/http-api.js';
import { invalidateResourceCache } from '../../api/resourceCache';
import { invalidateHeatmapCache } from '../../utils/heatmap/cache.js';

/** Credential-bound native transport; callbacks are installed after React commits. */
export function createNativeExplorerApi({token, email, fetcher}) {
  let environment={}, deleting=false, disposed=false, retired=false;
  const service=createHttpApi({fetcher:async(url,options={})=>{
    const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${token}`);
    const response=await fetcher(url,{...options,headers,credentials:'omit'});
    if((response.status===401||response.status===410)&&!disposed&&!retired&&!deleting) environment.logout?.();
    if(!disposed&&!retired&&response.ok&&url==='/api/explorer/preferences'&&options.method==='PATCH') {
      const prefs=await response.clone().json(),changed=JSON.parse(options.body||'{}');
      if('units' in changed) {const unit=prefs.units==='mi'?'mile':'km';if(unit!==environment.unit)environment.setUnit?.(unit);}
      if('language' in changed)environment.setLang?.(prefs.language);
      if('theme' in changed&&prefs.theme!=='system')environment.setTheme?.(prefs.theme==='dark'?'midnight':'light');
    }
    return response;
  }});
  const remove=service.deleteWorkspace,dispose=service.dispose;
  service.configure=callbacks=>{environment=callbacks;retired=false;};
  service.expire=()=>{if(!disposed&&!retired&&!deleting)environment.logout?.();};
  // ExplorerProvider owns polling subscriptions. Retire callbacks on React
  // cleanup without permanently destroying the client during StrictMode replay.
  service.retire=()=>{retired=true;};
  service.dispose=()=>{disposed=true;dispose();};
  service.deleteWorkspace=async values=>{
    deleting=true;
    try {
      const receipt=await remove(values);
      invalidateResourceCache('/api/activities');invalidateResourceCache('/api/profile');
      if(email)void invalidateHeatmapCache(email).catch(()=>{});
      if(!disposed&&!retired)environment.logout?.({redirectTo:'/heatmap/deletion',invalidate:false});
      return receipt;
    }catch(error){deleting=false;throw error;}
  };
  return service;
}
