import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { afterEach,beforeEach,expect,it,vi } from 'vitest';
import { I18nProvider } from '../../contexts/I18nContext';
import { UnitProvider } from '../../contexts/UnitContext';
import { ThemeProvider } from '../../contexts/ThemeContext';
import { apiFetch,apiJson } from '../../api';
import { cachedApiJson } from '../../api/resourceCache';
import Schedule from '../schedule/Schedule';
import TodayRun from '../today-run/TodayRun';
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({isAuthenticated:true,email:'runner@example.test',token:'native-session'})}));
vi.mock('../../api',()=>({apiFetch:vi.fn(),apiJson:vi.fn(),subscribeWakeRetry:()=>()=>{}}));
vi.mock('../../api/resourceCache',()=>({cachedApiJson:vi.fn()}));
vi.mock('../../components/TopbarUserMenu',()=>({default:()=>null}));
vi.mock('../../components/TopbarNotifications',()=>({default:()=>null}));
const authoredClient=vi.hoisted(()=>({mode:'http',getMe:vi.fn(),getCalendar:vi.fn(),getRoster:vi.fn(),getLibrary:vi.fn(),saveWorkout:vi.fn(),createEvent:vi.fn(),getActor:()=> 'athlete',getSecurityKey:()=> 'athlete:1',subscribe:()=>()=>{}}));
vi.mock('../../features/training/data/http.mjs',()=>({createHttpClient:()=>authoredClient}));
let generated=true,authoredEvents=[];
const inputs={startDate:'2026-10-19',endDate:'2027-01-10',timeZone:'America/New_York',trainingMode:'RUN_WALK'};
const plan={id:'active-plan',title:'Published beginner plan',inputs,state:'ACTIVE',revision:2};
const workout={id:'published-workout',localDate:'2026-10-20',workoutType:'RUN_WALK',phase:'ADAPT',completionSource:'NONE',targetDurationS:1320,targetDistanceM:null,state:'PLANNED',steps:[{stepType:'WARMUP',durationS:300,effortKey:'WALK'},{stepType:'RUN',durationS:1020,effortKey:'EASY'}]};
beforeEach(()=>{
  generated=true;authoredEvents=[];
  authoredClient.getMe.mockResolvedValue({id:'athlete',zone:'America/New_York'});
  authoredClient.getRoster.mockResolvedValue({items:[{id:'athlete',access:'owner'}]});
  authoredClient.getCalendar.mockImplementation(async()=>({events:authoredEvents,activities:[]}));
  authoredClient.getLibrary.mockResolvedValue({workouts:[],folders:[],plans:[]});
  authoredClient.saveWorkout.mockResolvedValue({id:'saved-workout',version:2});
  authoredClient.createEvent.mockImplementation(async input=>{const event={id:'created-event',state:'planned',revision:0,...input};authoredEvents=[...authoredEvents,event];window.dispatchEvent(new Event('hermes-training-changed'));return event;});
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T16:00:00Z'));
  localStorage.clear();localStorage.setItem('hermes_jwt','native-session');localStorage.setItem('hermes_lang','en');localStorage.setItem('hermes_unit','km');
  apiFetch.mockImplementation(async url=>{let value;
    if(url==='/api/run-plans')value={ownerId:'owner',plans:[]};
    else if(url==='/api/training/auth/session')value={};
    else if(url==='/api/run-plans/today')value=generated?{plan,workout,localDate:'2026-10-20',state:'TODAY'}:{state:'NO_PLAN'};
    else if(url==='/api/profile/me')value={displayName:'Runner',timeZone:'America/New_York'};
    else if(url==='/api/plan-profile')value={profile:null};
    else if(url.includes('/workouts?'))value={weeks:[{startDate:'2026-10-19',trainingDurationS:1320,runCount:1,days:[workout]}],actualDistanceM:0,actualDurationS:0};
    else if(url.endsWith('/pace-review'))value={state:'NOT_AVAILABLE',sources:[],excludedSources:[]};
    else if(url.includes('/workouts/'))value={plan,workout,link:null};
    else throw new Error(`Unexpected plan request ${url}`);
    return new Response(JSON.stringify(value),{status:200});
  });
  cachedApiJson.mockImplementation(async url=>url==='/api/profile/me'?{displayName:'Runner',timeZone:'America/New_York'}:[]);
  apiJson.mockImplementation(async url=>url==='/api/coach/state'?{currentReadinessScore:78,readinessSleep:82,readinessAvailability:{sleep:true}}:url==='/api/v1/weather/context'?{available:true,pacePenaltySecPerKm:15}:[]);
});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.useRealTimers();});
function mount(Component,path){return render(<MemoryRouter initialEntries={[path]}><I18nProvider><UnitProvider><ThemeProvider><Component/></ThemeProvider></UnitProvider></I18nProvider></MemoryRouter>);}
it('merges generated days into the native Schedule calendar while retaining its support panels',async()=>{
  const {container}=mount(Schedule,'/schedule');
  await screen.findByRole('heading',{level:1,name:'Published beginner plan'});
  expect(screen.getByText('This experimental plan has not been statistically validated for training outcomes.')).toBeVisible();
  await waitFor(()=>expect(container.querySelectorAll('.schedule-plan-day')).toHaveLength(7));
  expect((await screen.findAllByRole('button',{name:'Session details'})).some(button => !button.disabled)).toBe(true);
  expect(container.querySelector('.schedule-plan-readiness-card')).toBeInTheDocument();
  expect(container.querySelector('.schedule-plan-coach-card')).toBeInTheDocument();
  expect(container.querySelector('.tp-shell')).toBeNull();
  expect(apiJson.mock.calls.some(([url])=>url==='/api/coach/today'||url.startsWith('/api/coach/schedule'))).toBe(false);
});
it('keeps the native Today hero, readiness and weather with the exact published timed target',async()=>{
  const {container}=mount(TodayRun,'/today-run');
  await screen.findByRole('heading',{level:1,name:'Run / walk'});
  expect(screen.getByText('This experimental plan has not been statistically validated for training outcomes.')).toBeVisible();
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('22 min');
  expect(container.querySelector('.tr-v2-gate-score')).toHaveTextContent('78');
  expect(container.querySelector('.tr-v2-weather')).toHaveTextContent('+15');
  expect(container.querySelector('.tr-v2-support')).toBeInTheDocument();
  expect(container.querySelector('.tr-v2-secondary')).toBeNull();
  expect(container.querySelector('.tp-shell')).toBeNull();
  expect(apiJson.mock.calls.some(([url])=>url==='/api/coach/today'||url==='/api/today/dashboard')).toBe(false);
});
it('keeps published Schedule available when optional support data cannot be fetched',async()=>{
  cachedApiJson.mockRejectedValue(new TypeError('offline'));apiJson.mockRejectedValue(new TypeError('offline'));
  const {container}=mount(Schedule,'/schedule');
  await screen.findByRole('heading',{level:1,name:'Published beginner plan'});
  expect((await screen.findAllByRole('button',{name:'Session details'})).some(button => !button.disabled)).toBe(true);
  expect(container.querySelector('.schedule-plan-readiness-card')).toBeInTheDocument();
});
it('makes today’s authored workout authoritative in the native Today hero',async()=>{
  generated=false;authoredEvents=[{id:'authored',title:'Coach hill session',date:'2026-10-20',minutes:37,sport:'Run',state:'planned',revision:0,source:'7m @60% Warm up\n30m @80% Hills'}];
  const {container}=mount(TodayRun,'/today-run');
  await screen.findByRole('heading',{level:1,name:'Coach hill session'});
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('37 min');
  expect(container.querySelector('.tr-v2-structure-steps')).toHaveTextContent('Hills');
  expect(container.querySelector('.tr-v2-secondary')).toBeNull();
  expect(apiJson.mock.calls.some(([url])=>url==='/api/coach/today'||url==='/api/today/dashboard')).toBe(false);
  expect(await screen.findByRole('button',{name:'Manage Coach hill session'})).toBeInTheDocument();
});
it('replaces same-day automatic Schedule suggestions with authored calendar targets',async()=>{
  generated=false;authoredEvents=[{id:'authored',title:'Coach hill session',date:'2026-10-20',minutes:37,sport:'Run',state:'planned',revision:0}];
  const {container}=mount(Schedule,'/schedule');
  await screen.findByRole('button',{name:'Manage Coach hill session'});
  expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent('37 min');
  expect(container.querySelector('.schedule-plan-next-card')).toHaveTextContent('Coach hill session');
  expect(container.querySelector('.schedule-plan-next-card')).not.toHaveTextContent('Easy run');
});
it('keeps generated targets primary and identifies other authored sessions explicitly',async()=>{
  authoredEvents=[{id:'authored',title:'Additional mobility',date:'2026-10-20',minutes:12,sport:'Other',state:'planned',revision:0}];
  const {container}=mount(TodayRun,'/today-run');
  await screen.findByRole('heading',{level:1,name:'Run / walk'});
  expect(container.querySelector('.tr-v2-targets')).toHaveTextContent('22 min');
  expect(await screen.findByRole('heading',{name:'Other scheduled workouts'})).toBeInTheDocument();
  expect(screen.getByText(/Your active training plan supplies today/)).toBeInTheDocument();
});
it('ignores cancelled authored events and retains the native automatic source',async()=>{
  generated=false;authoredEvents=[{id:'cancelled',title:'Cancelled hills',date:'2026-10-20',minutes:37,sport:'Run',state:'cancelled'}];
  const {container}=mount(TodayRun,'/today-run');
  await screen.findByRole('heading',{name:'Coach briefing'});
  expect(container.querySelector('.tr-v2-session h1')).not.toHaveTextContent('Cancelled hills');
  expect(screen.queryByRole('button',{name:'Manage Cancelled hills'})).toBeNull();
  expect(apiJson.mock.calls.some(([url])=>url==='/api/coach/today')).toBe(true);
});
it('keeps the open workout editor and success receipt while its new event refreshes the native calendar',async()=>{
  generated=false;const user=userEvent.setup();const {container}=mount(Schedule,'/schedule?trainingTool=workout');
  const name=await screen.findByLabelText('Workout name');await user.clear(name);await user.type(name,'Scheduled without losing editor');
  await user.click(screen.getByRole('button',{name:'Save workout version',exact:true}));
  await screen.findByText('Published a pinned workout version in your library.');
  let finishRefresh;const refresh=new Promise(resolve=>{finishRefresh=resolve;});const callsBefore=cachedApiJson.mock.calls.length;
  cachedApiJson.mockImplementation(url=>refresh.then(()=>url==='/api/profile/me'?{displayName:'Runner',timeZone:'America/New_York'}:[]));
  try {
    await user.click(screen.getByRole('button',{name:'Schedule for selected athlete',exact:true}));
    await waitFor(()=>expect(cachedApiJson.mock.calls.length).toBeGreaterThan(callsBefore));
    expect(name).toBeInTheDocument();
  } finally {await act(async()=>finishRefresh());}
  await waitFor(()=>expect(container.querySelector('.schedule-plan-day.is-today')).toHaveTextContent('Scheduled without losing editor'));
  expect(screen.getByText('Workout scheduled. Open the calendar to move or match it.')).toBeVisible();
  expect(screen.getByLabelText('Workout name')).toBe(name);
  expect(name).toHaveValue('Scheduled without losing editor');
  expect(authoredClient.createEvent.mock.calls.at(-1)[0].sourceVersion).toBe(2);
});
it('refreshes authored prescriptions on focus so another tab can update the native week',async()=>{
  generated=false;mount(Schedule,'/schedule');await screen.findByRole('button',{name:'Create a workout',exact:true});
  authoredEvents=[{id:'from-another-tab',title:'Updated by coach',date:'2026-10-20',minutes:30,sport:'Running',state:'planned',revision:1}];
  await act(async()=>window.dispatchEvent(new Event('focus')));
  expect(await screen.findByRole('button',{name:'Manage Updated by coach'})).toBeInTheDocument();
});
