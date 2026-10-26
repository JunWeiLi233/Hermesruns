import {test,expect,browserLogin,inputs,active,get,post,command,openWorkout,scan} from './helpers.mjs';
import {expectSavedWorkoutRun} from './native-plan.ui.mjs';

test('PAR-F07 saved active-plan edits survive reload without mutating the active prescription',async({page,request},info)=>{
  const auth=await browserLogin(page,request,6);const c=await active(request,auth);
  await page.goto(`/training-plan/setup/${c.p.id}`);
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await page.getByRole('group',{name:'Volume preference'}).getByRole('radio',{name:'Lower',exact:true}).check();
  await page.getByRole('button',{name:'Continue',exact:true}).click();
  await page.getByRole('checkbox',{name:'I have checked these baseline values and my availability.'}).check();
  await page.getByRole('button',{name:'Save setup',exact:true}).click();
  await expect(page.getByText(/Your (setup|changes).*saved/)).toBeVisible();
  await page.reload();await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('group',{name:'Volume preference'}).getByRole('radio',{name:'Lower',exact:true})).toBeChecked();
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`)).inputs.volume).toBe('STANDARD');
  await scan(page,'restored-active-edits',info);
});

test('PAR-F02 editing a preview uses that version inputs rather than the old active plan',async({page,request},info)=>{
  const auth=await browserLogin(page,request,7);const i=inputs();const c=await active(request,auth,i);
  const current=await get(request,auth,`/api/run-plans/${c.p.id}`);
  const version=await post(request,auth,`/api/run-plans/${c.p.id}/versions`,command({inputs:{...i,volume:'LOWER',title:'Preview changes'},baseRevision:current.revision}));
  await page.goto(`/training-plan/${c.p.id}/preview/${version.id}`);
  await page.getByRole('button',{name:'Edit and review a new version',exact:true}).click();
  await page.getByRole('button',{name:'Back',exact:true}).click();
  await expect(page.getByRole('group',{name:'Volume preference'}).getByRole('radio',{name:'Lower',exact:true})).toBeChecked();
  expect((await get(request,auth,`/api/run-plans/${c.p.id}`)).inputs.volume).toBe('STANDARD');
  await scan(page,'edit-reviewed-version',info);
});

test('PAR-F06 successful linking clears a recovered manual-save banner',async({page,request},info)=>{
  const auth=await browserLogin(page,request,8);const c=await active(request,auth);await openWorkout(page,c);
  await page.getByRole('button',{name:'Save a manual run',exact:true}).click();let dialog=page.getByRole('dialog');
  await dialog.getByRole('textbox',{name:'Run name',exact:true}).fill('Parity recovery run');
  await dialog.getByRole('spinbutton',{name:'Actual distance (km)',exact:true}).fill('2.3');
  await dialog.getByRole('spinbutton',{name:'Duration (minutes)',exact:true}).fill('18');
  await dialog.getByRole('button',{name:'Save run',exact:true}).click();await expectSavedWorkoutRun(page);
  await page.reload();await expect(page.getByRole('link',{name:'Review / retry this save'})).toBeVisible();
  await page.getByRole('button',{name:'Link a completed run',exact:true}).click();dialog=page.getByRole('dialog');
  await dialog.getByRole('radio',{name:/Parity recovery run/}).check();await dialog.getByRole('radio',{name:'Partly completed',exact:true}).check();
  for(const check of await dialog.getByRole('checkbox',{name:'I understand this note.'}).all())await check.check();
  await dialog.getByRole('button',{name:'Confirm run link'}).click();
  await expect(page.getByRole('link',{name:'View actual run'})).toBeVisible();
  await expect(page.getByRole('link',{name:'Review / retry this save'})).toHaveCount(0);
  await scan(page,'cleared-recovery-after-link',info);
});
