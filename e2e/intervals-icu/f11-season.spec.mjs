import {test,expect,open,scan,api,identity,today,addDays} from './helpers.mjs';
test('F11-H1 season structure lives within Schedule and rejects reversed dates',async({page,request},info)=>{
 const me=await identity(request,'athlete');await api(request,'athlete','POST',`/athletes/${me.id}/season-plans`,{name:'Invalid season',start:today(),end:addDays(today(),-1),weeklyMinutes:200},422);
 await open(page,'/schedule?trainingTool=season');await page.getByLabel('Season name').fill('QA Foundation');await page.getByRole('button',{name:'Save season structure',exact:true}).click();await expect(page.getByText('Season saved.',{exact:true})).toBeVisible();await scan(page,'season-structure',info);
});
