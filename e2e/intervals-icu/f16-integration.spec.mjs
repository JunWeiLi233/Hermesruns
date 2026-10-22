import {test,expect,open,scan,api,identity,grant} from './helpers.mjs';
test('F16-H1 former sections redirect into existing pages and mobile navigation stays unified',async({page},info)=>{
 await open(page,'/training-plan#plan');await expect(page).toHaveURL(/\/schedule#plan$/);await expect(page.getByRole('link',{name:'Training & coaching',exact:true})).toHaveCount(0);await expect(page.getByRole('link',{name:'Training plan',exact:true})).toHaveCount(0);
 await page.goto('/training/calendar#week');await expect(page).toHaveURL(/\/schedule#week$/);
 await page.setViewportSize({width:390,height:844});await page.goto('/training/library');await expect(page).toHaveURL(/\/schedule\?trainingTool=library/);await expect(page.getByRole('dialog').getByRole('heading',{name:/^Workout library/})).toBeVisible();await scan(page,'mobile-library',info);
 await page.keyboard.press('Escape');await expect(page).toHaveURL(/\/schedule$/);const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);expect(overflow).toBe(false);
});
test('F16-N1 revoked athlete access is removed from an already open selected view',async({page,request},info)=>{
 const athlete=await identity(request,'athlete');await grant(request);await open(page,`/runs?athlete=${athlete.id}`,'coach');await expect(page.getByRole('heading',{name:'Athlete activities',exact:true})).toBeVisible();info.annotations.push({type:'expected-http',description:'404'});await api(request,'athlete','POST','/me/access/revoke-all',{});await api(request,'coach','GET',`/athletes/${athlete.id}/activities`,undefined,404);await page.reload();await expect(page.getByRole('alert')).toHaveText('This athlete is unavailable with your current access.');await expect(page.getByRole('heading',{name:'Athlete activities',exact:true})).toHaveCount(0);await scan(page,'revoked-selection',info);
});
