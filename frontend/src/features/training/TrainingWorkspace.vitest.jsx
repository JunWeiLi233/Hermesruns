import { beforeEach, afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import messages from '../../i18n/locales/en.js';
import TrainingWorkspace from './TrainingWorkspace.jsx';
import { apiFetch } from '../../api';

vi.mock('../../api',()=>({apiFetch:vi.fn()}));
const logout=vi.fn();
vi.mock('../../contexts/AuthContext',()=>({useAuth:()=>({token:'synthetic-verified-session',logout})}));
vi.mock('../../contexts/ThemeContext',()=>({useTheme:()=>({isDark:false})}));
vi.mock('../../contexts/I18nContext',()=>({useI18n:()=>({t:key=>key.split('.').reduce((value,part)=>value?.[part],messages)||key})}));
vi.mock('../../components/AuthenticatedPageChrome',()=>({default:({children})=><div data-testid="hermes-shell">{children}</div>}));

const profile={id:'own-athlete',name:'Synthetic athlete',zone:'UTC',revision:1};
let calls=[],extraAthletes=[];
beforeEach(()=>{
  profile.zone='UTC';profile.revision=1;extraAthletes=[];
  calls=[];apiFetch.mockResolvedValue({ok:true,status:200});
  vi.stubGlobal('fetch',vi.fn(async(url,options={})=>{
    calls.push({url,options});
    if(url.endsWith('/me')&&options.method==='PATCH')Object.assign(profile,JSON.parse(options.body),{revision:profile.revision+1});
    let data=url.endsWith('/me')?{...profile}:url.endsWith('/roster')?{items:[{...profile,access:'owner'},...extraAthletes]}:url.includes('/calendar')?{activities:[],events:[]}:url.endsWith('/auth/csrf')?{token:'csrf-test',headerName:'X-TRAINING-CSRF'}:{items:[]};
    if(options.method==='POST'&&url.endsWith('/teams'))data={id:'created-team',name:JSON.parse(options.body).name};
    return {ok:true,status:200,json:async()=>data};
  }));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();vi.useRealTimers();});
it('opens the native cookie workspace from Hermes auth and creates a team without a second login',async()=>{
  render(<MemoryRouter initialEntries={['/training/calendar']}><Routes><Route path="/training/*" element={<TrainingWorkspace/>}/></Routes></MemoryRouter>);
  await screen.findByRole('heading',{name:'Training calendar'});
  expect(apiFetch).toHaveBeenCalledWith('/api/training/auth/session',{method:'POST'});
  expect(screen.getByTestId('hermes-shell')).toBeInTheDocument();expect(screen.queryByLabelText('Sample account')).not.toBeInTheDocument();expect(screen.queryByText('Screen state review')).not.toBeInTheDocument();
  fireEvent.click(screen.getByText('Coaching & teams'));
  fireEvent.click(screen.getByRole('link',{name:'Team management'}));
  fireEvent.click(await screen.findByRole('button',{name:'Create a team'}));
  const name=await screen.findByLabelText('New team name');fireEvent.change(name,{target:{value:'Synthetic coaching team'}});fireEvent.click(screen.getByRole('button',{name:'Create team'}));
  await waitFor(()=>expect(calls.some(call=>call.url==='/api/training/teams'&&call.options.method==='POST')).toBe(true));
  const create=calls.find(call=>call.url==='/api/training/teams'&&call.options.method==='POST');expect(create.options.credentials).toBe('same-origin');expect(create.options.headers['X-TRAINING-CSRF']).toBe('csrf-test');expect(JSON.parse(create.options.body)).toEqual({name:'Synthetic coaching team'});
});
it('uses a changed account timezone for the next manual-session date without reopening the workspace',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-15T01:00:00Z'));
  render(<MemoryRouter initialEntries={['/training/settings']}><Routes><Route path="/training/*" element={<TrainingWorkspace/>}/></Routes></MemoryRouter>);
  const zone=await screen.findByLabelText('Time zone');fireEvent.change(zone,{target:{value:'America/Los_Angeles'}});fireEvent.click(screen.getByRole('button',{name:'Save preferences'}));
  await screen.findByText('America/Los_Angeles');fireEvent.click(screen.getByText('Training'));fireEvent.click(screen.getByRole('link',{name:'Import activities'}));
  expect(await screen.findByLabelText('Manual session day')).toHaveValue('2026-10-14');
});
it('uses the selected athlete civil date before a coached form mounts',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-15T01:00:00Z'));
  extraAthletes=[{id:'coached-athlete',name:'Synthetic coached athlete',zone:'America/Los_Angeles',access:'coach'}];
  render(<MemoryRouter initialEntries={['/training/calendar']}><Routes><Route path="/training/*" element={<TrainingWorkspace/>}/></Routes></MemoryRouter>);
  await screen.findByRole('option',{name:'Synthetic coached athlete'});fireEvent.change(screen.getByLabelText('Selected athlete'),{target:{value:'coached-athlete'}});
  fireEvent.click(screen.getByRole('link',{name:'Import activities'}));expect(await screen.findByLabelText('Manual session day')).toHaveValue('2026-10-14');
});
