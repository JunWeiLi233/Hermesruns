import { test, expect, browserLogin, scan, active, get, openWorkout, addDays, today } from './helpers.mjs';
import { openPlanManagement, expectNativeCalendar, expectSavedWorkoutRun } from './native-plan.ui.mjs';

async function enterManual(page, name) {
  await page.getByRole('button', { name: 'Save a manual run', exact: true }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox', { name: 'Run name', exact: true }).fill(name);
  await dialog.getByRole('spinbutton', { name: 'Actual distance (km)', exact: true }).fill('2.3');
  await dialog.getByRole('spinbutton', { name: 'Duration (minutes)', exact: true }).fill('18'); return dialog;
}
async function actuals(request, auth, c, w) {
  return (await get(request, auth, `/api/run-plans/${c.p.id}/workouts/${w.id}/activity-candidates?from=${addDays(today(),-7)}&to=${addDays(today(),7)}`)).activities;
}

test('F03-H1 F04-H1 F06-H1 F09-H1 real manual save, partial link, actual backlink and unlink', async ({page,request},info)=>{
  const auth=await browserLogin(page,request,26);const c=await active(request,auth);const w=await openWorkout(page,c);
  await scan(page,'published-workout',info);const dialog=await enterManual(page,'Élan 🏃 after work');await scan(page,'manual-entry',info);
  await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expectSavedWorkoutRun(page);await scan(page,'manual-saved',info);
  await expect(dialog).toHaveCount(0);await page.getByRole('button',{name:'Link a completed run',exact:true}).click();const picker=page.getByRole('dialog');
  await expect(picker.getByRole('radio',{name:/Élan 🏃 after work/})).toBeVisible();await scan(page,'run-picker',info);
  await picker.getByRole('radio',{name:/Élan 🏃 after work/}).check();await picker.getByRole('radio',{name:'Partly completed',exact:true}).check();
  expect(await picker.getByRole('button',{name:'Confirm run link'}).isEnabled()).toBe(false);
  for(const checkbox of await picker.getByRole('checkbox',{name:'I understand this note.'}).all())await checkbox.check();
  await picker.getByRole('button',{name:'Confirm run link'}).click();await expect(page.getByText('Partly completed',{exact:true})).toBeVisible();
  await scan(page,'linked-workout',info);await page.getByRole('link',{name:'View actual run'}).click();
  await expect(page.getByRole('heading',{name:'Linked training session'})).toBeVisible();await scan(page,'actual-backlink',info);
  await page.getByRole('link',{name:new RegExp(`${w.localDate}.*Partly completed`)}).click();
  await page.getByRole('button',{name:'Unlink run',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();
  await expect(page.getByText('No run linked',{exact:true})).toBeVisible();expect((await actuals(request,auth,c,w)).filter(a=>a.name==='Élan 🏃 after work')).toHaveLength(1);
});

test('F04-E1 offline queue survives reload then saves original entry once',async({page,request,context},info)=>{
  info.annotations.push({type:'expected-network-fault',description:'Manual POST deliberately offline'});
  const auth=await browserLogin(page,request,27);const c=await active(request,auth);const w=await openWorkout(page,c);const dialog=await enterManual(page,'Offline actual');
  await context.setOffline(true);await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expect(dialog.getByRole('button',{name:'Review / retry this save'})).toBeVisible();
  await context.setOffline(false);await page.reload();await expect(page.getByRole('link',{name:'Review / retry this save'})).toBeVisible();
  await page.getByRole('button',{name:'Save a manual run',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Review / retry this save'}).click();
  await expectSavedWorkoutRun(page);
  expect((await actuals(request,auth,c,w)).filter(a=>a.name==='Offline actual')).toHaveLength(1);await scan(page,'offline-recovered',info);
});

test('F04-E1 committed save with lost response replays original key once',async({page,request},info)=>{
  info.annotations.push({type:'expected-network-fault',description:'Abort only after actual POST commits'});
  const auth=await browserLogin(page,request,28);const c=await active(request,auth);const w=await openWorkout(page,c);const keys=[];
  await page.route('**/api/manual-runs',async route=>{keys.push(route.request().postDataJSON().clientKey);if(keys.length===1){const committed=await route.fetch();expect(committed.status()).toBe(201);await route.abort('connectionreset');}else await route.continue();});
  const dialog=await enterManual(page,'Lost response actual');await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expect(dialog.getByRole('button',{name:'Review / retry this save'})).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Save a manual run',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Review / retry this save'}).click();
  await expectSavedWorkoutRun(page);expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
  expect((await actuals(request,auth,c,w)).filter(a=>a.name==='Lost response actual')).toHaveLength(1);await scan(page,'lost-response-recovered',info);
});

test('F04-E2 two tabs cannot overwrite the owner pending manual run',async({page,request,context},info)=>{
  const auth=await browserLogin(page,request,29);const c=await active(request,auth);const w=await openWorkout(page,c);const other=await context.newPage();await other.goto(page.url());
  const one=await enterManual(page,'Tab one');const two=await enterManual(other,'Tab two');
  await Promise.all([one.getByRole('button',{name:'Save run',exact:true}).click(),two.getByRole('button',{name:'Save run',exact:true}).click()]);
  await expect.poll(async()=> (await actuals(request,auth,c,w)).filter(a=>/^Tab (one|two)$/.test(a.name)).length).toBe(1);
  await scan(page,'two-tab-save',info);await scan(other,'two-tab-conflict',info);
});

test('F04-E3 pending manual entry is hidden from another owner and restored for its owner',async({page,request},info)=>{
  info.annotations.push({type:'expected-network-fault',description:'Uncertain save retained during account switch'});
  const auth=await browserLogin(page,request,30);const c=await active(request,auth);await openWorkout(page,c);await page.route('**/api/manual-runs',route=>route.abort('internetdisconnected'));
  const dialog=await enterManual(page,'Private pending run');await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expect(dialog.getByRole('button',{name:'Review / retry this save'})).toBeVisible();
  await browserLogin(page,request,19);await page.goto('/training-plan');await expectNativeCalendar(page);await openPlanManagement(page);await expect(page.getByRole('button',{name:'Create a plan'}).first()).toBeVisible();await expect(page.getByRole('link',{name:'Review / retry this save'})).toHaveCount(0);await expect(page.getByText('Private pending run')).toHaveCount(0);
  await browserLogin(page,request,30);await page.goto('/training-plan');await expectNativeCalendar(page,c.v.title);await openPlanManagement(page);await expect(page.getByRole('link',{name:'Review / retry this save'})).toBeVisible();await scan(page,'owner-pending-recovery',info);
});

test('F03-E1 F06-E1 rest details, empty picker, unlogged completion and reopen',async({page,request},info)=>{
  const auth=await browserLogin(page,request,0);const c=await active(request,auth);const rest=c.days.find(d=>d.workoutType==='REST');
  await page.goto(`/training-plan/${c.p.id}/workouts/${rest.id}`);await expect(page.getByRole('status').getByText('There is no running target today. Keep the day easy.')).toBeVisible();await expect(page.getByRole('button',{name:'Link a completed run',exact:true})).toHaveCount(0);await scan(page,'rest-details',info);
  await openWorkout(page,c);await page.getByRole('button',{name:'Link a completed run',exact:true}).click();await expect(page.getByText('No eligible runs in this range.')).toBeVisible();await scan(page,'empty-picker',info);await page.getByRole('dialog').getByRole('button',{name:'Close',exact:true}).click();
  await page.getByRole('button',{name:'Complete without a run',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Confirm',exact:true}).click();await expect(page.getByText('Completed without a run record',{exact:true})).toBeVisible();
  await page.getByRole('button',{name:'Reopen session',exact:true}).click();await expect(page.getByText('No run linked',{exact:true})).toBeVisible();
});

test('F04-E3 expired save returns to the same workout after sign-in and retries once',async({page,request},info)=>{
  info.annotations.push({type:'expected-http-401',description:'Manual POST deliberately returns SESSION_EXPIRED once'});
  const auth=await browserLogin(page,request,18);const c=await active(request,auth);const w=await openWorkout(page,c);const workoutURL=page.url();
  let failed=false;await page.route('**/api/manual-runs',async route=>{if(!failed){failed=true;await route.fulfill({status:401,contentType:'application/json',body:JSON.stringify({code:'SESSION_EXPIRED'})});}else await route.continue();});
  const dialog=await enterManual(page,'Expired session actual');await dialog.getByRole('button',{name:'Save run',exact:true}).click();
  const signIn=dialog.getByRole('link',{name:'Sign in again'});await expect(signIn).toHaveAttribute('href',/returnTo=/);await signIn.click();
  await page.getByRole('textbox',{name:/email/i}).fill(auth.email);await page.getByLabel(/password/i,{exact:true}).fill('Hermes-test-only-4320!');await page.getByRole('button',{name:'Sign In',exact:true}).click();
  await expect(page).toHaveURL(workoutURL);await page.getByRole('button',{name:'Save a manual run',exact:true}).click();await page.getByRole('dialog').getByRole('button',{name:'Review / retry this save'}).click();
  await expectSavedWorkoutRun(page);await scan(page,'expired-session-recovered',info);
});
