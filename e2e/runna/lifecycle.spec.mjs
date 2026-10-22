import { test, expect, inputs, today, addDays, login, command, post, get, candidate, activation, active, manual } from './helpers.mjs';

test('F01-N1 wrong password and missing/expired session', async ({ request }) => {
  const wrong = await request.post('/api/auth/login', { data: { email: 'plan-qa-5@hermes.test', password: 'wrong-password' } }); expect(wrong.status()).toBe(401);
  for (const headers of [{}, { Authorization: 'Bearer expired-session' }]) expect((await request.get('/api/run-plans', { headers })).status()).toBe(401);
});

test('F01-N2 oversized setup step is a bounded client error', async ({ request }) => {
  const auth = await login(request, 5);
  await post(request, auth, '/api/run-plans', command({ inputs: inputs(), setupStep: 2147483648 }), 400);
  expect((await get(request, auth, '/api/run-plans')).plans).toHaveLength(0);
});

test('F01-N2 null generation inputs is a bounded client error', async ({ request }) => {
  const auth = await login(request, 6); const p = await post(request, auth, '/api/run-plans', command({ inputs: inputs() }));
  await post(request, auth, `/api/run-plans/${p.id}/versions`, command({ inputs: null, baseRevision: 0 }), 400);
  expect((await get(request, auth, `/api/run-plans/${p.id}`)).versions).toHaveLength(0);
});

test('F01-N2 invalid zone/date/types and 64KiB request bound', async ({ request }) => {
  const auth = await login(request, 7);
  for (const [patch, status] of [[{ timeZone: 'Not/A_Zone' }, 422], [{ startDate: '2026-99-99' }, 400], [{ runsPerWeek: 3.5 }, 400], [{ availableWeekdays: [2, 2, 7] }, 400], [{ title: '' }, 422], [{ title: 'x'.repeat(121) }, 422]]) {
    await post(request, auth, '/api/run-plans', command({ inputs: inputs(patch) }), status);
  }
  await post(request, auth, '/api/run-plans', command({ inputs: inputs(), padding: 'x'.repeat(65536) }), 413);
});

test('F01-E4 impossible availability leaves no version', async ({ request }) => {
  const auth = await login(request, 8); const i = inputs({ availableWeekdays: [1, 2, 7] });
  const p = await post(request, auth, '/api/run-plans', command({ inputs: i }));
  const failure = await post(request, auth, `/api/run-plans/${p.id}/versions`, command({ inputs: i, baseRevision: 0 }), 422);
  expect(failure.fieldErrors).toContain('availableWeekdays'); expect((await get(request, auth, `/api/run-plans/${p.id}`)).versions).toHaveLength(0);
});

for (const [index, goal, volume, difficulty, length] of [[9,5000,'LOWER','EASY',56],[10,5000,'STANDARD','STANDARD',84],[11,5000,'HIGHER','HIGHER',182],[12,10000,'LOWER','EASY',70],[13,10000,'STANDARD','STANDARD',98],[14,10000,'HIGHER','HIGHER',182]]) {
  test(`F01-E5 ${goal}m ${volume} ${difficulty} full ${length}-day prescription`, async ({ request }) => {
    const auth = await login(request, index); const i = inputs({ goalDistanceM: goal, trainingMode: 'DISTANCE', experience: 'ADVANCED', baselineWeeklyM: 24000, baselineRunsPerWeek: 4, longestRecentM: 8000, volume, difficulty, endDate: addDays(today(), length - 1) });
    const c = await candidate(request, auth, i); expect(c.days).toHaveLength(length);
    expect(new Set(c.days.map(d => d.localDate)).size).toBe(length);
    for (const d of c.days) {
      expect(d.steps.length).toBeLessThanOrEqual(32);
      expect(d.steps.reduce((n,s) => n+(s.distanceM || 0), 0)).toBe(d.targetDistanceM || 0);
      expect(d.steps.reduce((n,s) => n+(s.durationS || 0), 0)).toBe(d.targetDurationS || 0);
    }
    expect(c.days.at(-1).targetDistanceM).toBe(goal);
    const again = await post(request, auth, `/api/run-plans/${c.p.id}/versions`, command({ inputs: { ...i, title: 'Other display title', units: 'MI' }, baseRevision: 0 }));
    const v2 = await get(request, auth, `/api/run-plans/${c.p.id}/versions/${again.id}`); expect(v2.contentHash).toBe(c.v.contentHash);
  });
}

test('F02-H1 F02-E1 exact activation and concurrent receipt replay', async ({ request }) => {
  const auth = await login(request, 15); const c = await candidate(request, auth); const b = activation(c.v);
  const results = await Promise.all([post(request, auth, `/api/run-plans/${c.p.id}/activate`, b), post(request, auth, `/api/run-plans/${c.p.id}/activate`, b)]); expect(results[0]).toEqual(results[1]);
  const calendar = await get(request, auth, `/api/run-plans/${c.p.id}/workouts?from=${today()}&to=${addDays(today(),30)}`);
  expect(calendar.weeks.flatMap(w => w.days)).toEqual(c.days.slice(0,31));
  expect((await get(request, auth, '/api/run-plans')).plans.filter(p => p.state === 'ACTIVE')).toHaveLength(1);
});

test('F02-E2 stale preview cannot replace current active plan', async ({ request }) => {
  const auth = await login(request, 16); const old = await active(request, auth); const replacement = await candidate(request, auth, inputs({ title: 'Replacement' }));
  const w = old.days.find(d => d.workoutType !== 'REST');
  await post(request, auth, `/api/run-plans/${old.p.id}/workouts/${w.id}/status`, command({ revision: 0, state: 'SKIPPED' }));
  const stale = await get(request, auth, `/api/run-plans/${replacement.p.id}/versions/${replacement.v.id}`); expect(stale.stale).toBe(true);
  await post(request, auth, `/api/run-plans/${replacement.p.id}/activate`, activation(replacement.v), 409);
  expect((await get(request, auth, '/api/run-plans/today')).plan.id).toBe(old.p.id);
});

test('F02-N1 direct activation remains blocked without qualified rule approval', async ({ request }) => {
  const origin='http://127.0.0.1:4332';const auth=await login(request,17,origin);const c=await candidate(request,auth,inputs(),origin);
  expect(c.v.rulesApproved).toBe(false);const result=await post(request,auth,`/api/run-plans/${c.p.id}/activate`,activation(c.v),503,origin);expect(result.code).toBe('RULES_REVIEW_REQUIRED');
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`,200,origin)).state).toBe('DRAFT');expect((await get(request,auth,'/api/run-plans/today',200,origin)).state).toBe('NO_PLAN');
});

test('F02-N2 owners, nested IDs, warning omission and changed hash', async ({ request }) => {
  const auth=await login(request,18);const other=await login(request,19);const c=await candidate(request,auth);
  for(const path of [`/api/run-plans/${c.p.id}`,`/api/run-plans/${c.p.id}/versions/${c.v.id}`])await get(request,other,path,404);
  await post(request,other,`/api/run-plans/${c.p.id}/activate`,activation(c.v),404);
  await post(request,auth,`/api/run-plans/${c.p.id}/activate`,{...activation(c.v),contentHash:'wrong'},409);
  await post(request,auth,`/api/run-plans/${c.p.id}/activate`,{...activation(c.v),acknowledgedWarnings:[]},422);
  await get(request,auth,`/api/run-plans/${c.p.id}/workouts/${c.days.find(d=>d.workoutType!=='REST').id}`,404);
});

test('F02-N2 malformed active revision is a bounded client error', async ({ request }) => {
  const auth=await login(request,20);const old=await active(request,auth);const c=await candidate(request,auth);
  await post(request,auth,`/api/run-plans/${c.p.id}/activate`,{...activation(c.v),activePlanRevision:'not-a-number'},400);
  expect((await get(request,auth,'/api/run-plans/today')).plan.id).toBe(old.p.id);
});

test('F03-E1 F03-E2 upcoming calendar, DST dates and plan-local actual totals', async ({request})=>{
  const auth=await login(request,21);const start=addDays(today(),3);const c=await active(request,auth,inputs({startDate:start,endDate:addDays(start,83)}));
  expect((await get(request,auth,'/api/run-plans/today')).state).toBe('UPCOMING');
  for(let n=1;n<c.days.length;n++)expect(c.days[n].localDate).toBe(addDays(c.days[n-1].localDate,1));
  const instant=`${today()}T01:00:00Z`;await manual(request,auth,{startedAt:instant,distanceMeters:3100,elapsedSeconds:1200});
  const actualDate=addDays(today(),-1);const local=await get(request,auth,`/api/run-plans/${c.p.id}/workouts?from=${actualDate}&to=${actualDate}`);expect(local.actualDistanceM).toBe(3100);
  const utc=await get(request,auth,`/api/run-plans/${c.p.id}/workouts?from=${today()}&to=${today()}`);expect(utc.actualDistanceM).toBe(0);
});

test('F04-N1 F05-H1 manual idempotency, key reuse and unlinked actual',async({request})=>{
  const auth=await login(request,22);const c=await active(request,auth);const b=command({name:'Actual',startedAt:new Date(Date.now()-7200000).toISOString(),timeZone:'America/New_York',distanceMeters:2200,elapsedSeconds:1000});
  const result=await post(request,auth,'/api/manual-runs',b,201);expect((await post(request,auth,'/api/manual-runs',b)).id).toBe(result.id);
  await post(request,auth,'/api/manual-runs',{...b,distanceMeters:2300},409);
  expect((await get(request,auth,`/api/run-plans/activity-links/${result.id}`)).link).toBeNull();
  for(const patch of [{distanceMeters:0},{elapsedSeconds:0},{startedAt:'garbage'}]){const r=await request.post('/api/manual-runs',{headers:auth.headers,data:{...b,...patch,clientKey:crypto.randomUUID()}});expect(r.status()).toBeGreaterThanOrEqual(400);expect(r.status()).toBeLessThan(500);}
  const cal=await get(request,auth,`/api/run-plans/${c.p.id}/workouts?from=${addDays(today(),-1)}&to=${today()}`);expect(cal.actualDistanceM).toBe(2200);expect(cal.weeks.flatMap(w=>w.days).every(d=>d.completionSource==='NONE')).toBe(true);
});

test('F06-H1 F06-E2 F06-E3 F06-N1 link review, one-to-one ownership, unlink and archive',async({request})=>{
  const auth=await login(request,23);const other=await login(request,24);const c=await active(request,auth);const ws=c.days.filter(d=>d.workoutType!=='REST');const a=await manual(request,auth);
  const url=`/api/run-plans/${c.p.id}/workouts/${ws[0].id}`;const candidateList=await get(request,auth,`${url}/activity-candidates?from=${addDays(today(),-7)}&to=${addDays(today(),7)}`);const chosen=candidateList.activities.find(x=>x.id===a.id);
  const b=command({revision:0,activityId:a.id,metricHash:chosen.metricHash,decision:'PARTIAL',acknowledgedWarnings:chosen.warnings});
  await post(request,other,`${url}/link`,b,404);await post(request,auth,`${url}/link`,{...b,clientKey:crypto.randomUUID(),metricHash:'changed'},409);
  if(chosen.warnings.length)await post(request,auth,`${url}/link`,{...b,clientKey:crypto.randomUUID(),acknowledgedWarnings:[]},422);
  const results=await Promise.all([request.post(`${url}/link`,{headers:auth.headers,data:b}),request.post(`/api/run-plans/${c.p.id}/workouts/${ws[1].id}/link`,{headers:auth.headers,data:{...b,clientKey:crypto.randomUUID(),acknowledgedWarnings:['DIFFERENT_DAY','SOURCE_LOCAL_DATE','UNKNOWN_ACTIVITY_DATE']}})]);
  expect(results.map(r=>r.status()).sort()).toEqual([200,409]);
  const linked=(await get(request,auth,`/api/run-plans/activity-links/${a.id}`)).link;expect(linked.state).toBe('PARTIAL');
  await get(request,other,`/api/run-plans/activity-links/${a.id}`,404);
  const linkedURL=`/api/run-plans/${c.p.id}/workouts/${linked.workoutId}`;await post(request,auth,`${linkedURL}/unlink`,command({revision:1}));
  expect((await get(request,auth,`/api/run-plans/activity-links/${a.id}`)).link).toBeNull();expect((await get(request,auth,linkedURL)).workout.state).toBe('PLANNED');
  const plan=await get(request,auth,`/api/run-plans/${c.p.id}`);await post(request,auth,`/api/run-plans/${c.p.id}/archive`,command({revision:plan.revision}));
  await post(request,auth,`${linkedURL}/link`,{...b,clientKey:crypto.randomUUID(),revision:2},409);
});

test('F07-H1 F07-E1 preserve skipped history through exact regeneration; stale profile and draft reject',async({request})=>{
  const auth=await login(request,25);const i=inputs();const c=await active(request,auth,i);const w=c.days.find(d=>d.workoutType!=='REST');const url=`/api/run-plans/${c.p.id}/workouts/${w.id}`;
  await post(request,auth,`${url}/status`,command({revision:0,state:'SKIPPED'}));const before=(await get(request,auth,url)).workout;
  const p=await get(request,auth,`/api/run-plans/${c.p.id}`);const g=await post(request,auth,`/api/run-plans/${c.p.id}/versions`,command({inputs:i,baseRevision:p.revision}));const v=await get(request,auth,`/api/run-plans/${c.p.id}/versions/${g.id}`);expect(v.retainedWorkoutIds).toContain(w.id);
  await post(request,auth,`/api/run-plans/${c.p.id}/activate`,activation(v));expect((await get(request,auth,url)).workout).toEqual(before);
  await post(request,auth,`/api/run-plans/${c.p.id}/versions`,command({inputs:i,baseRevision:p.revision}),409);
  const profile=await request.put('/api/plan-profile',{headers:{...auth.headers,'If-None-Match':'*'},data:i});expect(profile.status()).toBe(200);
  expect((await request.put('/api/plan-profile',{headers:{...auth.headers,'If-Match':'"99"'},data:i})).status()).toBe(409);
});

test('F07-E1 two draft editors cannot overwrite an acknowledged revision',async({request})=>{
  const auth=await login(request,24);const i=inputs();const p=await post(request,auth,'/api/run-plans',command({inputs:i,setupStep:1}));
  const responses=await Promise.all(['First editor','Second editor'].map(title=>request.patch(`/api/run-plans/${p.id}`,{headers:{...auth.headers,'If-Match':'"0"'},data:{inputs:{...i,title},setupStep:2}})));
  expect(responses.map(r=>r.status()).sort()).toEqual([200,409]);const latest=await get(request,auth,`/api/run-plans/${p.id}`);expect(latest.revision).toBe(1);expect(latest.setupStep).toBe(2);
});
