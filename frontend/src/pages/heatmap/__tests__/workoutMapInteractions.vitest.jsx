import {act,fireEvent,render,renderHook,screen,waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router';
import {beforeEach,expect,it,vi} from 'vitest';
import WorkoutHeatmap from '../WorkoutHeatmap';
import useWorkoutMap from '../useWorkoutMap';
import {DEFAULT_MAP_PREFERENCES} from '../workoutMapTokens';
import messages from '../../../i18n/locales/en/heatmapExplorer';

const mocks=vi.hoisted(()=>({api:vi.fn(),map:vi.fn(),token:'owner-one',pick:null,viewport:null,unit:'km'}));
vi.mock('../../../api',()=>({apiJson:(...args)=>mocks.api(...args)}));
vi.mock('../../../contexts/AuthContext',()=>({useAuth:()=>({token:mocks.token})}));
vi.mock('../../../contexts/I18nContext',()=>({useI18n:()=>({lang:'en',t:key=>messages.heatmapExplorer.workoutMap[key.split('.').at(-1)]||key})}));
vi.mock('../../../contexts/UnitContext',()=>({useUnit:()=>({unit:mocks.unit})}));
vi.mock('leaflet',()=>({default:{}}));
vi.mock('../workoutMapRenderer',()=>({createWorkoutMap:(L,node,options)=>{mocks.pick=options.onPick;mocks.viewport=options.onViewport;return {update:mocks.map,fit:()=>options.onReady(),zoom:vi.fn(),destroy:vi.fn()};}}));
const filter={q:'',from:'',to:'',sport:'RUN',gear:''};
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return{promise,resolve,reject};};
const query=(count=2,snapshot='one')=>({segments:[{activityId:1,coordinates:[[40,-74],[40.001,-74]]}],snapshot,complete:true,nextCursor:null,summary:{activityCount:count,gpsActivityCount:count,distanceKm:count*5},zone:'UTC',bounds:[40,-74,40.001,-73.999],options:{gear:{}}});
const detail={id:1,name:'Morning loop',distanceKm:5,movingTimeSeconds:1800,startDate:'2026-10-19'};
beforeEach(()=>{
  mocks.token='owner-one';mocks.unit='km';mocks.pick=null;mocks.api.mockReset();mocks.map.mockReset();
  mocks.api.mockImplementation((url,options={})=>{
    if(url.endsWith('/preferences'))return Promise.resolve({preferences:DEFAULT_MAP_PREFERENCES,revision:1,snapshot:'one'});
    if(url.endsWith('/workouts/query'))return Promise.resolve({items:[detail],snapshot:'one',nextCursor:null});
    if(url.endsWith('/query'))return Promise.resolve(query());
    if(url.startsWith('/api/activities'))return Promise.resolve(detail);
    if(url.includes('/track?'))return Promise.resolve({segments:query().segments,complete:true,nextCursor:null});
    if(url.includes('/tiles?'))return Promise.resolve({tileCount:3,newTileCount:2,tileZoom:14,cells:[[4824,6150],[4825,6150]],snapshot:'one',complete:true,nextCursor:null});
    throw new Error('Unexpected URL '+url+' '+options.method);
  });
});
const mount=()=>render(<MemoryRouter initialEntries={['/heatmap']}><WorkoutHeatmap/></MemoryRouter>);

it('F06-HCQ-E2 waits for a read-query throttle cooldown before retrying once',async()=>{
  vi.useFakeTimers();const original=mocks.api.getMockImplementation();let calls=0;
  mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')&&++calls===1?Promise.reject(Object.assign(new Error('throttled'),{status:429,retryAfter:'1'})):original(url,options));
  try {
    const {result}=renderHook(()=>useWorkoutMap('owner-one',filter,null));
    await act(async()=>vi.advanceTimersByTimeAsync(0));expect(result.current.data.state).toBe('loading');expect(calls).toBe(1);
    await act(async()=>vi.advanceTimersByTimeAsync(999));expect(calls).toBe(1);
    await act(async()=>vi.advanceTimersByTimeAsync(1));expect(calls).toBe(2);expect(result.current.data.state).toBe('ready');
  } finally {vi.useRealTimers();}
});

it('F06-HCQ-E3 retires a throttled read when filters change and bounds repeated throttles',async()=>{
  vi.useFakeTimers();const original=mocks.api.getMockImplementation();let calls=0;
  mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.q==='old'?(calls++,Promise.reject(Object.assign(new Error('throttled'),{status:429,retryAfter:'1'}))):original(url,options));
  try {
    const {result,rerender}=renderHook(({filters})=>useWorkoutMap('owner-one',filters,null),{initialProps:{filters:{...filter,q:'old'}}});
    await act(async()=>vi.advanceTimersByTimeAsync(0));expect(result.current.data.state).toBe('loading');
    rerender({filters:{...filter,q:'new'}});await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(result.current.data.state).toBe('ready');expect(calls).toBe(1);
    rerender({filters:{...filter,q:'old'}});await act(async()=>vi.advanceTimersByTimeAsync(1000));expect(result.current.data.state).toBe('error');expect(calls).toBe(3);
    await act(async()=>vi.advanceTimersByTimeAsync(60000));expect(calls).toBe(3);
  } finally {vi.useRealTimers();}
});

it('F06-HCQ-E4 never replays a throttled preference write',async()=>{
  const original=mocks.api.getMockImplementation();let patches=0;
  mocks.api.mockImplementation((url,options)=>options?.method==='PATCH'?(patches++,Promise.reject(Object.assign(new Error('throttled'),{status:429,retryAfter:'1'}))):original(url,options));
  const {result}=renderHook(()=>useWorkoutMap('owner-one',filter,null));await waitFor(()=>expect(result.current.settingsReady).toBe(true));
  await act(async()=>result.current.savePreferences({mode:'heat'}));expect(result.current.notice).toBe('settingsError');expect(result.current.preferences.mode).toBe('lines');expect(patches).toBe(1);
});

it('F04-HM-E1: does not reopen a dismissed slow workout after opening Display',async()=>{
  const pending=deferred();mocks.api.mockImplementation((url)=>url.startsWith('/api/activities')?pending.promise:url.endsWith('/preferences')?Promise.resolve({preferences:DEFAULT_MAP_PREFERENCES,revision:1}):Promise.resolve(query()));
  mount();await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));await screen.findByText('2 workouts · 10 km');
  act(()=>{void mocks.pick(['1']);});expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Display',exact:true}));
  await act(async()=>pending.resolve(detail));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('region',{name:'Display',exact:true})).toBeVisible();
});
it('F06-HM-E1: keeps the chosen display value visible throughout a slow save',async()=>{
  const pending=deferred();const original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>options?.method==='PATCH'?pending.promise:original(url,options));
  const {result}=renderHook(()=>useWorkoutMap('owner-one',filter,null));await waitFor(()=>expect(result.current.settingsReady).toBe(true));
  act(()=>{void result.current.savePreferences({mode:'heat'});});
  expect(result.current.preferences.mode).toBe('heat');expect(result.current.notice).toBe('saving');
  await act(async()=>pending.resolve({preferences:{...DEFAULT_MAP_PREFERENCES,mode:'heat'},revision:2}));
});
it('F06-HM-E2: rolls back a failed optimistic display patch and leaves retry available',async()=>{
  const pending=deferred(),original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>options?.method==='PATCH'?pending.promise:original(url,options));
  const {result}=renderHook(()=>useWorkoutMap('owner-one',filter,null));await waitFor(()=>expect(result.current.settingsReady).toBe(true));
  act(()=>{void result.current.savePreferences({mode:'heat'});});await act(async()=>pending.reject(new Error('offline')));
  expect(result.current.preferences.mode).toBe('lines');expect(result.current.notice).toBe('settingsError');expect(result.current.settingsReady).toBe(true);
});
it('F06-HM-E6: previews a width drag and saves only the completed value',async()=>{
  mount();await screen.findByText('2 workouts · 10 km');fireEvent.click(screen.getByRole('button',{name:'Display',exact:true}));
  const slider=screen.getByRole('slider',{name:/^Line width/});await waitFor(()=>expect(slider).toBeEnabled());
  fireEvent.change(slider,{target:{value:'3'}});fireEvent.change(slider,{target:{value:'4.5'}});
  expect(slider).toBeEnabled();expect(mocks.api.mock.calls.filter(([,options])=>options?.method==='PATCH')).toHaveLength(0);
  fireEvent.pointerUp(slider);
  await waitFor(()=>expect(mocks.api.mock.calls.filter(([,options])=>options?.method==='PATCH')).toHaveLength(1));
  const [,options]=mocks.api.mock.calls.find(([,options])=>options?.method==='PATCH');expect(JSON.parse(options.body)).toEqual({weight:4.5});
});
it('F04-HM-E6: never exposes retired account totals or settings while the next owner loads',async()=>{
  const {result,rerender}=renderHook(({account})=>useWorkoutMap(account,filter,null),{initialProps:{account:'owner-one'}});
  await waitFor(()=>expect(result.current.data.summary?.activityCount).toBe(2));
  mocks.api.mockImplementation(()=>new Promise(()=>{}));rerender({account:'owner-two'});
  expect(result.current.data.summary).toBeUndefined();expect(result.current.data.segments).toEqual([]);expect(result.current.settingsReady).toBe(false);
});
it('F02-HM-E3: ignores an older geometry response after filters change',async()=>{
  const old=deferred(),original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.q==='old'?old.promise:original(url,options));
  const {result,rerender}=renderHook(({filters})=>useWorkoutMap('owner-one',filters,null),{initialProps:{filters:{...filter,q:'old'}}});
  await waitFor(()=>expect(mocks.api.mock.calls.some(([u,o])=>u.endsWith('/heatmap/query')&&JSON.parse(o.body).filter.q==='old')).toBe(true));
  rerender({filters:{...filter,q:'new'}});await waitFor(()=>expect(result.current.data.state).toBe('ready'));
  await act(async()=>old.resolve(query(999,'retired')));expect(result.current.data.summary.activityCount).toBe(2);expect(result.current.data.snapshot).toBe('one');
});
it('F04-HM-E2: no stored GPS keeps the popup and matching totals',async()=>{
  const original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>url.includes('/track?')?Promise.resolve({segments:[],complete:true,nextCursor:null}):original(url,options));
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});
  await screen.findByRole('heading',{name:'Morning loop'});fireEvent.click(screen.getByRole('button',{name:'Highlight route',exact:true}));
  expect(await screen.findByText('No stored GPS route is available.')).toBeVisible();expect(screen.getByRole('dialog')).toBeVisible();expect(screen.getByText('2 workouts · 10 km')).toBeVisible();
  fireEvent.keyDown(document,{key:'Escape'});expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
it('F04-HM-E8: a refreshed snapshot reloads selected metadata without dismissing the popup',async()=>{
  let queries=0;const original=mocks.api.getMockImplementation();
  mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')?Promise.resolve(query(2,++queries===1?'one':'two')):url.endsWith('/workouts/query')?Promise.resolve({items:[{...detail,name:queries>1?'Refreshed loop':'Morning loop'}],snapshot:queries>1?'two':'one'}):url.startsWith('/api/activities')?Promise.resolve({...detail,name:queries>1?'Refreshed loop':'Morning loop'}):original(url,options));
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});await screen.findByRole('heading',{name:'Morning loop'});
  act(()=>window.dispatchEvent(new Event('hermes:strava-sync-finished')));
  expect(await screen.findByRole('heading',{name:'Refreshed loop'})).toBeVisible();expect(screen.getByRole('dialog')).toBeVisible();
});
it('F02-HM-E4: miles distance filters submit canonical kilometres',async()=>{
  mocks.unit='mile';mount();await screen.findByText('2 workouts · 6.2 mi');fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  fireEvent.change(screen.getByRole('spinbutton',{name:'Minimum distance (mi)',exact:true}),{target:{value:'5'}});fireEvent.click(screen.getByRole('button',{name:'Apply',exact:true}));
  await waitFor(()=>expect(mocks.api.mock.calls.some(([url,options])=>url.endsWith('/heatmap/query')&&Math.abs((JSON.parse(options.body).filter.minDistanceKm||0)-8.04672)<.000001)).toBe(true));
});
it('shows descriptive overlaps and offers the existing list when candidates are bounded',async()=>{
  const original=mocks.api.getMockImplementation();
  mocks.api.mockImplementation((url,options)=>url.endsWith('/workouts/query')?Promise.resolve({items:[{...detail,date:'2026-10-19',device:'Stored watch',sourceGear:'Poles'}],snapshot:'one'}):original(url,options));
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));
  act(()=>{void mocks.pick({ids:['1','2'],total:20});});
  expect(await screen.findByRole('option',{name:'Morning loop · 2026-10-19 · 5 km'})).toBeInTheDocument();
  expect(screen.getByText('Stored watch')).toBeVisible();expect(screen.getByText('Poles')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Browse all matches',exact:true}));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('region',{name:'Filters',exact:true})).toBeVisible();
});
it('submits advanced speed/elevation in SI and keeps Advanced initially collapsed',async()=>{
  mocks.unit='mile';mount();await screen.findByText('2 workouts · 6.2 mi');fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  const advanced=screen.getByText('Advanced filters').closest('details');expect(advanced.open).toBe(false);fireEvent.click(screen.getByText('Advanced filters'));
  fireEvent.change(screen.getByLabelText('Minimum average speed (mi/h)'),{target:{value:'6'}});
  fireEvent.change(screen.getByLabelText('Minimum elevation gain (ft)'),{target:{value:'100'}});
  fireEvent.change(screen.getByLabelText('Gear'),{target:{value:'UNKNOWN'}});
  fireEvent.click(screen.getByRole('button',{name:'Apply',exact:true}));
  await waitFor(()=>expect(mocks.api.mock.calls.some(([url,options])=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.minSpeedKmh>0)).toBe(true));
  const [,options]=mocks.api.mock.calls.filter(([url,options])=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.minSpeedKmh>0).at(-1),value=JSON.parse(options.body).filter;
  expect(value.minSpeedKmh).toBeCloseTo(9.656064);expect(value.minAscentM).toBeCloseTo(30.48);expect(value.gear).toBe('UNKNOWN');
});
it('preserves the bounded-overlap explanation after an unavailable workout is retried',async()=>{
  const original=mocks.api.getMockImplementation();let failed=true;
  mocks.api.mockImplementation((url,options)=>{if(url.startsWith('/api/activities')&&failed){failed=false;return Promise.reject(new Error('offline'));}return original(url,options);});
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));
  act(()=>{void mocks.pick({ids:['1','2'],total:20});});await screen.findByRole('alert');
  fireEvent.click(screen.getByRole('button',{name:'Retry',exact:true}));await screen.findByRole('heading',{name:'Morning loop'});
  expect(screen.getByRole('button',{name:'Browse all matches',exact:true})).toBeVisible();
});
it('shows precise retained metrics and keeps tile highlighting on demand',async()=>{
  const original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>url.endsWith('/workouts/query')?Promise.resolve({items:[{...detail,distanceKm:5.0081,movingSeconds:1992}],snapshot:'one'}):original(url,options));
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});
  expect(await screen.findByText('5.01 km')).toBeVisible();expect(screen.getByText('9.05 km/h')).toBeVisible();
  expect(await screen.findByText('3 / 2')).toBeVisible();fireEvent.click(screen.getByRole('button',{name:'Highlight new coverage',exact:true}));
  await waitFor(()=>expect(mocks.map.mock.calls.some(call=>call[2]?.cells?.length===2)).toBe(true));expect(screen.getByText('2 workouts · 10 km')).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Show all routes',exact:true}));await waitFor(()=>expect(mocks.map.mock.calls.at(-1)[2]).toBeNull());
});
it('keeps unknown coverage honest and ignores a late coverage reply after dismissal',async()=>{
  const pending=deferred(),original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>url.includes('/tiles?')?pending.promise:original(url,options));
  mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});await screen.findByRole('heading',{name:'Morning loop'});
  expect(screen.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();fireEvent.click(screen.getByRole('button',{name:'Display',exact:true}));
  await act(async()=>pending.resolve({tileCount:3,newTileCount:2,tileZoom:14,cells:[[1,2]],snapshot:'one',complete:true,nextCursor:null}));expect(screen.queryByRole('dialog')).not.toBeInTheDocument();expect(screen.getByRole('region',{name:'Display',exact:true})).toBeVisible();
});
it('shows unavailable metrics honestly when distance was not recorded',async()=>{
 const original=mocks.api.getMockImplementation();mocks.api.mockImplementation((url,options)=>url.endsWith('/workouts/query')?Promise.resolve({items:[{...detail,distanceKm:null}],snapshot:'one'}):original(url,options));
 mount();await screen.findByText('2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});await screen.findByRole('heading',{name:'Morning loop'});
 expect(screen.queryByText(/NaN/)).not.toBeInTheDocument();
});
it.each([{unit:'km',distanceKm:5.0055,movingSeconds:1992,pace:'6:37 /km'}, {unit:'mile',distanceKm:1.609344*359/359.9,movingSeconds:359,pace:'5:59 /mi'}])('F04-CV-H1/E5 presents completed pace seconds in $unit',async({unit,distanceKm,movingSeconds,pace})=>{
 mocks.unit=unit;const original=mocks.api.getMockImplementation();
 mocks.api.mockImplementation((url,options)=>url.endsWith('/workouts/query')?Promise.resolve({items:[{...detail,distanceKm,movingSeconds}],snapshot:'one'}):original(url,options));
 mount();await screen.findByText(unit==='mile'?'2 workouts · 6.2 mi':'2 workouts · 10 km');await waitFor(()=>expect(mocks.pick).toBeTypeOf('function'));act(()=>{void mocks.pick(['1']);});await screen.findByRole('heading',{name:'Morning loop'});
 expect(screen.getByText(pace)).toBeVisible();
});


it('keeps routes and filters while collapsing and reopening the summary',async()=>{
  mount();await screen.findByText('2 workouts · 10 km');
  const queries=()=>mocks.api.mock.calls.filter(([url])=>url.endsWith('/heatmap/query')).length;
  const before=queries();fireEvent.click(screen.getByRole('button',{name:'Collapse summary'}));
  expect(screen.queryByRole('region',{name:'Map summary'})).not.toBeInTheDocument();
  await waitFor(()=>expect(screen.getByRole('button',{name:'Show heatmap summary and filters'})).toHaveFocus());
  expect(screen.getByRole('region',{name:/Workout map/})).toBeVisible();
  fireEvent.click(screen.getByRole('button',{name:'Show heatmap summary and filters'}));
  await waitFor(()=>expect(screen.getByRole('button',{name:'Collapse summary'})).toHaveFocus());
  expect(screen.getByText('2 workouts · 10 km')).toBeVisible();expect(queries()).toBe(before);
});

it('applies a quick date range without dropping existing workout filters',async()=>{
  render(<MemoryRouter initialEntries={['/heatmap?q=loop&minDistanceKm=2']}><WorkoutHeatmap/></MemoryRouter>);
  await screen.findByText('2 workouts · 10 km');
  fireEvent.click(screen.getByRole('button',{name:'Year to date',exact:true}));
  await waitFor(()=>expect(mocks.api.mock.calls.some(([url,options])=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.q==='loop'&&JSON.parse(options.body).filter.from.endsWith('-01-01'))).toBe(true));
  fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
  expect(screen.getByRole('searchbox',{name:'Workout name'})).toHaveValue('loop');
  expect(screen.getByLabelText('Minimum distance (km)')).toHaveValue(2);
  fireEvent.change(screen.getByLabelText('From date'),{target:{value:'2020-02-02'}});
  expect(screen.getAllByRole('button',{name:'Year to date',exact:true})[1]).toHaveAttribute('aria-pressed','false');
});


it('keeps the account calendar during a filter reload near UTC midnight',async()=>{
  vi.useFakeTimers({toFake:['Date']});vi.setSystemTime(new Date('2026-10-20T00:15:00Z'));
  const original=mocks.api.getMockImplementation();
  mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')?(JSON.parse(options.body).filter.q?new Promise(()=>{}):Promise.resolve({...query(),zone:'America/New_York'})):original(url,options));
  try {
    mount();await screen.findByText('2 workouts · 10 km');fireEvent.click(screen.getByRole('button',{name:'Filters',exact:true}));
    fireEvent.change(screen.getByRole('searchbox',{name:'Workout name'}),{target:{value:'loop'}});fireEvent.click(screen.getByRole('button',{name:'Apply',exact:true}));
    fireEvent.click(screen.getByRole('button',{name:'Close',exact:true}));fireEvent.click(screen.getByRole('button',{name:'Year to date',exact:true}));
    await waitFor(()=>expect(mocks.api.mock.calls.some(([url,options])=>url.endsWith('/heatmap/query')&&JSON.parse(options.body).filter.to==='2026-10-19')).toBe(true));
  } finally {vi.useRealTimers();}
});


it('loads the complete detailed route set once without a viewport bound',async()=>{
  const original=mocks.api.getMockImplementation(),tail=deferred();let pages=0;
  mocks.api.mockImplementation((url,options)=>url.endsWith('/heatmap/query')?(++pages===1?Promise.resolve({...query(),complete:false,nextCursor:'tail'}):tail.promise):original(url,options));
  const {result,rerender}=renderHook(({filters})=>useWorkoutMap('owner-one',filters),{initialProps:{filters:filter}});
  await waitFor(()=>expect(pages).toBe(2));
  const requests=mocks.api.mock.calls.filter(([url])=>url.endsWith('/heatmap/query')).map(([,options])=>JSON.parse(options.body));
  expect(requests[0].zoom).toBe(20);expect(requests[0]).not.toHaveProperty('bbox');expect(requests[1]).toMatchObject({zoom:20,snapshot:'one',cursor:'tail'});
  await act(async()=>tail.resolve({...query(),segments:[{activityId:2,coordinates:[[50,10],[50.001,10]]}]}));
  await waitFor(()=>expect(result.current.data.state).toBe('ready'));expect(result.current.data.segments).toHaveLength(2);
  const loaded=result.current.data.segments;rerender({filters:{...filter}});
  await act(async()=>new Promise(resolve=>setTimeout(resolve,180)));expect(pages).toBe(2);expect(result.current.data.segments).toBe(loaded);
});


it('refreshes only for history changes in the current account across tabs',async()=>{
 const {result}=renderHook(()=>useWorkoutMap('owner-one',filter,'runner@example.test'));
 await waitFor(()=>expect(result.current.data.state).toBe('ready'));
 const reads=()=>mocks.api.mock.calls.filter(([url])=>url.endsWith('/heatmap/query')).length;
 const before=reads();
 act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'hermes_heatmap_cache_gen_v1_profile-heatmap:v2:another@example.test',newValue:'1'})));
 expect(reads()).toBe(before);
 act(()=>window.dispatchEvent(new StorageEvent('storage',{key:'hermes_heatmap_cache_gen_v1_profile-heatmap:v2:runner@example.test',newValue:'1'})));
 await waitFor(()=>expect(reads()).toBe(before+1));
});


it('keeps loaded geometry after a display-only save using the server snapshot',async()=>{
 const original=mocks.api.getMockImplementation();
 mocks.api.mockImplementation((url,options)=>options?.method==='PATCH'?Promise.resolve({preferences:{...DEFAULT_MAP_PREFERENCES,mode:'heat'},revision:2,snapshot:'two'}):original(url,options));
 const {result}=renderHook(()=>useWorkoutMap('owner-one',filter));await waitFor(()=>expect(result.current.data.state).toBe('ready'));
 const segments=result.current.data.segments,reads=()=>mocks.api.mock.calls.filter(([url])=>url.endsWith('/heatmap/query')).length,before=reads();
 await act(async()=>result.current.savePreferences({mode:'heat'}));
 expect(result.current.data.snapshot).toBe('two');expect(result.current.data.state).toBe('ready');expect(result.current.data.segments).toBe(segments);expect(reads()).toBe(before);
});
