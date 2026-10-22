import {useEffect,useMemo,useState} from 'react';
import {useLocation,useSearchParams} from 'react-router';
import {useAuth} from '../../../contexts/AuthContext';
import {useI18n} from '../../../contexts/I18nContext';
import {useTheme} from '../../../contexts/ThemeContext';
import {createHttpClient} from '../data/http.mjs';
import {setAccountZone} from '../data/dates.mjs';
import {WorkspaceProvider,useResource,useWorkspace} from '../ui/workspace';
import {NativeTrainingRoutesProvider} from '../ui/router';
import {Button,Notice,Skeleton} from '../ui/components';
import './integrationTools.css';

function AuthorizedSelection({children,requested,loadingFallback,renderUnavailable=content=>content}){
 const {t}=useI18n();const roster=useResource('getRoster');const {actor,athleteId}=useWorkspace();
 if(requested&&requested!==actor){
  if(roster.loading)return loadingFallback??<Skeleton/>;
  if(roster.error||!roster.data?.items.some(a=>a.id===athleteId&&a.access!=='none'))return renderUnavailable(<Notice tone="danger" alert>{t('training_integration.accessUnavailable')}</Notice>);
 }
 return <NativeTrainingRoutesProvider athleteId={athleteId===actor?null:athleteId}>{children}</NativeTrainingRoutesProvider>;
}

/** Data/session bridge only: the owning Hermes page supplies its existing layout and navigation. */
export default function TrainingDataProvider({children,athleteId,selfOnly=false,renderUnavailable,loadingFallback}){
 const {token,logout}=useAuth();const {t}=useI18n();const {isDark}=useTheme();
 const location=useLocation();const [params,setParams]=useSearchParams();
 const requested=selfOnly||location.pathname==='/settings'?null:athleteId??params.get('athlete');
 // The native product uses its existing credential for every request. This avoids
 // mixing cookie/CSRF state with the bearer reads used by the owning Hermes page.
 const client=useMemo(()=>createHttpClient({getToken:()=>token,onUnauthorized:logout}),[token,logout]);
 const [session,setSession]=useState({}),[attempt,setAttempt]=useState(0);
 useEffect(()=>{
  let active=true;
  client.getMe().then(me=>{if(active){setAccountZone(me.zone);setSession({client,me});}})
   .catch(error=>{if(active){if(error.status===401)logout();setSession({client,error});}});
  return()=>{active=false;};
 },[client,attempt,logout]);
 if(session.client!==client||!session.me&&!session.error)return loadingFallback??<Skeleton/>;
 if(session.error)return <div role="alert"><p>{t('training_workspace.unavailable')}</p><Button onClick={()=>{setSession({});setAttempt(n=>n+1);}}>{t('training_workspace.retry')}</Button></div>;
 return <WorkspaceProvider key={`${token}:${requested||session.me.id}`} client={client} initialAthleteId={requested||session.me.id} appearance={isDark?'dark':'light'} onAthleteChange={id=>{
  const next=new URLSearchParams(params);if(id===session.me.id)next.delete('athlete');else next.set('athlete',id);setParams(next);
 }}><AuthorizedSelection loadingFallback={loadingFallback} requested={requested} renderUnavailable={renderUnavailable}>{children}</AuthorizedSelection></WorkspaceProvider>;
}
