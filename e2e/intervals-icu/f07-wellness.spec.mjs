import {test,expect,open,scan,today,identity,api} from './helpers.mjs';
test('F07-H1 recovery journal extends injury-risk analysis',async({page,request},info)=>{
 await open(page,'/analysis/injury-risk?journal=1');await page.getByLabel('Sleep hours').fill('7.5');await page.getByLabel('Resting heart rate',{exact:true}).fill('55');await page.getByLabel('Feeling',{exact:true}).fill('4');await page.getByRole('button',{name:'Save journal entry',exact:true}).click();await expect(page.getByText('Wellness saved.',{exact:true})).toBeVisible();await scan(page,'recovery-journal',info);
 const me=await identity(request,'athlete');const rows=await api(request,'athlete','GET',`/athletes/${me.id}/wellness`);expect(rows.items.find(r=>r.date===today()).sleep).toBe(7.5);
});
