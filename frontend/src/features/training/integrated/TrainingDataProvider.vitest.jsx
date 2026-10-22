import {cleanup,render,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {afterEach,beforeEach,expect,it,vi} from 'vitest';
import TrainingDataProvider from './TrainingDataProvider';
import {useResource,useWorkspace} from '../ui/workspace';
import Wellness from '../screens/S16';
const state=vi.hoisted(()=>({token:'session-a',logout:vi.fn(),bootstrap:vi.fn(),roster:[],actor:'self',requests:[],pendingMe:false}));
vi.mock('../../../api',()=>({apiFetch:(...args)=>state.bootstrap(...args)}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({token:state.token,logout:state.logout})}));
vi.mock('../../../contexts/I18nContext',()=>({useI18n:()=>({t:key=>key})}));
vi.mock('../../../contexts/ThemeContext',()=>({useTheme:()=>({isDark:false})}));
function Content(){const {athleteId}=useWorkspace();const q=useResource('getActivities',{athleteId});return <p>Selected {athleteId}: {q.data?.items[0]?.title}</p>;}
function mount(path,children=<Content/>,props={}){return render(<MemoryRouter initialEntries={[path]}><TrainingDataProvider {...props}>{children}</TrainingDataProvider></MemoryRouter>);}
beforeEach(()=>{state.actor='self';state.token='session-a';state.requests=[];state.pendingMe=false;state.roster=[{id:'self',access:'owner'},{id:'athlete',access:'coach'}];state.bootstrap.mockResolvedValue({ok:true,status:200});
 vi.stubGlobal('fetch',vi.fn(async(url)=>{state.requests.push(url);if(state.pendingMe&&url.endsWith('/me'))return new Promise(()=>{});const data=url.endsWith('/me')?{id:state.actor,zone:'America/New_York'}:url.endsWith('/roster')?{items:state.roster}:url.includes('/wellness')?{items:[]}: {items:[{title:'Permitted session'}]};return {ok:true,status:200,json:async()=>data};}));
});
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('uses the permitted athlete on the existing page without a second shell',async()=>{
 mount('/runs?athlete=athlete');expect(await screen.findByText('Selected athlete: Permitted session')).toBeInTheDocument();expect(fetch).toHaveBeenCalledWith('/api/training/me',expect.objectContaining({credentials:'omit',headers:expect.objectContaining({Authorization:'Bearer session-a'})}));expect(state.bootstrap).not.toHaveBeenCalled();expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
});
it('does not mount any athlete data consumer for a revoked or unrelated selection',async()=>{
 state.roster=[{id:'self',access:'owner'},{id:'athlete',access:'none'}];mount('/runs?athlete=athlete');expect(await screen.findByRole('alert')).toHaveTextContent('training_integration.accessUnavailable');expect(state.requests.some(url=>url.includes('/activities'))).toBe(false);
});
it('pins account settings to the signed-in account even with a foreign athlete query',async()=>{
 mount('/settings?section=training&athlete=athlete');expect(await screen.findByText('Selected self: Permitted session')).toBeInTheDocument();expect(state.requests).toContain('/api/training/athletes/self/activities');
});
it('does not show a previous account while bootstrapping a changed identity',async()=>{
 const view=mount('/runs');await screen.findByText('Selected self: Permitted session');state.token='session-b';state.actor='next-account';state.pendingMe=true;view.rerender(<MemoryRouter><TrainingDataProvider><Content/></TrainingDataProvider></MemoryRouter>);expect(screen.queryByText(/Permitted session/)).not.toBeInTheDocument();
});
it('keeps shared wellness read only even for a calendar coach',async()=>{
 mount('/analysis/injury-risk?athlete=athlete',<Wellness/>);await waitFor(()=>expect(screen.getByText(/Unshared wellness fields/)).toBeInTheDocument());expect(screen.queryByRole('button',{name:'Save journal entry'})).not.toBeInTheDocument();expect(screen.queryByLabelText('Journal day')).not.toBeInTheDocument();
});
