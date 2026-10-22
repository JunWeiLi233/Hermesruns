import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test,expect,browserLogin,login,inputs,active,get,post,command,scan,addDays,today} from './helpers.mjs';
import {expectNativeCalendar,openPlanManagement,openFullPlan,previewVersionId} from './native-plan.ui.mjs';

const distanceInputs=()=>inputs({trainingMode:'DISTANCE',experience:'INTERMEDIATE',baselineWeeklyM:18000,baselineRunsPerWeek:3,longestRecentM:6000,difficulty:'STANDARD'});
async function screenshot(page,name){const dir=resolve(import.meta.dirname,'../../replica/runna/clone-screens/website-parity');await mkdir(dir,{recursive:true});await page.screenshot({path:resolve(dir,`${name}.png`),fullPage:false});}
for(const [width,height,n] of [[390,844,41],[1440,900,42]])test(`S07 session ceilings and immutable full preview ${width}`,async({page,request},info)=>{
  const auth=await browserLogin(page,request,n);await page.setViewportSize({width,height});const i=distanceInputs();
  const p=await post(request,auth,'/api/run-plans',command({inputs:i,setupStep:3}));await page.goto(`/training-plan/setup/${p.id}`);
  for(const name of ['Easy-session limit','Steady-session limit','Interval-session limit'])await page.getByRole('spinbutton',{name:`${name} (km)`,exact:true}).fill('4');
  await page.getByRole('spinbutton',{name:'Long-session limit (km)',exact:true}).fill('5');
  await scan(page,`caps-${width}`,info);await screenshot(page,`S07-caps-${width}x${height}`);
  await page.getByRole('button',{name:'Continue',exact:true}).click();await page.getByLabel('I have checked these baseline values and my availability.').check();
  await page.getByRole('button',{name:'Generate full plan',exact:true}).click();await expect(page.getByRole('button',{name:'Ready to begin?'})).toBeVisible();
  const pid=p.id;const vId=previewVersionId(page);const v=await get(request,auth,`/api/run-plans/${pid}/versions/${vId}`);
  expect(v.inputs.sessionCaps.easyM).toBe(4000);expect(v.warnings).toContain('SESSION_CAPS_APPLIED');
  for(const d of v.weeks.flatMap(w=>w.days))if(d.targetDistanceM!=null&&d.workoutType!=='EVENT')expect(d.targetDistanceM).toBeLessThanOrEqual(d.workoutType==='LONG'?5000:4000);
  expect((await get(request,auth,`/api/run-plans/${pid}`)).state).toBe('DRAFT');await scan(page,`caps-preview-${width}`,info);
});

for(const [width,height,n] of [[390,844,43],[1440,900,44]])test(`S11 move preview keeps active targets and requires exact activation ${width}`,async({page,request},info)=>{
  const auth=await browserLogin(page,request,n);await page.setViewportSize({width,height});const c=await active(request,auth,distanceInputs());
  const w=c.days.find(d=>d.workoutType==='EASY'&&d.localDate>today()&&new Date(`${d.localDate}T12:00:00Z`).getUTCDay()===2);
  const target=addDays(w.localDate,1);await page.goto(`/training-plan/${c.p.id}/workouts/${w.id}`);await page.getByRole('button',{name:'Move this session',exact:true}).click();
  const dialog=page.getByRole('dialog');await dialog.getByLabel('New session date').fill(target);await scan(page,`move-${width}`,info);await screenshot(page,`S11-move-${width}x${height}`);
  await dialog.getByRole('button',{name:'Review changed calendar',exact:true}).click();await expect(page.getByText(`Session move for review: ${w.localDate} → ${target}. Your active plan is unchanged until activation.`)).toBeVisible();
  expect((await get(request,auth,`/api/run-plans/${c.p.id}/workouts/${w.id}`)).workout.localDate).toBe(w.localDate);
  const next=await get(request,auth,`/api/run-plans/${c.p.id}/versions/${previewVersionId(page)}`);const moved=next.weeks.flatMap(w=>w.days).find(d=>d.localDate===target);
  expect(moved.steps).toEqual(w.steps);expect(moved.targetDistanceM).toBe(w.targetDistanceM);
  await page.getByRole('button',{name:'Ready to begin?'}).click();const activation=page.getByRole('dialog');
  for(const checkbox of await activation.getByRole('checkbox',{name:'I understand this note.',exact:true}).all())await checkbox.check();
  await activation.getByLabel('I have reviewed all weeks and the notes above.').check();await activation.getByRole('button',{name:'Activate this plan',exact:true}).click();
  await expectNativeCalendar(page,c.v.title);await page.goto(`/training-plan/${c.p.id}/workouts/${moved.id}`);
  await expect(page.getByRole('button',{name:'Move this session',exact:true})).toBeVisible();await scan(page,`moved-detail-${width}`,info);
});

test('Caps reject unsupported units and moves reject occupied dates and stale revisions',async({request})=>{
  const auth=await login(request,45);const c=await active(request,auth,distanceInputs());const current=await get(request,auth,`/api/run-plans/${c.p.id}`);
  const w=c.days.find(d=>d.workoutType==='EASY'&&d.localDate>today()&&new Date(`${d.localDate}T12:00:00Z`).getUTCDay()===2);
  const body={baseRevision:current.revision,revision:0,targetDate:addDays(w.localDate,2)};
  const rejected=await post(request,auth,`/api/run-plans/${c.p.id}/workouts/${w.id}/move-preview`,command(body),422);expect(rejected.code).toBe('MOVE_DATE_OCCUPIED');
  expect((await post(request,auth,`/api/run-plans/${c.p.id}/workouts/${w.id}/move-preview`,command({...body,baseRevision:999}),409)).code).toBe('STALE_REVISION');
  const bad=inputs({sessionCaps:{easyM:2000}});const p=await post(request,auth,'/api/run-plans',command({inputs:bad}),422);expect(p.code).toBe('SESSION_CAPS_INVALID');
});

for(const [width,height,n] of [[390,844,46],[1440,900,47]])test(`S10 explicit pace recommendation review and decline ${width}`,async({page,request},info)=>{
  const auth=await browserLogin(page,request,n);await page.setViewportSize({width,height});await page.goto('/training-plan');
  const plans=await get(request,auth,'/api/run-plans');const p=plans.plans.find(p=>p.state==='ACTIVE');
  await expectNativeCalendar(page,p.title);await openPlanManagement(page);
  await expect(page.getByRole('heading',{name:'Pace review',exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Review pace change',exact:true})).toBeVisible();await scan(page,`pace-review-${width}`,info);
  await page.getByRole('heading',{name:'Pace review',exact:true}).evaluate(el=>el.scrollIntoView({block:'start',behavior:'instant'}));await screenshot(page,`S10-pace-${width}x${height}`);
  if(width===1440){
    await page.getByRole('button',{name:'Keep current guidance',exact:true}).click();await expect(page.getByText('You chose to keep your current guidance. This evidence will not change your plan.')).toBeVisible();await page.reload();
    await openPlanManagement(page);await expect(page.getByText('You chose to keep your current guidance. This evidence will not change your plan.')).toBeVisible();
    expect((await get(request,auth,`/api/run-plans/${p.id}`)).inputs.paceScaleBps).toBeNull();
  }else{
    await page.getByRole('button',{name:'Review pace change',exact:true}).click();await expect(page.getByText(/Pace change for review:/)).toBeVisible();
    expect((await get(request,auth,`/api/run-plans/${p.id}`)).inputs.paceScaleBps).toBeNull();
    await page.getByRole('button',{name:'Ready to begin?'}).click();const dialog=page.getByRole('dialog');
    for(const checkbox of await dialog.getByRole('checkbox',{name:'I understand this note.',exact:true}).all())await checkbox.check();
    await dialog.getByLabel('I have reviewed all weeks and the notes above.').check();await dialog.getByRole('button',{name:'Activate this plan',exact:true}).click();
    await expectNativeCalendar(page,p.title);await openPlanManagement(page);expect((await get(request,auth,`/api/run-plans/${p.id}`)).inputs.paceScaleBps).toBe(9800);
    await expect(page.getByRole('button',{name:'Review pace change',exact:true})).toHaveCount(0);
  }
});

for(const [width,height,n] of [[390,844,49],[1440,900,51]])test(`S10 offline shell reload reads owned plan and blocks writes ${width}`,async({page,request,context},info)=>{
  info.annotations.push({type:'expected-network-fault',description:'Network is disabled after caching the owned shell and snapshots'});
  const auth=await browserLogin(page,request,n);await page.setViewportSize({width,height});const c=await active(request,auth,distanceInputs());await page.goto('/training-plan');
  await expectNativeCalendar(page,c.v.title);await openPlanManagement(page);
  await page.evaluate(async()=>{await navigator.serviceWorker.ready;});
  await expect.poll(()=>page.evaluate(()=>navigator.serviceWorker.controller!=null)).toBe(true);
  await openFullPlan(page);
  await page.evaluate(async()=>{
    const registration=await navigator.serviceWorker.ready;
    const urls=performance.getEntriesByType('resource').map(x=>x.name).filter(x=>new URL(x).pathname.startsWith('/assets/'));
    registration.active.postMessage({type:'CACHE_PLAN_ASSETS',urls});
  });
  await expect.poll(()=>page.evaluate(async()=>{
    const cache=await caches.open('hermes-training-shell-v1');const urls=performance.getEntriesByType('resource').map(x=>x.name).filter(x=>new URL(x).pathname.startsWith('/assets/'));
    return (await Promise.all(urls.map(url=>cache.match(url)))).every(Boolean);
  })).toBe(true);
  await context.setOffline(true);await page.reload();
  await expect(page.getByText(/Saved plan view from/)).toBeVisible();await expect(page.getByRole('button',{name:'Edit and review a new version',exact:true})).toBeDisabled();
  await expect(page.getByRole('heading',{name:/Week of/}).first()).toBeVisible();await scan(page,'offline-full-plan',info);await screenshot(page,`S08-offline-${width}x${height}`);
  await context.setOffline(false);await page.goto('/training-plan');await expectNativeCalendar(page,c.v.title);
  const other=await browserLogin(page,request,n+1);await page.goto('/training-plan');await expectNativeCalendar(page);await openPlanManagement(page);await expect(page.getByRole('button',{name:'Create a plan'}).first()).toBeVisible();
  await context.setOffline(true);await page.goto(`/training-plan/${c.p.id}/preview/${c.v.id}`);await expect(page.getByRole('heading',{name:'Your whole plan, before you begin.'})).toBeVisible();
  await expect(page.getByText(/This page has not been saved for offline reading/)).toBeVisible();await expect(page.getByText(c.v.title,{exact:true})).toHaveCount(0);
  expect(other.email).not.toBe(auth.email);
});

test('Pace preview cannot bypass the unapproved ruleset gate',async({request})=>{
  const origin='http://127.0.0.1:4332';const auth=await login(request,46,origin);const list=await get(request,auth,'/api/run-plans',200,origin);const p=list.plans.find(p=>p.state==='ACTIVE');
  const review=await get(request,auth,`/api/run-plans/${p.id}/pace-review`,200,origin);expect(review.state).toBe('RECOMMENDED');
  const candidate=await post(request,auth,`/api/run-plans/${p.id}/pace-preview`,command({baseRevision:review.planRevision,evidenceHash:review.evidenceHash}),200,origin);
  const v=await get(request,auth,`/api/run-plans/${p.id}/versions/${candidate.id}`,200,origin);expect(v.rulesApproved).toBe(false);
  const rejected=await post(request,auth,`/api/run-plans/${p.id}/activate`,command({versionId:v.id,contentHash:v.contentHash,baseRevision:v.baseRevision,activePlanId:v.activePlanId,activePlanRevision:v.activePlanRevision,acknowledgedWarnings:v.warnings}),503,origin);
  expect(rejected.code).toBe('RULES_REVIEW_REQUIRED');expect((await get(request,auth,`/api/run-plans/${p.id}`,200,origin)).inputs.paceScaleBps).toBeNull();
});

for(const [width,height,n] of [[390,844,53],[1440,900,54]])test(`S12 extra run remains unassigned ${width}`,async({page,request},info)=>{
  const auth=await browserLogin(page,request,n);await page.setViewportSize({width,height});const c=await active(request,auth,distanceInputs());const before=await get(request,auth,`/api/run-plans/${c.p.id}`);await page.goto('/runs');
  await page.getByRole('button',{name:'Log a completed run',exact:true}).click();const dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox',{name:'Run name',exact:true}).fill('Unscheduled actual run');await dialog.getByRole('spinbutton',{name:'Actual distance (km)',exact:true}).fill('2.3');
  await dialog.getByRole('spinbutton',{name:'Duration (minutes)',exact:true}).fill('18');await scan(page,'extra-run-entry',info);await screenshot(page,`S12-extra-run-${width}x${height}`);
  await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expect(dialog.getByText('Run saved in your history.',{exact:true})).toBeVisible();
  const link=dialog.getByRole('link',{name:'View actual run',exact:true});await expect(link).toBeVisible();
  const id=(await link.getAttribute('href')).split('/').at(-1);expect((await get(request,auth,`/api/run-plans/activity-links/${id}`)).link).toBeNull();
  const after=await get(request,auth,`/api/run-plans/${c.p.id}`);expect(after.revision).toBe(before.revision);expect(after.versions).toEqual(before.versions);
  await expect(page.getByRole('link',{name:'Review / retry this save'})).toHaveCount(0);
});
