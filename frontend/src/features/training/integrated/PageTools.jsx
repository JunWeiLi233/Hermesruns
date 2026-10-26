import {lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {useSearchParams} from 'react-router';
import {useAuth} from '../../../contexts/AuthContext';
import {useI18n} from '../../../contexts/I18nContext';
import {useTheme} from '../../../contexts/ThemeContext';
import Modal from '../../../components/Modal';
import ModalLoadingSkeleton from '../../../components/ModalLoadingSkeleton';
import TrainingDataProvider from './TrainingDataProvider';
import {WorkspaceProvider} from '../ui/workspace';
import {NativeTrainingRoutesProvider} from '../ui/router';
import {CalendarEntry} from '../ui/CalendarEntry';
import {createHttpClient} from '../data/http.mjs';
import {addDays} from '../data/model.mjs';
import './integrationTools.css';
import '../screens/authoring.css';
const screens={library:lazy(()=>import('../screens/S17')),workout:lazy(()=>import('../screens/S18')),plans:lazy(()=>import('../screens/S19')),season:lazy(()=>import('../screens/S20'))};
const emptyEvents=[];
export function ScheduleAuthoringTools(){
 const {t}=useI18n();const {isDark}=useTheme();const [params,setParams]=useSearchParams();const view=params.get('trainingTool');const Screen=screens[view];
 const setView=value=>setParams(old=>{const next=new URLSearchParams(old);next.delete('id');if(value)next.set('trainingTool',value);else next.delete('trainingTool');return next;});
 const fallback=<ModalLoadingSkeleton variant={{library:'workout-library',workout:'workout-editor',plans:'reusable-plans',season:'season-plan'}[view]}/>;
 const label={library:'libraryTitle',workout:'editorTitle',plans:'plansTitle',season:'seasonTitle'};
 return <section className="integrated-page-tools"><div className="athlete-tools-actions">{[['library','library'],['workout','workoutEditor'],['plans','reusablePlans'],['season','season']].map(([key,label])=><button type="button" className="runner-shell-inline-btn" key={key} onClick={()=>setView(key)}>{t('training_integration.'+label)}</button>)}</div>
  <Modal isOpen={!!Screen} onClose={()=>setView(null)} title={<><span>{t('training_authoring.'+(label[view]||'libraryTitle'))}</span><small>{t('training_authoring.'+(view||'library')+'Subtitle')}</small></>} closeLabel={t('training_integration.close')} shellClassName="workout-authoring-shell" cardClassName={`athlete-tools-modal workout-authoring-modal ${view==='library'?'workout-library-modal':''} ${isDark?'authoring-dark':''}`} portalToBody>
   {view!=='library'&&<nav className="authoring-navigation" aria-label={t('training_authoring.navigation')}>{Object.keys(screens).map(key=><button type="button" key={key} aria-current={view===key?'page':undefined} onClick={()=>setView(key)}>{t('training_authoring.'+label[key])}</button>)}</nav>}
   <Suspense fallback={fallback}><TrainingDataProvider loadingFallback={fallback}>{Screen&&<div className="icu-design training-app hermes-training-integrated workout-authoring" data-theme={isDark?'dark':'light'}><Screen key={view}/></div>}</TrainingDataProvider></Suspense>
  </Modal>
 </section>;
}
export function useAuthoredCalendar(from){
 const {token}=useAuth();const [version,setVersion]=useState(0),[state,setState]=useState({});
 const client=useMemo(()=>createHttpClient({getToken:()=>token}),[token]);const scope=`${token}:${from}`,key=`${scope}:${version}`;
 useEffect(()=>{
  if(!token)return;
  const refresh=()=>setVersion(v=>v+1),visible=()=>{if(document.visibilityState==='visible')refresh();};
  window.addEventListener('hermes-training-changed',refresh);window.addEventListener('focus',visible);window.addEventListener('online',visible);document.addEventListener('visibilitychange',visible);
  const timer=window.setInterval(visible,30000);
  return()=>{window.clearInterval(timer);window.removeEventListener('hermes-training-changed',refresh);window.removeEventListener('focus',visible);window.removeEventListener('online',visible);document.removeEventListener('visibilitychange',visible);};
 },[token]);
 useEffect(()=>{let active=true;if(!token)return;
  client.getMe().then(async me=>({me,...await client.getCalendar({athleteId:me.id,start:from,end:addDays(from,6)})})).then(data=>{if(active)setState({key,scope,data});}).catch(error=>{if(active)setState(previous=>({key,scope,error,...(previous.scope===scope&&previous.data?{data:previous.data}:{})}));});
  return()=>{active=false;};
 },[key,scope,client,token,from]);
 // Retain the same account/week during a mutation refresh; a scope change exposes no old rows.
 const current=state.scope===scope?state:{};
 return {client,...current,loading:Boolean(token)&&!current.data&&!current.error,refreshing:Boolean(token)&&state.key!==key,events:current.data?.events||emptyEvents};
}
export function AuthoredWeekProvider({source,children}){
 if(!source.data?.me)return children;
 return <AuthoredWorkspace source={source}>{children}</AuthoredWorkspace>;
}
function AuthoredWorkspace({source,children}){
 const {isDark}=useTheme();
 return <WorkspaceProvider client={source.client} initialAthleteId={source.data.me.id} appearance={isDark?'dark':'light'}><NativeTrainingRoutesProvider>{children}</NativeTrainingRoutesProvider></WorkspaceProvider>;
}
export function AuthoredDayEntries({date,source}){
 const rows=source.events.filter(e=>e.date===date&&e.state!=='cancelled');if(!rows.length)return null;
 return <AuthoredRows rows={rows} source={source}/>;
}
function AuthoredRows({rows,source}){
 const {isDark}=useTheme();
 return <div className="icu-design training-app hermes-training-integrated authored-day-entries" data-theme={isDark?'dark':'light'}>{rows.map(event=><CalendarEntry key={event.id} event={event} activities={source.data?.activities||[]}/>)}</div>;
}
