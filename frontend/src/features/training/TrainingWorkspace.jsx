import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, NavLink, useLocation } from 'react-router';
import { apiFetch } from '../../api';
import { useAuth } from '../../contexts/AuthContext';
import { useI18n } from '../../contexts/I18nContext';
import { useTheme } from '../../contexts/ThemeContext';
import AuthenticatedPageChrome from '../../components/AuthenticatedPageChrome';
import { createHttpClient } from './data/http.mjs';
import { setAccountZone } from './data/dates.mjs';
import { WorkspaceProvider, useResource, useWorkspace } from './ui/workspace.jsx';
import { RoutePrefixProvider } from './ui/router.jsx';
import { Button, Notice, QueryGate, SelectField, Skeleton } from './ui/components.jsx';
import { trainingRoutes } from './routes.mjs';
import './design/tokens.css';
import './design/styles.css';
import './tokens.css';
import './workspace.css';
import './product.css';

const screens=Object.fromEntries(trainingRoutes.map(route=>[route.id,lazy(route.load)]));
const screenElements=Object.fromEntries(Object.entries(screens).map(([id,Screen])=>[id,<Screen key={id}/>]));
function TrainingView(){
  const {t}=useI18n(),{isDark}=useTheme(),{athleteId,setAthlete}=useWorkspace();
  const location=useLocation(),roster=useResource('getRoster'),me=useResource('getMe');
  const selectedZone=athleteId===me.data?.id?me.data.zone:roster.data?.items.find(item=>item.id===athleteId)?.zone||me.data?.zone;
  useEffect(()=>{if(selectedZone)setAccountZone(selectedZone);},[selectedZone]);
  const route=trainingRoutes.find(item=>item.path===location.pathname);
  if(location.pathname==='/training'||location.pathname==='/training/')return <Navigate to="/training/calendar" replace/>;
  return <section className="icu-design training-app hermes-training" data-theme={isDark?'dark':'light'}>
    <header className="tw-heading"><div><h1>{route?t(`training_workspace.screens.${route.id}`):t('training_workspace.notFound')}</h1><p>{t('training_workspace.intro')}</p></div><span className="tw-muted">{selectedZone}</span></header>
    <div className="tw-actions"><SelectField label={t('training_workspace.athlete')} value={athleteId} onChange={event=>setAthlete(event.target.value)} options={(roster.data?.items||[]).filter(item=>item.access!=='none').map(item=>({value:item.id,label:item.name}))}/><Link className="ds-button" to="/training/access">{t('training_workspace.access')}</Link></div>
    <nav className="hermes-training-nav" aria-label={t('training_workspace.navigation')}>{['training','analysis','planning','coaching','settings'].map(group=><details key={group} open={route?.group===group}><summary>{t(`training_workspace.groups.${group}`)}</summary><div className="tw-actions">{trainingRoutes.filter(item=>item.group===group).map(item=><NavLink key={item.id} to={item.path}>{t(`training_workspace.screens.${item.id}`)}</NavLink>)}</div></details>)}</nav>
    {roster.data?.items.find(item=>item.id===athleteId)?.access==='read'&&<Notice>{t('training_workspace.readOnly')}</Notice>}
    <div className="tw-page" key={`${route?.id}:${athleteId}`}>{route?<Suspense fallback={<Skeleton/>}>{screenElements[route.id]}</Suspense>:<Notice><Link to="/training/calendar">{t('training_workspace.back')}</Link></Notice>}</div>
  </section>;
}

export default function TrainingWorkspace(){
  const {token,logout}=useAuth(),{t}=useI18n();
  const client=useMemo(()=>{const api=createHttpClient({onUnauthorized:logout});const remove=api.deleteAccount;api.deleteAccount=async body=>{await remove(body);logout();};return api;},[logout]);
  const [session,setSession]=useState({}),[attempt,setAttempt]=useState(0);
  useEffect(()=>{
    let active=true;
    // apiFetch uses the current first-party credential; subsequent training calls use cookies/CSRF.
    apiFetch('/api/training/auth/session',{method:'POST'}).then(async response=>{
      if(response.status===401){logout();throw Object.assign(Error('Session expired'),{status:401});}
      if(!response.ok)throw Object.assign(Error('Workspace unavailable'),{status:response.status});
      const me=await client.getMe();setAccountZone(me.zone);
      if(active)setSession({client,me});
    }).catch(error=>{if(active)setSession({client,error});});
    return()=>{active=false;};
  },[client,attempt,logout]);
  const query=session.client===client?{data:session.me,error:session.error,loading:!session.me&&!session.error}:{loading:true};
  return <AuthenticatedPageChrome title={t('training_workspace.nav')} activeKey="training"><div className="icu-design hermes-training-entry"><QueryGate query={query}>{()=> <WorkspaceProvider key={token} client={client}><RoutePrefixProvider prefix="/training"><TrainingView/></RoutePrefixProvider></WorkspaceProvider>}</QueryGate>{query.error&&<div className="tw-actions"><p role="alert">{t('training_workspace.unavailable')}</p><Button onClick={()=>{setSession({});setAttempt(value=>value+1);}}>{t('training_workspace.retry')}</Button><Link to="/profile">{t('training_workspace.home')}</Link></div>}</div></AuthenticatedPageChrome>;
}
