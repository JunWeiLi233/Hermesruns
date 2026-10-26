import {test,expect,open,scan,api,identity,grant} from './helpers.mjs';
test('F15-H1 selecting a conversation keeps the Team messages section open',async({page,request},info)=>{
 const message='QA Élan 🏃 message '+crypto.randomUUID().slice(0,8);const athlete=await identity(request,'athlete');await grant(request);const thread=await api(request,'coach','POST','/conversations',{kind:'direct',peerId:athlete.id});
 await open(page,'/profile/team?view=messages','coach');await page.getByRole('navigation',{name:'Conversation',exact:true}).getByRole('button',{name:/Direct conversation$/}).click();await expect(page).toHaveURL(url=>url.pathname==='/profile/team'&&url.searchParams.get('view')==='messages'&&url.searchParams.get('conversation')===thread.id);await page.getByLabel('Message text').fill(message);await page.getByRole('button',{name:'Send',exact:true}).click();await expect(page.getByText(message,{exact:true})).toBeVisible();await scan(page,'team-messages',info);
});
