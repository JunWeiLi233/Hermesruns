import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test,expect,browserLogin,inputs,addDays,today,get,openWorkout,manual,scan} from './helpers.mjs';

// These are Hermes-to-Hermes regression pairs, never original Runna screenshots.
const phase=process.env.HERMES_PARITY_CAPTURE;
if(!['before','after'].includes(phase))throw new Error('Set HERMES_PARITY_CAPTURE=before or after');
for(const [width,height,owner] of [[1440,900,26],[390,844,27]])test(`Hermes layout ${width}x${height}`,async({page,request},info)=>{
  const root=resolve(import.meta.dirname,'../../replica/runna');
  const output=resolve(root,phase==='before'?'diffs/baseline-screens':'clone-screens/parity');await mkdir(output,{recursive:true});
  async function capture(name){
    await scan(page,`${name}-${width}`,info);
    await page.screenshot({path:resolve(output,`${name}-${width}x${height}.png`),fullPage:false});
  }
  const auth=await browserLogin(page,request,owner);await page.setViewportSize({width,height});
  const offset=(8-new Date(`${today()}T12:00:00Z`).getUTCDay())%7;
  const start=addDays(today(),offset);const i=inputs({startDate:start,endDate:addDays(start,83)});
  await page.goto('/training-plan/setup');await page.getByRole('textbox',{name:'Plan name',exact:true}).fill('A plan for my next 5K');
  await page.getByLabel('Start date').fill(i.startDate);await page.getByLabel('Goal date').fill(i.endDate);await page.getByLabel('I confirm I am 18 or older.').check();
  await capture('S03-goal');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('I can comfortably walk for 20 minutes.').check();await capture('S05-baseline');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('group',{name:'Available days'})).toBeVisible();await capture('S06-week');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await expect(page.getByRole('group',{name:'Volume preference'})).toBeVisible();await capture('S07-style');await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByLabel('I have checked these baseline values and my availability.').check();await page.getByRole('button',{name:'Generate full plan'}).click();
  await expect(page.getByRole('button',{name:'Ready to begin?'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await capture('S08-preview');
  await page.getByRole('heading',{name:/Week of/}).last().scrollIntoViewIfNeeded();await capture('S08-goal-week');
  await page.getByRole('button',{name:'Ready to begin?'}).click();await capture('S08-activation');let dialog=page.getByRole('dialog');
  for(const check of await dialog.getByRole('checkbox',{name:'I understand this note.'}).all())await check.check();
  await dialog.getByLabel('I have reviewed all weeks and the notes above.').check();await dialog.getByRole('button',{name:'Activate this plan'}).click();
  await expect(page.getByRole('heading',{name:'Full calendar'})).toBeVisible();await page.evaluate(()=>window.scrollTo(0,0));await capture('S09-calendar');
  const plans=await get(request,auth,'/api/run-plans');const p=plans.plans.find(p=>p.state==='ACTIVE');const v=await get(request,auth,`/api/run-plans/${p.id}/versions/${p.versions[0].id}`);
  const c={p,days:v.weeks.flatMap(w=>w.days)};await openWorkout(page,c);await capture('S11-workout');
  await manual(request,auth,{name:'An actual completed run'});await page.getByRole('button',{name:'Link a completed run',exact:true}).click();
  await expect(page.getByRole('dialog').getByRole('radio',{name:/An actual completed run/})).toBeVisible();await capture('S13-picker');
});
