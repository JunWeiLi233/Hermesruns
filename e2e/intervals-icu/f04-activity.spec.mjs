import {test,expect,open,scan,api,identity} from './helpers.mjs';
test('F04-H1 canonical session resolver and discussion reuse Run detail',async({page,request},info)=>{
 const me=await identity(request,'athlete');const list=await api(request,'athlete','GET',`/athletes/${me.id}/activities`);const item=list.items[0];expect(item.canonicalId).toBeTruthy();const result=await api(request,'athlete','GET',`/activities/by-canonical/${item.canonicalId}`);expect(result.id).toBe(item.id);
 await open(page,`/runs/${item.canonicalId}`);await expect(page.getByRole('button',{name:'Discuss this session',exact:true})).toBeVisible();await page.getByRole('button',{name:'Discuss this session',exact:true}).click();await expect(page.getByLabel('Message text')).toBeVisible();await scan(page,'session-discussion',info);
 await identity(request,'outsider');await api(request,'outsider','GET',`/activities/by-canonical/${item.canonicalId}`,undefined,404);
});
