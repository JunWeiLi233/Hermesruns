import {Navigate,useLocation,useParams,useSearchParams} from 'react-router';
import {useI18n} from '../../../contexts/I18nContext';
import AuthenticatedPageChrome from '../../../components/AuthenticatedPageChrome';
import {canonicalDestination,planDestination,trainingDestination} from '../destinations.mjs';
import TrainingDataProvider from './TrainingDataProvider';
import {useResource,useWorkspace} from '../ui/workspace';
import {Link} from '../ui/router';
import {Badge,DataTable,LineChart,Notice,Panel,QueryGate,SelectField,fmt} from '../ui/components';
import Activities from '../screens/S07';
import Chat from '../screens/S23';
import Calendar from '../screens/S06';
import {ScheduleAuthoringTools} from './PageTools';
import './integrationTools.css';

const unavailablePage=content=><AuthenticatedPageChrome activeKey="activities"><section className="integrated-athlete-page">{content}</section></AuthenticatedPageChrome>;

export function LegacyFeatureRedirect({plan=false}){
 const location=useLocation();return <Navigate replace to={plan?planDestination(location.pathname,location.search)+location.hash:trainingDestination(location.pathname+location.search+location.hash)}/>;
}
function AthleteFrame({children}){
 const {t}=useI18n();const {actor,athleteId,setAthlete,theme}=useWorkspace();const roster=useResource('getRoster');
 return <AuthenticatedPageChrome title={t('profile.dashboard_nav_activities')} activeKey="activities"><section className="icu-design training-app hermes-training-integrated integrated-athlete-page" data-theme={theme}>
  <h1>{t('training_integration.athleteActivities')}</h1>
  <SelectField label={t('training_integration.selectedAthlete')} value={athleteId} onChange={e=>setAthlete(e.target.value)} options={(roster.data?.items||[]).filter(a=>a.access!=='none').map(a=>({value:a.id,label:a.name}))}/>
  {actor!==athleteId&&<Notice>{t('training_integration.readOnlyAnalysis')}</Notice>}
  <Link to="/runs">{t('training_integration.backOwn')}</Link>{children}
 </section></AuthenticatedPageChrome>;
}
function UuidActivityLanding(){
 const {t}=useI18n();const location=useLocation();const [params]=useSearchParams();const {actor}=useWorkspace();const result=useResource('getActivity',{activityId:params.get('activity')});
 return <QueryGate query={result}>{a=>a.canonicalId?<Navigate replace to={canonicalDestination(a,actor,location.search,location.hash)}/>:<Notice tone="warning">{t('training_integration.identityUnavailable')}</Notice>}</QueryGate>;
}
function CoachedActivity(){
 const {id}=useParams();const {t}=useI18n();const [params]=useSearchParams();const {athleteId}=useWorkspace();
 const result=useResource('getCanonicalActivity',{canonicalId:id});
 return <AthleteFrame><QueryGate query={result}>{a=>a.athleteId!==athleteId?<Notice tone="danger">{t('training_integration.accessUnavailable')}</Notice>:<>
  <Panel title={a.title} meta={`${a.date||''} · ${a.sport}`}>
   <Badge>{a.source}</Badge><dl className="tw-metrics">{[['minutes',fmt(a.minutes)],['load',fmt(a.load)],['effort',fmt(a.rpe)]].map(([k,v])=><div key={k}><dt>{t('training_integration.'+k)}</dt><dd>{v}</dd></div>)}</dl>
   <LineChart title={t('training_integration.heartRate')} units="bpm" series={[{name:t('training_integration.heartRate'),values:a.samples.map(s=>s.hr)}]}/>
   <DataTable caption={t('training_integration.allIntervals')} rows={a.intervals} columns={[{key:'start',label:t('training_integration.intervalStart')},{key:'end',label:t('training_integration.intervalEnd')},{key:'minutes',label:t('training_integration.minutes')}]}/>
  </Panel>
  <Link to={`/messages?activity=${a.id}`}>{t('training_integration.session_conversation')}</Link>
  {params.get('conversation')&&<Chat activityId={a.id}/>}
 </>}</QueryGate></AthleteFrame>;
}
function DetailOwnership({children}){
 const {athleteId,actor}=useWorkspace();return athleteId===actor?children:<CoachedActivity/>;
}
export function ExistingRunsRoute({children}){
 const [params]=useSearchParams();
 if(params.get('view')==='activity'&&params.get('activity'))return <TrainingDataProvider renderUnavailable={unavailablePage}><UuidActivityLanding/></TrainingDataProvider>;
 if(params.get('athlete'))return <TrainingDataProvider renderUnavailable={unavailablePage}><RunsOwnership>{children}</RunsOwnership></TrainingDataProvider>;
 return children;
}
function RunsOwnership({children}){const {athleteId,actor}=useWorkspace();return athleteId===actor?children:<AthleteFrame><Activities/></AthleteFrame>;}
export function ExistingRunDetailRoute({children}){
 const [params]=useSearchParams();return params.get('athlete')?<TrainingDataProvider renderUnavailable={unavailablePage}><DetailOwnership>{children}</DetailOwnership></TrainingDataProvider>:children;
}
function ScheduleOwnership({children}){
 const {athleteId,actor,theme,setAthlete}=useWorkspace();const {t}=useI18n();const roster=useResource('getRoster');
 if(athleteId===actor)return children;
 return <AuthenticatedPageChrome title={t('profile.dashboard_nav_schedule')} activeKey="schedule"><section className="icu-design training-app hermes-training-integrated integrated-athlete-page" data-theme={theme}>
  <h1>{t('training_integration.authoredCalendar')}</h1><SelectField label={t('training_integration.selectedAthlete')} value={athleteId} onChange={e=>setAthlete(e.target.value)} options={(roster.data?.items||[]).filter(a=>a.access!=='none').map(a=>({value:a.id,label:a.name}))}/>
  {roster.data?.items.find(a=>a.id===athleteId)?.access==='read'&&<Notice>{t('training_integration.readOnly')}</Notice>}
  <ScheduleAuthoringTools/><Calendar/>
 </section></AuthenticatedPageChrome>;
}
export function ExistingScheduleRoute({children}){const [p]=useSearchParams();return p.get('athlete')?<TrainingDataProvider renderUnavailable={unavailablePage}><ScheduleOwnership>{children}</ScheduleOwnership></TrainingDataProvider>:children;}
