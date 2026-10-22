import {test,expect,open,scan,api,identity,team,today} from './helpers.mjs';
test('F13-H1 team membership and health-data consent remain separate',async({page,request},info)=>{
 const member=await identity(request,'member');const coach=await identity(request,'coach');await api(request,'member','POST','/me/access/revoke-all',{});const t=await team(request);await api(request,'coach','GET',`/athletes/${member.id}/activities`,undefined,404);
 await api(request,'coach','PATCH',`/teams/${t.id}/members/${coach.id}`,{role:'member'},409);
 await api(request,'member','PUT',`/teams/${t.id}/consent`,{decision:'granted',scopeRevision:1,level:'coach',wellness:[]});await api(request,'coach','GET',`/athletes/${member.id}/activities`);
 await open(page,'/profile/team?view=team','coach');await expect(page.getByRole('heading',{name:t.name,exact:true})).toBeVisible();await scan(page,'team-management',info);
});
