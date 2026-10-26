// Inventory the actual localhost product before deciding where duplicate sections belong.
import {test,expect} from '@playwright/test';
import {login,actors,api,identity,today} from './helpers.mjs';
import {trainingRoutes} from '../../frontend/src/features/training/routes.mjs';
import {mkdirSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {inputs as planInputs,command} from '../runna/helpers.mjs';
const out=resolve(import.meta.dirname,'../../output/playwright/intervals-icu/page-audit');
mkdirSync(out,{recursive:true});
let canonicalId,workspaceId,planId,versionId,workoutId;
test.beforeAll(async({request})=>{
 const me=await identity(request,'athlete');
 const item=await api(request,'athlete','POST',`/athletes/${me.id}/activities/manual`,{title:'QA page audit — easy run',date:today(),minutes:25,sport:'Running',rpe:3});
 workspaceId=item.id;
 const r=await request.get('/api/activities',{headers:{Authorization:`Bearer ${actors.athlete.token}`}});expect(r.status()).toBe(200);
 const rows=await r.json();canonicalId=(Array.isArray(rows)?rows:rows.items).find(x=>x.name==='QA page audit — easy run')?.id;
 if(!canonicalId)throw Error('Own canonical audit activity missing');
 writeFileSync(resolve(out,'fixture-ids.json'),JSON.stringify({canonicalId,workspaceId}));
 if(process.env.HERMES_TRAINING_AUDIT_EXTRA){
  const headers={Authorization:`Bearer ${actors.athlete.token}`};
  const input=planInputs({title:'QA migration audit plan'});
  const draft=await request.post('/api/run-plans',{headers,data:command({inputs:input})});
  if(draft.status()===200){
   const p=await draft.json();planId=p.id;
   const generated=await request.post(`/api/run-plans/${planId}/versions`,{headers,data:command({inputs:input,baseRevision:p.revision})});
   if(generated.status()===200){
    const v=await generated.json();versionId=v.id;
    const snapshot=await request.get(`/api/run-plans/${planId}/versions/${versionId}`,{headers});
    if(snapshot.status()===200){const data=await snapshot.json();workoutId=data.weeks?.flatMap(w=>w.days).find(w=>w.workoutType!=='REST')?.id;}
   }else writeFileSync(resolve(out,'plan-generation-limit.json'),JSON.stringify({status:generated.status(),result:await generated.json()}));
  }else writeFileSync(resolve(out,'plan-creation-limit.json'),JSON.stringify({status:draft.status(),result:await draft.json()}));
 }
});
for(const section of ['profile','preferences','training','connections','notifications','activity','account'])test(`Extra Settings ${section}`,async({page})=>{
 await login(page);await page.goto(`/settings?section=${section}`);await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
 const record={requested:`/settings?section=${section}`,visited:page.url(),headings:await page.getByRole('heading').allTextContents(),buttons:await page.getByRole('button').allTextContents()};
 writeFileSync(resolve(out,`extra-settings-${section}.json`),JSON.stringify(record,null,2));await page.screenshot({path:resolve(out,`extra-settings-${section}.png`),fullPage:true});
});
for(const kind of ['race-detail','plan-draft','plan-preview','plan-workout'])test(`Extra ${kind}`,async({page})=>{
 test.skip(kind.startsWith('plan')&&!planId,'Plan creation is unavailable in current app');
 test.skip(['plan-preview','plan-workout'].includes(kind)&&!versionId,'Plan generation is unavailable in current app');
 test.skip(kind==='plan-workout'&&!workoutId,'Generated preview has no selectable workout');
 await login(page);
 const route=kind==='race-detail'?'/races/details/tokyo-marathon':kind==='plan-draft'?`/training-plan/setup/${planId}`:kind==='plan-preview'?`/training-plan/${planId}/preview/${versionId}`:`/training-plan/${planId}/workouts/${workoutId}`;
 await page.goto(route);await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
 const record={requested:kind,visited:page.url(),headings:await page.getByRole('heading').allTextContents(),buttons:await page.getByRole('button').allTextContents()};
 writeFileSync(resolve(out,`extra-${kind}.json`),JSON.stringify(record,null,2));await page.screenshot({path:resolve(out,`extra-${kind}.png`),fullPage:true});
});
const routes=[
 ...['/','/login','/signup','/forgot-password','/terms','/privacy'].map(path=>({path,public:true})),
 ...['/profile','/runs','/analysis','/analysis/load-balance','/analysis/intensity','/analysis/injury-risk','/analysis/coach-insight','/heatmap','/weather','/prediction/5k','/prediction/10k','/prediction/half','/prediction/marathon','/today-run','/schedule','/rewards','/settings','/settings/import-data','/shoes','/shoes/add','/shoe-catalog','/races','/muscle-training','/training-plan','/training-plan/setup'].map(path=>({path})),
 {path:'/runs/:id',dynamic:'canonical'},
 ...trainingRoutes.map(r=>({path:r.path,screen:r.id})),
 {path:'/dashboard',restricted:true},
];
for(const [index,entry] of routes.entries())test(`Page ${String(index+1).padStart(2,'0')} ${entry.path}`,async({page},testInfo)=>{
 if(!entry.public)await login(page);
 const route=entry.dynamic?`/runs/${canonicalId}`:entry.path+(['S09','S10','S11'].includes(entry.screen)?`?id=${workspaceId}`:'');
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=500)errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`)});
 await page.goto(route,{waitUntil:'domcontentloaded'});
 await page.waitForLoadState('networkidle',{timeout:4000}).catch(()=>{});
 const headings=await page.getByRole('heading').allTextContents();
 const buttons=await page.getByRole('button').allTextContents();
 const links=await page.getByRole('link').evaluateAll(nodes=>nodes.map(a=>({name:a.innerText,href:a.getAttribute('href')})));
 const record={requested:entry.path,visited:page.url(),title:await page.title(),headings,buttons,links,errors,restricted:!!entry.restricted};
 const name=`${String(index+1).padStart(2,'0')}-${entry.path.replace(/[^a-z0-9-]/gi,'_')}`;
 writeFileSync(resolve(out,`${name}.json`),JSON.stringify(record,null,2));
 await page.screenshot({path:resolve(out,`${name}.png`),fullPage:true});
 await testInfo.attach('page-inventory',{body:JSON.stringify(record,null,2),contentType:'application/json'});
});
