import {test,expect,browserLogin,login,inputs,active,candidate,activation,get,post,command,scan,addDays,today} from './helpers.mjs';

const distanceInputs=overrides=>inputs({trainingMode:'DISTANCE',experience:'INTERMEDIATE',baselineWeeklyM:18000,baselineRunsPerWeek:3,longestRecentM:6000,difficulty:'STANDARD',...overrides});
const movable=days=>days.find(d=>d.workoutType==='EASY'&&d.localDate>today()&&new Date(`${d.localDate}T12:00:00Z`).getUTCDay()===2);

test('EXT-F01-E4 mile caps normalize, survive review and clear without changing the goal',async({page,request},info)=>{
  const auth=await browserLogin(page,request,55);await page.addInitScript(()=>localStorage.setItem('hermes_unit','mile'));
  await page.setViewportSize({width:390,height:844});
  const p=await post(request,auth,'/api/run-plans',command({inputs:distanceInputs({units:'MI'}),setupStep:3}));
  await page.goto(`/training-plan/setup/${p.id}`);
  await page.getByRole('spinbutton',{name:'Easy-session limit (mi)',exact:true}).fill('1.25');
  await scan(page,'mile-session-caps',info);
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Review',level:2,exact:true})).toBeVisible();
  expect((await get(request,auth,`/api/run-plans/${p.id}`)).inputs.sessionCaps.easyM).toBe(2000);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('spinbutton',{name:'Easy-session limit (mi)',exact:true})).toHaveValue('1.2427');
  await page.getByRole('button',{name:'Clear session limits',exact:true}).click();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('heading',{name:'Review',level:2,exact:true})).toBeVisible();
  const saved=await get(request,auth,`/api/run-plans/${p.id}`);
  expect(saved.inputs.sessionCaps).toBeNull();expect(saved.inputs.goalDistanceM).toBe(5000);
  await scan(page,'cleared-caps-review',info);
});

test('EXT-F01-N3 invalid session caps and mode mismatch leave the active plan intact',async({request})=>{
  const auth=await login(request,56);const c=await active(request,auth,distanceInputs());const before=await get(request,auth,`/api/run-plans/${c.p.id}`);
  for(const sessionCaps of [{easyM:999},{longM:100050},{intervalM:1025},{steadyM:-50},{runWalkS:1200}]) {
    const error=await post(request,auth,'/api/run-plans',command({inputs:distanceInputs({sessionCaps})}),422);
    expect(error.code).toBe('SESSION_CAPS_INVALID');
  }
  for(const runWalkS of [899,7201,915])expect((await post(request,auth,'/api/run-plans',command({inputs:inputs({sessionCaps:{runWalkS}})}),422)).code).toBe('SESSION_CAPS_INVALID');
  expect(await get(request,auth,`/api/run-plans/${c.p.id}`)).toEqual(before);
});

test('EXT-F07-E3 move receipt replays once and a changed completion makes activation stale',async({request})=>{
  const auth=await login(request,57);const c=await active(request,auth,distanceInputs());const w=movable(c.days);const current=await get(request,auth,`/api/run-plans/${c.p.id}`);
  const payload=command({baseRevision:current.revision,revision:w.revision,targetDate:addDays(w.localDate,1)});const url=`/api/run-plans/${c.p.id}/workouts/${w.id}`;
  const first=await post(request,auth,`${url}/move-preview`,payload);expect(await post(request,auth,`${url}/move-preview`,payload)).toEqual(first);
  const v=await get(request,auth,`/api/run-plans/${c.p.id}/versions/${first.id}`);
  await post(request,auth,`${url}/status`,command({revision:w.revision,state:'SKIPPED'}));
  expect((await post(request,auth,`/api/run-plans/${c.p.id}/activate`,activation(v),409)).code).toBe('STALE_PREVIEW');
  const after=await get(request,auth,url);expect(after.workout.localDate).toBe(w.localDate);expect(after.workout.state).toBe('SKIPPED');expect(after.workout.steps).toEqual(w.steps);
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`)).versions).toHaveLength(2);
});

test('EXT-F07-N3 move rejects cross-week dates, protected sessions and another owner',async({request})=>{
  const auth=await login(request,58);const other=await login(request,59);const c=await active(request,auth,distanceInputs());const w=movable(c.days);
  const current=await get(request,auth,`/api/run-plans/${c.p.id}`);const url=`/api/run-plans/${c.p.id}/workouts/${w.id}/move-preview`;
  const payload={baseRevision:current.revision,revision:w.revision,targetDate:addDays(w.localDate,8)};
  await post(request,auth,url,command(payload),422);await post(request,other,url,command({...payload,targetDate:addDays(w.localDate,1)}),404);
  await post(request,auth,`/api/run-plans/${c.p.id}/workouts/${w.id}/status`,command({revision:w.revision,state:'COMPLETED'}));
  const updated=await get(request,auth,`/api/run-plans/${c.p.id}`);
  await post(request,auth,url,command({baseRevision:updated.revision,revision:1,targetDate:addDays(w.localDate,1)}),422);
  expect((await get(request,auth,`/api/run-plans/${c.p.id}/workouts/${w.id}`)).workout.state).toBe('COMPLETED');
});

test('EXT-F03-N2 capped and moved candidates preserve the empty-approval gate',async({request})=>{
  const origin='http://127.0.0.1:4332';const auth=await login(request,55,origin);
  const c=await candidate(request,auth,inputs({sessionCaps:{runWalkS:1200}}),origin);
  expect(c.v.rulesApproved).toBe(false);
  expect((await post(request,auth,`/api/run-plans/${c.p.id}/activate`,activation(c.v),503,origin)).code).toBe('RULES_REVIEW_REQUIRED');
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`,200,origin)).state).toBe('DRAFT');
  const seeded=await login(request,47,origin);const list=await get(request,seeded,'/api/run-plans',200,origin);const p=list.plans.find(p=>p.state==='ACTIVE');
  const calendar=await get(request,seeded,`/api/run-plans/${p.id}/workouts?from=${addDays(today(),7)}&to=${addDays(today(),20)}`,200,origin);const w=movable(calendar.weeks.flatMap(w=>w.days));
  const moved=await post(request,seeded,`/api/run-plans/${p.id}/workouts/${w.id}/move-preview`,command({baseRevision:p.revision,revision:w.revision,targetDate:addDays(w.localDate,1)}),200,origin);
  const v=await get(request,seeded,`/api/run-plans/${p.id}/versions/${moved.id}`,200,origin);
  expect((await post(request,seeded,`/api/run-plans/${p.id}/activate`,activation(v),503,origin)).code).toBe('RULES_REVIEW_REQUIRED');
  expect((await get(request,seeded,`/api/run-plans/${p.id}/workouts/${w.id}`,200,origin)).workout.localDate).toBe(w.localDate);
});

test('EXT-F05-E2 lost extra-run response recovers once after reload without a workout link',async({page,request},info)=>{
  info.annotations.push({type:'expected-network-fault',description:'Drop the first committed extra-run response'});
  const auth=await browserLogin(page,request,60);const c=await active(request,auth);const before=await get(request,auth,`/api/run-plans/${c.p.id}`);const keys=[];
  await page.goto('/runs');await page.getByRole('button',{name:'Log a completed run',exact:true}).click();
  await page.route('**/api/manual-runs',async route=>{keys.push(route.request().postDataJSON().clientKey);if(keys.length===1){const committed=await route.fetch();expect(committed.status()).toBe(201);await route.abort('connectionreset');}else await route.continue();});
  const dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox',{name:'Run name',exact:true}).fill('Extra Élan 🏃 lost response');
  await dialog.getByRole('spinbutton',{name:'Actual distance (km)',exact:true}).fill('2.3');
  await dialog.getByRole('spinbutton',{name:'Duration (minutes)',exact:true}).fill('18');
  await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expect(dialog.getByRole('button',{name:'Review / retry this save'})).toBeVisible();
  await page.reload();await expect(page).toHaveURL(/\/runs\?manual=1$/);
  await page.getByRole('dialog').getByRole('button',{name:'Review / retry this save',exact:true}).click();
  const link=page.getByRole('dialog').getByRole('link',{name:'View actual run',exact:true});await expect(link).toBeVisible();const id=(await link.getAttribute('href')).split('/').at(-1);
  expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);expect((await get(request,auth,`/api/run-plans/activity-links/${id}`)).link).toBeNull();
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`)).revision).toBe(before.revision);
  await expect(page.getByRole('link',{name:'Review / retry this save',exact:true})).toHaveCount(0);
  await scan(page,'extra-run-lost-response',info);
});
