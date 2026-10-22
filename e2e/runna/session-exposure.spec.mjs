import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test,expect,browserLogin,candidate,activation,get,post,command,scan,inputs,addDays,today} from './helpers.mjs';
import {expectNativeCalendar} from './native-plan.ui.mjs';

const note='Some future runs were shortened to follow individual-session progression from your confirmed recent longest run. Weekly distance may be lower; removed distance is not added elsewhere. Goal day and protected history stay unchanged.';
function fewerDays() {
  const weekday=new Date(`${today()}T12:00:00Z`).getUTCDay();const start=addDays(today(),(8-weekday)%7);
  return inputs({title:'Fewer running days — Élan with a full, reviewed calendar',trainingMode:'DISTANCE',experience:'INTERMEDIATE',
    baselineWeeklyM:30000,baselineRunsPerWeek:5,longestRecentM:6000,availableWeekdays:[1,2,3,4,5,6,7],runsPerWeek:3,
    difficulty:'EASY',startDate:start,endDate:addDays(start,55)});
}
async function save(page,name) {
  const dir=resolve(import.meta.dirname,'../../replica/runna/clone-screens/session-exposure');await mkdir(dir,{recursive:true});
  await page.screenshot({path:resolve(dir,`${name}.png`),fullPage:false});
}
for(const [width,height,n] of [[390,844,61],[1440,900,62]])test(`S08 frequency reduction shows actual totals and requires exposure acknowledgement ${width}`,async({page,request},info)=>{
  await page.setViewportSize({width,height});const auth=await browserLogin(page,request,n);const c=await candidate(request,auth,fewerDays());
  expect(c.v.rules).toBe('hermes-road-v4');expect(c.v.warnings).toContain('SESSION_EXPOSURE_REDUCED');
  expect(c.v.weeks[0].trainingDistanceM).toBe(16200);
  expect(c.v.weeks[0].days.filter(d=>d.targetDistanceM!=null).map(d=>d.targetDistanceM)).toEqual([5400,5400,5400]);
  for(const d of c.days)if(d.targetDistanceM!=null&&d.workoutType!=='EVENT')expect(d.targetDistanceM).toBeLessThanOrEqual(6000);
  expect(c.days.at(-1).targetDistanceM).toBe(5000);
  await page.goto(`/training-plan/${c.p.id}/preview/${c.v.id}`);const warning=page.getByText(note,{exact:true});await expect(warning).toBeVisible();
  await warning.scrollIntoViewIfNeeded();await scan(page,`exposure-preview-${width}`,info);await save(page,`S08-reduced-${width}x${height}`);
  const rejected=await post(request,auth,`/api/run-plans/${c.p.id}/activate`,command({...activation(c.v),acknowledgedWarnings:[]}),422);
  expect(rejected.code).toBe('ACKNOWLEDGEMENT_REQUIRED');expect((await get(request,auth,`/api/run-plans/${c.p.id}`)).state).toBe('DRAFT');
  await page.getByRole('button',{name:'Ready to begin?',exact:true}).click();const dialog=page.getByRole('dialog');
  await expect(dialog.getByText(note,{exact:true})).toBeVisible();await dialog.getByLabel('I have reviewed all weeks and the notes above.').check();
  await expect(dialog.getByRole('button',{name:'Activate this plan',exact:true})).toBeDisabled();
  for(const checkbox of await dialog.getByRole('checkbox',{name:'I understand this note.',exact:true}).all())await checkbox.check();
  await dialog.getByRole('button',{name:'Activate this plan',exact:true}).click();
  await expectNativeCalendar(page,c.v.title);
  const first=c.days.find(d=>d.workoutType==='EASY');const published=await get(request,auth,`/api/run-plans/${c.p.id}/workouts/${first.id}`);
  expect(published.workout.targetDistanceM).toBe(5400);expect(published.workout.steps).toEqual(first.steps);
  await page.goto(`/training-plan/${c.p.id}/workouts/${first.id}`);
  await expect(page.getByRole('button',{name:'Link a completed run',exact:true})).toBeVisible();
  await scan(page,`exposure-detail-${width}`,info);await save(page,`S11-reduced-${width}x${height}`);
});

test('A reduced-frequency preview cannot bypass the unapproved coaching gate',async({page,request},info)=>{
  const origin='http://127.0.0.1:4332';const auth=await browserLogin(page,request,63,origin);const c=await candidate(request,auth,fewerDays(),origin);
  expect(c.v.weeks[0].trainingDistanceM).toBe(16200);expect(c.v.rulesApproved).toBe(false);
  const rejected=await post(request,auth,`/api/run-plans/${c.p.id}/activate`,activation(c.v),503,origin);expect(rejected.code).toBe('RULES_REVIEW_REQUIRED');
  await page.goto(`${origin}/training-plan/${c.p.id}/preview/${c.v.id}`);
  await expect(page.getByRole('button',{name:'Ready to begin?',exact:true})).toBeDisabled();
  await expect(page.getByText(/has not been statistically validated/)).toBeVisible();
  await scan(page,'exposure-coaching-gate',info);
});

test('S08 Chinese reduced-session explanation retains the closed coaching gate at 390',async({page,request},info)=>{
  const origin='http://127.0.0.1:4332';await page.setViewportSize({width:390,height:844});
  const auth=await browserLogin(page,request,64,origin);const c=await candidate(request,auth,fewerDays(),origin);
  await page.goto(`${origin}/training-plan/${c.p.id}/preview/${c.v.id}`);
  await page.evaluate(()=>localStorage.setItem('hermes_lang','zh-CN'));await page.reload();
  const warning=page.getByText('部分未来跑步已按你确认的近期最长单次距离及单次递进规则缩短，每周跑量可能降低。减少的距离不会补到其他训练；目标日和受保护历史保持不变。',{exact:true});
  await expect(warning).toBeVisible();await warning.scrollIntoViewIfNeeded();
  await expect(page.getByRole('button',{name:'启用此计划',exact:true})).toBeDisabled();
  await scan(page,'exposure-preview-zh-390',info);await save(page,'S08-reduced-zh-390x844');
});
