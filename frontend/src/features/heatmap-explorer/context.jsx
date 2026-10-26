import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createLocalApi } from './core/api.js';
import { createHttpApi } from './core/http-api.js';
const Context=createContext(null);
export const api=import.meta.env.VITE_EXPLORER_MODE==='local'||import.meta.env.MODE==='test'?createLocalApi():createHttpApi();
export function ExplorerProvider({children,service=api,presentation}) {
  const [state,setState]=useState({loading:true,bootstrap:null,view:null,error:null});const sequence=useRef(0);
  const refresh=useCallback(async()=>{
    const request=++sequence.current;
    try{const bootstrap=await service.bootstrap();const view=bootstrap.opened?await service.getView():null;if(request===sequence.current)setState({loading:false,bootstrap,view,error:null});}
    catch(error){if(request===sequence.current)setState(s=>({...s,loading:false,...([401,410].includes(error.status)?{bootstrap:{...s.bootstrap,opened:false},view:null}:error.status===409?{view:null}:{}),error}));}
  },[service]);
  useEffect(()=>{void refresh();return service.subscribe(refresh);},[service,refresh]);
  const accountPrefs=state.view?.preferences||state.bootstrap?.preferences;
  const prefs=accountPrefs?{...accountPrefs,...presentation}:accountPrefs;
  const [systemDark,setSystemDark]=useState(()=>window.matchMedia?.('(prefers-color-scheme: dark)').matches);
  useEffect(()=>{const mq=window.matchMedia?.('(prefers-color-scheme: dark)');const update=e=>setSystemDark(e.matches);mq?.addEventListener('change',update);return()=>mq?.removeEventListener('change',update);},[]);
  useEffect(()=>{document.documentElement.lang=prefs?.language||'en';},[prefs?.language]);
  const theme=prefs?.theme==='system'?(systemDark?'dark':'light'):prefs?.theme||'light';
  const t=useCallback((en,zh)=>prefs?.language==='zh-CN'?(zh||en):en,[prefs?.language]);
  return <Context.Provider value={{...state,api:service,refresh,prefs,theme,t,embedded:Boolean(presentation)}}>{children}</Context.Provider>;
}
export function useExplorer(){return useContext(Context);}
export function useAction(){const [busy,setBusy]=useState(false);const [error,setError]=useState('');const guard=useRef(false);const {refresh}=useExplorer();
  const run=async fn=>{if(guard.current)return;guard.current=true;setBusy(true);setError('');try{const result=await fn();await refresh();return {ok:true,result};}catch(e){setError(e.message);return {ok:false};}finally{guard.current=false;setBusy(false);}};
  return {busy,error,setError,run};
}
