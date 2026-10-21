import {test,expect,open,scan,api,identity,grant} from './helpers.mjs';
test('F15-H1 selecting a conversation keeps the Team messages section open',async({page,request},info)=>{
 const message='QA Élan 🏃 message '+crypto.randomUUID().slice(0,8);const athlete=await identity(request,'athlete');await grant(request);const thread=await api(request,'coach','POST','/conversations',{kind:'direct',peerId:athlete.id});
 await open(page,'/profile/team?view=messages','coach');await page.getByLabel('Conversation',{exact:true}).selectOption(thread.id);await expect(page).toHaveURL(/\/profile\/team\?view=messages/);await page.getByLabel('Message text').fill(message);await page.getByRole('button',{name:'Send message',exact:true}).click();await expect(page.getByText(message,{exact:true})).toBeVisible();await scan(page,'team-messages',info);
});
