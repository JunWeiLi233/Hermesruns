import {test,expect,open,scan,api,identity,actors,today,addDays} from './helpers.mjs';
test('F09-H1 authored prescriptions share the native calendar with safe revisions',async({page,request},info)=>{
 const title='QA revision workout '+crypto.randomUUID().slice(0,8);const me=await identity(request,'athlete');const event=await api(request,'athlete','POST',`/athletes/${me.id}/events`,{date:today(),title:title,minutes:20,sport:'Running',source:'20m @65% Steady'});
 const moved=await api(request,'athlete','PATCH',`/events/${event.id}`,{date:addDays(today(),1)},200,{'If-Match':String(event.revision)});expect(moved.date).toBe(addDays(today(),1));await api(request,'athlete','PATCH',`/events/${event.id}`,{date:today()},412,{'If-Match':String(event.revision)});
 await open(page,'/schedule');await expect(page.getByRole('article',{name:addDays(today(),1),exact:true}).getByRole('button',{name:'Manage '+title,exact:true})).toBeVisible();await scan(page,'native-calendar',info);
 const weekday=new Date(`${today()}T12:00:00Z`).getUTCDay();const monday=addDays(today(),-((weekday+6)%7));
 const firstDay=await page.getByRole('article',{name:monday,exact:true}).boundingBox();expect(firstDay.height).toBeLessThan(300);
 const r=await request.get('/api/run-plans',{headers:{Authorization:`Bearer ${actors.athlete.token}`}});expect(r.status()).toBe(200);expect(JSON.stringify(await r.json())).not.toContain('EXTERNAL');
});
