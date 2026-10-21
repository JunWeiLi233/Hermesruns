import {test,expect,open,scan,identity,api,today} from './helpers.mjs';
test('F05-H1 comparisons use the existing Runs ledger',async({page,request},info)=>{
 const athlete=await identity(request,'athlete');for(const effort of [2,4])await api(request,'athlete','POST',`/athletes/${athlete.id}/activities/manual`,{title:`QA comparison session ${effort}`,date:today(),minutes:25,sport:'Running',rpe:effort});
 await open(page,'/runs?view=compare');await expect(page.getByRole('heading',{name:'Overlay authorized sessions'})).toBeVisible();const boxes=page.getByRole('group',{name:'Choose sessions'}).getByRole('checkbox');await boxes.nth(0).check();await boxes.nth(1).check();await page.getByLabel('Comparison name').fill('QA Élan 🏃 comparison');await page.getByRole('button',{name:'Save comparison',exact:true}).click();await expect(page.getByText('Comparison saved.',{exact:true})).toBeVisible();await scan(page,'runs-comparison',info);
});
