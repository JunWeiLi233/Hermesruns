import {test,expect,open,scan,api,identity,grant,today} from './helpers.mjs';
test('F12-H1 coach and follower access are scoped to the selected athlete',async({page,request},info)=>{
 const me=await identity(request,'athlete');await grant(request);await grant(request,'follower','athlete','read');
 await api(request,'follower','POST',`/athletes/${me.id}/events`,{title:'Denied follower write',date:today(),minutes:10,sport:'Running'},404);
 await open(page,`/schedule?athlete=${me.id}`,'coach');await expect(page.getByRole('heading',{name:'Athlete calendar',exact:true})).toBeVisible();await expect(page.getByLabel('Selected athlete',{exact:true})).toHaveValue(me.id);await scan(page,'coached-calendar',info);
});
