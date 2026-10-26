import { test, expect, browserLogin, scan, get, candidate, inputs } from './helpers.mjs';
import { expectNativeCalendar } from './native-plan.ui.mjs';

test('F01-H1 F01-E1 F01-E2 F01-E6 complete setup, draft reload, full preview and keyboard activation review', async ({ page, request }, info) => {
  const auth = await browserLogin(page, request, 1);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/training-plan/setup');
  await expect(page.getByRole('heading', { name: 'Goal', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Plan name', exact: true })).toBeFocused();
  const title = 'Élan 🏃 '.repeat(18).slice(0, 120);
  await page.getByRole('textbox', { name: 'Plan name', exact: true }).fill(title);
  await page.getByLabel('I confirm I am 18 or older.').check();
  await scan(page, 'goal', info);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Starting point', exact: true })).toBeVisible();
  await page.getByLabel('I can comfortably walk for 20 minutes.').check();
  await scan(page, 'baseline', info);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Available days', exact: true })).toBeVisible();
  const draftURL = page.url(); await page.reload();
  await expect(page.getByRole('group', { name: 'Available days', exact: true })).toBeVisible();
  expect(page.url()).toBe(draftURL); await scan(page, 'availability', info);
  await page.getByRole('button', { name: 'Continue', exact: true }).press('Enter');
  await expect(page.getByRole('group', { name: 'Volume preference' })).toBeVisible();
  await scan(page, 'style', info);
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Generate full plan' })).toBeDisabled();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('group', { name: 'Volume preference' })).toBeVisible();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await scan(page, 'setup-review', info);
  await page.getByLabel('I have checked these baseline values and my availability.').check();
  await page.getByRole('button', { name: 'Generate full plan' }).click();
  await expect(page.getByRole('heading', { name: 'Your whole plan, before you begin.' })).toBeVisible();
  await scan(page, 'full-preview', info);
  const previewURL=page.url();await page.goBack();await expect(page.getByRole('button', { name: 'Generate full plan' })).toBeDisabled();
  await page.goForward();await expect(page).toHaveURL(previewURL);await expect(page.getByRole('button', { name: 'Ready to begin?' })).toBeVisible();
  const list = await get(request, auth, '/api/run-plans');
  expect(list.plans).toHaveLength(1); expect(list.plans[0].title).toBe(title);
  const v = await get(request, auth, `/api/run-plans/${list.plans[0].id}/versions/${list.plans[0].versions[0].id}`);
  expect(v.weeks.flatMap(w => w.days)).toHaveLength(84);
  await page.getByRole('button', { name: 'Ready to begin?', exact: true }).click();
  const dialog = page.getByRole('dialog'); await expect(dialog.getByRole('button', { name: 'Activate this plan' })).toBeDisabled();
  await scan(page, 'activation-dialog', info);
  await dialog.getByRole('checkbox', { name: 'I understand this note.' }).check();
  await dialog.getByRole('checkbox', { name: 'I have reviewed all weeks and the notes above.' }).check();
  await dialog.getByRole('button', { name: 'Activate this plan' }).click();
  await expectNativeCalendar(page,title);
  await scan(page, 'active-calendar', info);
  await page.goto('/today-run');await expect(page.getByRole('heading',{level:1})).toBeVisible();
  await expect(page.getByText('This experimental plan has not been statistically validated for training outcomes.',{exact:true})).toBeVisible();
  await expect(page.getByRole('button',{name:'Session details',exact:true})).toBeVisible();
  expect((await get(request,auth,'/api/run-plans/today')).plan.id).toBe(list.plans[0].id);
  await page.goto('/schedule');await expectNativeCalendar(page,title);
});

test('F01-E3 slow double submit saves one draft', async ({ page, request }) => {
  const auth = await browserLogin(page, request, 2); await page.goto('/training-plan/setup');
  await page.getByRole('textbox', { name: 'Plan name', exact: true }).fill('Slow network draft'); await page.getByLabel('I confirm I am 18 or older.').check();
  await page.route('**/api/run-plans', async route => { if (route.request().method() === 'POST') await new Promise(r => setTimeout(r, 800)); await route.continue(); });
  await page.getByRole('button', { name: 'Continue', exact: true }).dblclick();
  await expect(page.getByRole('heading', { name: 'Starting point', exact: true })).toBeVisible();
  expect((await get(request, auth, '/api/run-plans')).plans).toHaveLength(1);
});

test('F02-N1 unapproved rules show full preview and disable activation', async ({ page, request }, info) => {
  const origin = 'http://127.0.0.1:4332'; const auth = await browserLogin(page, request, 3, origin);
  const c = await candidate(request, auth, undefined, origin);
  await page.goto(`${origin}/training-plan/${c.p.id}/preview/${c.v.id}`);
  await expect(page.getByRole('button', { name: 'Ready to begin?' })).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Activate this plan' })).toBeDisabled();
  await expect(page.getByText(/coaching review/i)).toBeVisible();
  await scan(page, 'coaching-gate', info);
});

test('F02-E3 F02-E4 mobile candidate deep link, refresh and modal keyboard focus', async ({ page, request }, info) => {
  const auth = await browserLogin(page, request, 4); const c = await candidate(request, auth);
  const w = c.days.find(d => d.workoutType === 'RUN_WALK');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/training-plan/${c.p.id}/preview/${c.v.id}?workout=${w.id}`);
  await expect(page.getByRole('dialog')).toBeVisible(); await page.reload();
  await expect(page.getByRole('dialog')).toBeVisible(); await scan(page, 'mobile-candidate', info);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Ready to begin?' }).click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Close', exact: true }).press('Shift+Tab');
  await expect(dialog.getByRole('checkbox', { name: 'I have reviewed all weeks and the notes above.' })).toBeFocused();
  await dialog.getByRole('checkbox', { name: 'I have reviewed all weeks and the notes above.' }).press('Tab');
  await expect(dialog.getByRole('button', { name: 'Close', exact: true })).toBeFocused();
  await dialog.getByRole('button', { name: 'Close', exact: true }).press('Escape');
  await expect(page.getByRole('button', { name: 'Ready to begin?' })).toBeFocused();
});

test('F02-E4 200 percent text preserves preview controls and scrolling',async({page,request},info)=>{
  const auth=await browserLogin(page,request,3);const c=await candidate(request,auth);await page.goto(`/training-plan/${c.p.id}/preview/${c.v.id}`);
  await expect(page.getByRole('button',{name:'Ready to begin?'})).toBeVisible();
  await page.evaluate(()=>{
    const sizes=Array.from(document.querySelectorAll('body *')).map(el=>[el,parseFloat(getComputedStyle(el).fontSize)]);
    for(const [el,size] of sizes)el.style.setProperty('font-size',`${size*2}px`,'important');
  });
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await scan(page,'200-percent-text',info);
  await page.getByRole('button',{name:'Ready to begin?'}).click();await expect(page.getByRole('dialog')).toBeVisible();await scan(page,'200-percent-dialog',info);
});

test('F02-E2 stale activation closes review and disables the old snapshot',async({page,request},info)=>{
  info.annotations.push({type:'expected-http-409',description:'Draft revision changes after activation review opens'});
  const auth=await browserLogin(page,request,4);const i=inputs();const c=await candidate(request,auth,i);await page.goto(`/training-plan/${c.p.id}/preview/${c.v.id}`);
  await page.getByRole('button',{name:'Ready to begin?'}).click();const dialog=page.getByRole('dialog');
  for(const check of await dialog.getByRole('checkbox',{name:'I understand this note.'}).all())await check.check();
  await dialog.getByRole('checkbox',{name:'I have reviewed all weeks and the notes above.'}).check();
  const edit=await request.patch(`/api/run-plans/${c.p.id}`,{headers:{...auth.headers,'If-Match':'"0"'},data:{inputs:{...i,title:'Changed elsewhere'},setupStep:4}});expect(edit.status()).toBe(200);
  await dialog.getByRole('button',{name:'Activate this plan'}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('button',{name:'Ready to begin?'})).toBeDisabled();
  await expect(page.getByText('This preview needs refreshing. Your plan, evidence, or local date has changed. Generate a new preview before activating.')).toBeVisible();await scan(page,'stale-preview',info);
});
