import {test,expect,scan} from './helpers.mjs';
test('F01-H1 existing authentication returns users to merged pages',async({page},info)=>{
 await page.goto('/schedule?trainingTool=workout');await expect(page).toHaveURL(/\/login\?returnTo=/);await expect(page.getByLabel('Email Address',{exact:true})).toBeVisible();await scan(page,'signin',info);
});
test('F01-E1 expired session fails closed without exposing athlete tools',async({page},info)=>{
 info.annotations.push({type:'expected-http',description:'401'});await page.addInitScript(()=>{if(sessionStorage.getItem('qa-expired-once'))return;sessionStorage.setItem('qa-expired-once','1');localStorage.setItem('hermes_jwt','expired-qa-session');localStorage.setItem('hermes_lang','en');});
 await page.goto('/settings?section=account');await expect(page).toHaveURL(/\/login/);await expect(page.getByText('Coaching access and consent',{exact:true})).toHaveCount(0);
});
