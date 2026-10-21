import {test as base,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
export {expect};
if(!process.env.HERMES_TRAINING_QA_RUN)throw Error('Set HERMES_TRAINING_QA_RUN to the protected fixture directory.');
const run=resolve(process.env.HERMES_TRAINING_QA_RUN);
if(!run.toLowerCase().startsWith(resolve(import.meta.dirname,'../../.private-backups').toLowerCase()))throw Error('Unexpected fixture path');
export const fixture=JSON.parse(readFileSync(resolve(run,'actors.json'),'utf8').replace(/^\uFEFF/,''));
export const actors=fixture.actors;
export const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
export const addDays=(date,n)=>{const d=new Date(`${date}T12:00:00Z`);d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
export const test=base.extend({
 pace:[async({},use)=>{await new Promise(resolve=>setTimeout(resolve,15000));await use();},{auto:true}],
 page:async({page},use,testInfo)=>{
  const errors=[];const watch=p=>{
   p.on('pageerror',e=>errors.push(`exception: ${e.message}`));
   p.on('console',m=>{if(m.type()!=='error')return;
    const expected=testInfo.annotations.some(a=>a.type==='expected-http'&&m.text().includes(a.description))||testInfo.annotations.some(a=>a.type==='expected-network-fault'&&/net::ERR_/.test(m.text()));
    if(!expected)errors.push(`console: ${m.text()}`);
   });
   p.on('response',r=>{if(r.status()>=500)errors.push(`HTTP ${r.status()} ${new URL(r.url()).pathname}`)});
  };watch(page);page.context().on('page',watch);
  await use(page);expect(errors,'No unexpected console errors, exceptions or 5xx').toEqual([]);
 }
});
export async function api(request,role,method,path,body,expected=200,headers={}){
 const r=await request.fetch(`/api/training${path}`,{method,headers:{Authorization:`Bearer ${actors[role].token}`,'Idempotency-Key':crypto.randomUUID(),...headers},...(body===undefined?{}:{data:body})});
 expect(r.status(),`${method} ${path}: ${await r.text()}`).toBe(expected);
 return r.status()===204?{}:r.json();
}
export async function identity(request,role){const me=await api(request,role,'GET','/me');actors[role].id=me.id;return me}
export async function login(page,role='athlete'){
 await page.addInitScript(actor=>{
  const key=`qa-session:${actor.runnerId}`;if(sessionStorage.getItem(key))return;sessionStorage.setItem(key,'1');
  localStorage.setItem('hermes_jwt',actor.token);localStorage.setItem('hermes_email',actor.email);localStorage.setItem('hermes_lang','en');localStorage.setItem('hermes_unit','km');
 },actors[role]);
}
export async function open(page,path,role='athlete'){
 await login(page,role);await page.goto(path.startsWith('/')?path:`/${path}`);await expect(page.getByRole('main')).toBeVisible();
}
export async function scan(page,name,testInfo){
 await expect(page.getByRole('main')).toBeVisible();await page.evaluate(()=>document.fonts.ready);
 await page.evaluate(async()=>{
  for(let round=0;round<2;round++){
   const motion=document.getAnimations().filter(animation=>animation.playState==='running'&&animation.playbackRate!==0&&Number.isFinite(animation.effect?.getComputedTiming().endTime));
   if(!motion.length)break;
   await Promise.allSettled(motion.map(animation=>animation.finished));
  }
 });
 const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa']).analyze();
 const evidence=result.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));
 await testInfo.attach(`axe-${name}`,{body:JSON.stringify(evidence,null,2),contentType:'application/json'});
 const path=testInfo.outputPath(`${name}.png`);await page.screenshot({path,fullPage:false});await testInfo.attach(name,{path,contentType:'image/png'});
 expect(evidence,`Accessibility on ${name}`).toEqual([]);
}
export async function grant(request,from='coach',to='athlete',level='coach',wellness=[]){
 const subject=await identity(request,to);await identity(request,from);
 const g=await api(request,from,'POST',`/athletes/${subject.id}/access-requests`,{level,wellness});
 if(g.state!=='accepted')await api(request,to,'POST',`/access-relationships/${g.id}/decision`,{decision:'accepted',wellness});return g;
}
export async function team(request,owner='coach',member='member',consent=false){
 const m=await identity(request,member);await identity(request,owner);
 const t=await api(request,owner,'POST','/teams',{name:`QA team ${crypto.randomUUID()}`});
 await api(request,member,'POST',`/teams/${t.id}/join-requests`,{});
 await api(request,owner,'PATCH',`/teams/${t.id}/members/${m.id}`,{role:'member'});
 if(consent)await api(request,member,'PUT',`/teams/${t.id}/consent`,{decision:'granted',scopeRevision:1,level:'coach',wellness:[]});
 return t;
}
