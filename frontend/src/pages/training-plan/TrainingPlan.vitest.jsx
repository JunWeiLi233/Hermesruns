import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { webcrypto } from 'node:crypto';
import { I18nProvider } from '../../contexts/I18nContext';
import { UnitProvider } from '../../contexts/UnitContext';
import TrainingPlan, {RunPlanManualRunEntry} from './TrainingPlan';
import VersionedPlanRoute from './VersionedPlanRoute';
import { apiFetch } from '../../api';
import { pendingRun, queueManualRun, savePendingRun, discardPendingRun } from './manualOutbox';
vi.mock('../../api', () => ({ apiFetch: vi.fn(), subscribeWakeRetry:()=>()=>{} }));
vi.mock('./manualOutbox',()=>({pendingRun:vi.fn(),queueManualRun:vi.fn(),savePendingRun:vi.fn(),discardPendingRun:vi.fn(),MANUAL_RUN_CHANGED:'hermes-manual-run-changed'}));
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ email: 'runner@hermes.test', token: 'owned-session' }) }));
vi.mock('../../components/TopbarUserMenu', () => ({ default: () => null }));

const inputs = { title: 'A complete training plan', goalKind:'DISTANCE',startDate: '2026-10-19', endDate: '2027-01-10', timeZone: 'America/New_York', goalDistanceM: 5000, trainingMode: 'RUN_WALK', runsPerWeek: 3, baselineWeeklyM: 0,baselineRunsPerWeek:0,longestRecentM:0,availableWeekdays:[2,4,7],longRunWeekday:7, volume: 'STANDARD', difficulty: 'EASY' };
const workout = { id: 'workout-1', localDate: '2026-10-20', workoutType: 'RUN_WALK', phase: 'ADAPT', targetDistanceM: null, targetDurationS: 1320, state: 'PLANNED', completionSource: 'NONE', revision: 0, steps: [{ stepType: 'WARMUP', durationS: 300, distanceM: null, effortKey: 'WALK' }, { stepType: 'RUN', durationS: 30, distanceM: null, effortKey: 'EASY' }] };
const preview = { id: 'version-1', planId: 'plan-1', title: inputs.title, inputs, contentHash: 'exact-reviewed-hash', baseRevision: 0, activePlanId: null, activePlanRevision: null, rulesApproved: true, state: 'READY', stale: false, warnings: ['TIMED_RUN_WALK_GOAL'], weeks: [{ startDate: '2026-10-19', phase: 'ADAPT', runCount: 1, trainingDurationS: 1320, days: [workout] }] };
let calls, draft, todayResponse, previewResponse, paceReviewResponse;
function mount(url) {
  url=url.replace('/training-plan/plan-1/preview/version-1','/schedule?planView=preview&planId=plan-1&versionId=version-1').replace('/training-plan/plan-1/workouts/workout-1','/today-run?planId=plan-1&workoutId=workout-1').replace('/training-plan/setup','/schedule?planView=setup').replace('/training-plan','/schedule');
  return render(<MemoryRouter initialEntries={[url]}><I18nProvider><UnitProvider><Routes><Route path="/schedule" element={<VersionedPlanRoute><TrainingPlan/></VersionedPlanRoute>}/><Route path="/today-run" element={<VersionedPlanRoute><TrainingPlan mode="today"/></VersionedPlanRoute>}/><Route path="/runs" element={<RunPlanManualRunEntry/>}/></Routes></UnitProvider></I18nProvider></MemoryRouter>);
}

beforeEach(() => {
  paceReviewResponse={state:'NOT_AVAILABLE',sampleCount:0,sources:[],excludedSources:[]};
  pendingRun.mockResolvedValue(null);queueManualRun.mockResolvedValue(null);savePendingRun.mockResolvedValue(null);discardPendingRun.mockResolvedValue(null);
  vi.stubGlobal('crypto', webcrypto); localStorage.setItem('hermes_lang', 'en'); localStorage.setItem('hermes_unit', 'km'); calls = [];todayResponse={state:'NO_PLAN'};previewResponse=JSON.parse(JSON.stringify(preview));
  apiFetch.mockImplementation(async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null; calls.push({ url, body, options }); let result;
    if (url === '/api/run-plans') {if(body)draft={id:'plan-1',state:'DRAFT',revision:0,inputs:body.inputs,setupStep:body.setupStep,versions:[]};result = body ? { id: 'plan-1', revision: 0 } : { ownerId: 'owner-1', plans: [], rulesApproved: true };}
    else if(url==='/api/run-plans/plan-1'){if(body)draft={...draft,inputs:body.inputs,setupStep:body.setupStep??4,revision:draft.revision+1};result=draft;}
    else if (url === '/api/profile/me') result = { timeZone: 'America/New_York' };
    else if (url === '/api/plan-profile') result = body ? { revision: 0 } : { profile: null };
    else if (url.endsWith('/versions') && body) result = { id: 'version-1' };
    else if (url.includes('/versions/')) result = previewResponse;
    else if (url.endsWith('/activate') || url.endsWith('/link')) result = { id: 'plan-1' };
    else if(url.endsWith('/pace-review'))result=paceReviewResponse;
    else if (url.endsWith('/today')) result = todayResponse;
    else if (url.includes('/workouts?')) result = {weeks:[],actualDistanceM:0,actualDurationS:0,unknownDateCount:0};
    else if (url.includes('activity-candidates')) result = { activities: [{ id: '123456789012345678', name: 'A real saved run', distanceM: 2200, durationS: 900, localDate: '2026-10-19', metricHash: 'actual-metric-hash', warnings: ['DIFFERENT_DAY'] }], nextCursor: null };
    else if (url.includes('/workouts/')) result = { workout, plan: { id: 'plan-1', title: inputs.title, state: 'ACTIVE', inputs }, link: null };
    else throw new Error(`Unexpected test request: ${url}`);
    return new Response(JSON.stringify(result), { status: 200, headers: { 'Content-Type': 'application/json' } });
  });
});
afterEach(() => { cleanup();vi.useRealTimers();vi.unstubAllGlobals();sessionStorage.clear();vi.clearAllMocks(); });

it('keeps authored-calendar parents out of generated-plan editing even on a saved setup link',async()=>{
  draft={id:'plan-1',state:'EXTERNAL',revision:1,inputs:{},setupStep:0};
  mount('/schedule?planView=setup&planId=plan-1');
  expect(await screen.findByText('Manage this authored workout in your calendar. It cannot be edited as a generated training plan.')).toBeVisible();
  expect(screen.queryByRole('button',{name:'Next',exact:true})).not.toBeInTheDocument();
  expect(calls.some(c=>c.url.endsWith('/versions')&&c.body)).toBe(false);
});

it('shows an authored completion link without offering a generated-plan unlink command',async()=>{
  const original=apiFetch.getMockImplementation();
  apiFetch.mockImplementation((url,options)=>url==='/api/run-plans/plan-1/workouts/workout-1'?Promise.resolve(new Response(JSON.stringify({workout:{...workout,state:'COMPLETED'},plan:{id:'plan-1',title:'Authored calendar',state:'EXTERNAL',inputs},link:{activityId:42}}),{status:200})):original(url,options));
  mount('/training-plan/plan-1/workouts/workout-1');
  expect(await screen.findByRole('link',{name:'View actual run'})).toHaveAttribute('href','/runs/42');
  expect(screen.queryByRole('button',{name:/Unlink/})).not.toBeInTheDocument();
});

it('keeps experimental status visible in approved previews and activation dialogs',async()=>{
  const user=userEvent.setup();mount('/training-plan/plan-1/preview/version-1');
  const notice='This experimental plan has not been statistically validated for training outcomes.';
  expect(await screen.findByText(notice,{exact:true})).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Ready to begin?',exact:true}));
  expect(within(screen.getByRole('dialog')).getByText(notice,{exact:true})).toBeVisible();
});

it('requires separate experimental consent and sends it with the exact preview',async()=>{
  previewResponse={...preview,rulesApproved:false,activationAllowed:true,experimentalActivation:true,warnings:[]};
  const user=userEvent.setup();mount('/training-plan/plan-1/preview/version-1');
  await user.click(await screen.findByRole('button',{name:'Ready to begin?',exact:true}));
  const dialog=screen.getByRole('dialog');
  await user.click(within(dialog).getByLabelText('I have reviewed all weeks and the notes above.'));
  const activate=within(dialog).getByRole('button',{name:'Activate this plan',exact:true});
  expect(activate).toBeDisabled();
  await user.click(within(dialog).getByLabelText('I understand this plan is experimental, has no recorded qualified coaching sign-off, and has not been validated for training outcomes.'));
  expect(activate).toBeEnabled();await user.click(activate);
  await waitFor(()=>expect(calls.find(c=>c.url.endsWith('/activate'))?.body).toMatchObject({contentHash:'exact-reviewed-hash',acknowledgedExperimental:true}));
});

it('requires explicit acknowledgement of reduced session exposure before exact activation',async()=>{
  const user=userEvent.setup();previewResponse={...preview,warnings:['SESSION_EXPOSURE_REDUCED']};
  mount('/training-plan/plan-1/preview/version-1');
  expect(await screen.findByText(/Some future runs were shortened to follow individual-session progression/)).toBeVisible();
  await user.click(screen.getByRole('button',{name:'Ready to begin?',exact:true}));
  const dialog=screen.getByRole('dialog');
  await user.click(within(dialog).getByLabelText('I have reviewed all weeks and the notes above.'));
  const activate=within(dialog).getByRole('button',{name:'Activate this plan',exact:true});
  expect(activate).toBeDisabled();
  await user.click(within(dialog).getByLabelText('I understand this note.'));
  expect(activate).toBeEnabled();await user.click(activate);
  await waitFor(()=>expect(calls.find(c=>c.url.endsWith('/activate'))?.body).toMatchObject({contentHash:'exact-reviewed-hash',acknowledgedWarnings:['SESSION_EXPOSURE_REDUCED']}));
});

describe('Hermes versioned training website', () => {
  it('explains why a linked run was excluded from pace evidence and links its actual facts',async()=>{
    const user=userEvent.setup();
    todayResponse={state:'REST',localDate:'2026-10-14',plan:{id:'plan-1',title:'A pace plan',state:'ACTIVE',inputs:{...inputs,trainingMode:'DISTANCE'}}};
    paceReviewResponse={state:'NEED_MORE',sampleCount:2,sources:[],excludedSources:[{activityId:'partial-actual',name:'Partial Élan',localDate:'2026-10-13',reason:'INCOMPLETE'}]};
    mount('/training-plan');
    await user.click(await screen.findByText('Why other linked runs were left out'));
    expect(screen.getByRole('link',{name:'Partial Élan'})).toHaveAttribute('href','/runs/partial-actual');
    expect(screen.getByText(/This session needs a complete run link\. Partial and unlogged completion do not enter this check\./)).toBeVisible();
    expect(screen.queryByRole('button',{name:'Review pace change',exact:true})).toBeNull();
  });
  it('keeps an acknowledged extra-run receipt visible if local cleanup fails',async()=>{
    const user=userEvent.setup();
    savePendingRun.mockResolvedValue({owner:'owner-1',linkIntent:null,saved:{id:'saved-extra'},body:{name:'Extra actual'}});
    discardPendingRun.mockRejectedValueOnce(new Error('IndexedDB cleanup aborted'));
    mount('/runs?manual=1');
    await screen.findByRole('textbox',{name:'Run name',exact:true});
    const dialog=document.body;
    await user.type(within(dialog).getByRole('textbox',{name:'Run name',exact:true}),'Extra actual');
    await user.type(within(dialog).getByRole('spinbutton',{name:'Actual distance (km)',exact:true}),'2.3');
    await user.type(within(dialog).getByRole('spinbutton',{name:'Duration (minutes)',exact:true}),'18');
    await user.click(within(dialog).getByRole('button',{name:'Save run',exact:true}));
    expect(await screen.findByRole('link',{name:'View actual run',exact:true})).toHaveAttribute('href','/runs/saved-extra');
    expect(screen.getByText('Your run is saved, but this browser could not clear its recovery copy. Reopen this form to retry cleanup.')).toBeVisible();
    expect(savePendingRun).toHaveBeenCalledTimes(1);
  });
  it('reopens an acknowledged extra run by retrying cleanup without creating or saving again',async()=>{
    pendingRun.mockResolvedValue({owner:'owner-1',linkIntent:null,saved:{id:'recovered-extra'},body:{name:'Recovered extra'}});
    mount('/runs?manual=1');
    expect(await screen.findByRole('link',{name:'View actual run',exact:true})).toHaveAttribute('href','/runs/recovered-extra');
    await waitFor(()=>expect(discardPendingRun).toHaveBeenCalledTimes(1));
    expect(queueManualRun).not.toHaveBeenCalled();expect(savePendingRun).not.toHaveBeenCalled();
  });
  it('shows both known training target metrics when a week mixes timed and distance prescriptions', async () => {
    previewResponse.weeks[0].trainingDistanceM=2300;
    mount('/training-plan/plan-1/preview/version-1');
    const label=await screen.findByText('Training only');
    expect(within(label.parentElement).getByRole('definition')).toHaveTextContent('2.3 km · 22:00');
  });
  it('refreshes Today when midnight passes in the plan time zone', async () => {
    vi.useFakeTimers({toFake:['Date','setInterval','clearInterval']});vi.setSystemTime(new Date('2026-10-14T03:59:30Z'));
    todayResponse={state:'TODAY',localDate:'2026-10-13',plan:{id:'plan-1',title:'Midnight plan',state:'ACTIVE',inputs},workout:{...workout,localDate:'2026-10-13'}};
    mount('/training-plan');await screen.findByRole('heading',{name:'Midnight plan'});
    todayResponse={...todayResponse,localDate:'2026-10-14',workout:{...workout,localDate:'2026-10-14'}};
    await act(async()=>{await vi.advanceTimersByTimeAsync(60000);});
    expect(calls.filter(c=>c.url.endsWith('/today'))).toHaveLength(2);
    expect(calls.filter(c=>c.url.endsWith('/today')).at(-1)).toBeDefined();
  });
  it('confirms setup, reviews the returned full snapshot, and activates its exact hash only after acknowledgements', async () => {
    const user = userEvent.setup();mount('/training-plan/setup');
    await user.type(await screen.findByLabelText(/Plan name/), 'My independent 5K');
    await user.click(screen.getByLabelText('I confirm I am 18 or older.'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByLabelText('I can comfortably walk for 20 minutes.'));
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('group',{name:'Available days'});
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await screen.findByRole('group',{name:'Volume preference'});
    await user.click(screen.getByRole('button', { name: 'Continue' }));
    await user.click(await screen.findByLabelText('I have checked these baseline values and my availability.'));
    await user.click(screen.getByRole('button', { name: 'Generate full plan' }));
    await screen.findByText('Your whole plan, before you begin.');
    expect(calls.find(c => c.url.endsWith('/versions')).body.inputs.adultConfirmed).toBe(true);
    expect(calls.find(c => c.url.endsWith('/versions')).body.inputs.canWalk20Minutes).toBe(true);
    expect(calls.some(c => c.url.endsWith('/activate'))).toBe(false);
    await user.click(await screen.findByRole('button', { name: 'Activate this plan' }));
    const modal = screen.getByRole('dialog');
    expect(within(modal).getByRole('button', { name: 'Activate this plan' }).disabled).toBe(true);
    await user.click(within(modal).getByLabelText('I understand this note.'));
    await user.click(within(modal).getByLabelText('I have reviewed all weeks and the notes above.'));
    await user.click(within(modal).getByRole('button', { name: 'Activate this plan' }));
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/activate'))?.body.contentHash).toBe('exact-reviewed-hash'));
  });
  it('links a bigint activity ID unchanged with an explicit partial decision and date acknowledgement', async () => {
    const user = userEvent.setup();mount('/training-plan/plan-1/workouts/workout-1');
    await user.click(await screen.findByRole('button', { name: 'Link a completed run' }));
    const modal = screen.getByRole('dialog');
    await user.click(await within(modal).findByLabelText(/A real saved run/));
    await user.click(within(modal).getByLabelText('Partly completed'));
    const confirm = within(modal).getByRole('button', { name: 'Confirm run link' });expect(confirm.disabled).toBe(true);
    await user.click(within(modal).getByLabelText('I understand this note.'));await user.click(confirm);
    await waitFor(() => expect(calls.find(c => c.url.endsWith('/link'))?.body).toMatchObject({ activityId: '123456789012345678', decision: 'PARTIAL', metricHash: 'actual-metric-hash', revision: 0, acknowledgedWarnings: ['DIFFERENT_DAY'] }));
  });
});
