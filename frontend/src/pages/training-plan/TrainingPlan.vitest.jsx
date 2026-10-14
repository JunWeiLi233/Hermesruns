import {cleanup,fireEvent,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import TrainingPlan from './TrainingPlan';
import {apiJson} from '../../api';
import en from '../../i18n/locales/en/runPlan';
import zh from '../../i18n/locales/zh-CN/runPlan';
const state=vi.hoisted(()=>({lang:'en',rest:false,failSave:false}));
const t=(key,params={})=>Object.entries(params).reduce((value,[name,content])=>value.replaceAll(`{${name}}`,String(content)),key.split('.').reduce((value,k)=>value?.[k],state.lang==='en'?en:zh)||key);
vi.mock('../../contexts/I18nContext',()=>({useI18n:()=>({t,lang:state.lang})}));
vi.mock('../../contexts/UnitContext',()=>({useUnit:()=>({unit:'km'})}));
vi.mock('../../api',()=>({apiJson:vi.fn()}));
vi.mock('../../api/resourceCache',()=>({invalidateResourceCache:vi.fn()}));
vi.mock('../../components/HermesLogo',()=>({default:()=>null}));
vi.mock('../../components/TopbarUserMenu',()=>({default:()=>null}));
beforeEach(()=>{state.lang='en';state.rest=false;state.failSave=false;apiJson.mockReset();apiJson.mockImplementation(async(path)=>{
  if(path==='/api/coach/today')return {today:{scheduledDate:'2026-10-13',workoutType:state.rest?'REST':'EASY',plannedDistanceKm:state.rest?99:5,plannedDurationMinutes:35},plan:{targetWeeklyKm:20,sessionsPerWeek:3},state:{activeBlock:null}};
  if(path.startsWith('/api/coach/schedule'))return [{scheduledDate:'2026-10-13',workoutType:'REST'}];
  if(path==='/api/manual-runs'){if(state.failSave)throw new Error('network');return {id:'55'};}
  return {};
});});
afterEach(cleanup);
const mount=()=>render(<MemoryRouter><TrainingPlan/></MemoryRouter>);
it('shows a real rest state without showing stale run distance',async()=>{state.rest=true;mount();await screen.findByRole('heading',{name:'Rest day',level:2});expect(screen.queryByText('99.0 km')).not.toBeInTheDocument();expect(screen.getByText(en.run_plan.rest_detail)).toBeInTheDocument();});
it('reviews goal input without mutating the backend then saves only on confirmation',async()=>{mount();await screen.findByRole('heading',{name:'Easy run'});fireEvent.click(screen.getByRole('button',{name:'Set a running goal'}));fireEvent.change(screen.getByLabelText('Target date'),{target:{value:'2026-11-20'}});fireEvent.click(screen.getByRole('button',{name:'Review your goal'}));expect(apiJson.mock.calls.some(([path])=>path==='/api/coach/training-block')).toBe(false);fireEvent.click(screen.getByRole('button',{name:'Use this goal'}));await waitFor(()=>expect(apiJson).toHaveBeenCalledWith('/api/coach/training-block',expect.objectContaining({method:'POST',body:JSON.stringify({raceDistanceKm:5,targetRaceDate:'2026-11-20',name:'My running goal'})})));});
it('retries an uncertain run save with the same identity and freezes its original details',async()=>{state.failSave=true;mount();await screen.findByRole('heading',{name:'Easy run'});fireEvent.click(screen.getAllByRole('button',{name:'Log a run'})[0]);fireEvent.change(screen.getByLabelText('Distance (km)'),{target:{value:'5.2'}});fireEvent.change(screen.getByLabelText('Minutes'),{target:{value:'32'}});fireEvent.click(screen.getByRole('button',{name:'Save run'}));await screen.findByText(en.run_plan.save_error);const first=apiJson.mock.calls.find(([path])=>path==='/api/manual-runs')[1].body;expect(screen.getByLabelText('Distance (km)')).toBeDisabled();state.failSave=false;fireEvent.click(screen.getByRole('button',{name:'Retry this save'}));await screen.findByText(en.run_plan.run_saved);const attempts=apiJson.mock.calls.filter(([path])=>path==='/api/manual-runs');expect(attempts).toHaveLength(2);expect(attempts[1][1].body).toBe(first);});
it('renders Chinese goal and manual-entry copy without fallback keys',async()=>{state.lang='zh-CN';mount();await screen.findByRole('heading',{name:'轻松跑'});fireEvent.click(screen.getAllByRole('button',{name:'记录一次跑步'})[0]);expect(screen.getByLabelText('距离（公里）')).toBeInTheDocument();expect(screen.queryByText('run_plan.manual_detail')).not.toBeInTheDocument();});
