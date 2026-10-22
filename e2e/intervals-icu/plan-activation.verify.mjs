// Optional experimental-plan release check against a recorded disposable H2 stack.
import assert from 'node:assert/strict';
import {writeFileSync,mkdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {chromium} from '@playwright/test';
import {loadIsolatedActors,fetchForFixture} from './fixture-lifecycle.mjs';
import {installSyntheticMapTiles,setBrowserActor,freshSyntheticClientAddress} from '../fixtures/safety.mjs';
const isolated=loadIsolatedActors(process.env.HERMES_TRAINING_QA_RUN);
const {fixture}=isolated;
const actor=fixture.actors.athlete,base=fixture.baseURL;
const output=resolve(import.meta.dirname,'../../output/plan-activation-review');mkdirSync(output,{recursive:true});
const results=[];
async function api(path,body,expected=200,role='athlete'){
 const response=await fetchForFixture(isolated,path,{method:body?'POST':'GET',headers:{Authorization:`Bearer ${fixture.actors[role].token}`,'X-Forwarded-For':clientIp,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 const data=await response.json();assert.equal(response.status,expected,`${path}: ${data.code||'unexpected status'}`);return data;
}
const cmd=body=>({clientKey:crypto.randomUUID(),...body});
const clientIp=freshSyntheticClientAddress();
const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York'}).format(new Date());
const add=(date,n)=>{const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const dow=new Date(today+'T12:00:00Z').getUTCDay();const start=add(today,(8-dow)%7);
const inputs={schemaVersion:1,goalKind:'DISTANCE',goalDistanceM:5000,startDate:start,endDate:add(start,55),timeZone:'America/New_York',adultConfirmed:true,
 experience:'INTERMEDIATE',trainingMode:'DISTANCE',baselineWeeklyM:18000,baselineRunsPerWeek:3,longestRecentM:6000,canWalk20Minutes:true,
 availableWeekdays:[2,4,7],runsPerWeek:3,longRunWeekday:7,volume:'STANDARD',difficulty:'STANDARD',recentResult:null,title:'QA experimental 5K',sessionCaps:null,units:'KM'};
const root=await api('/api/run-plans');assert.equal(root.rulesApproved,false);assert.equal(root.activationAllowed,true);assert.equal(root.experimentalActivation,true);
const plan=await api('/api/run-plans',cmd({inputs}));const prefix=`/api/run-plans/${plan.id}`;
const version=await api(prefix+'/versions',cmd({inputs,baseRevision:0}));const preview=await api(prefix+`/versions/${version.id}`);
const activation={versionId:preview.id,contentHash:preview.contentHash,baseRevision:preview.baseRevision,activePlanId:preview.activePlanId,activePlanRevision:preview.activePlanRevision,acknowledgedWarnings:preview.warnings};
for(const consent of [undefined,false,'true']){
 const body=cmd({...activation,...(consent===undefined?{}:{acknowledgedExperimental:consent})});
 assert.equal((await api(prefix+'/activate',body,422)).code,'EXPERIMENTAL_ACKNOWLEDGEMENT_REQUIRED');
}
assert.equal((await api(prefix+'/activate',cmd({...activation,acknowledgedExperimental:true,contentHash:'changed'}),409)).code,'STALE_PREVIEW');
await api(prefix+'/activate',cmd({...activation,acknowledgedExperimental:true}),404,'outsider');
assert.equal((await api(prefix)).state,'DRAFT');results.push('server consent, stale-hash and ownership denials preserve draft');
const browser=await chromium.launch({...(process.env.E2E_CHROMIUM_PATH?{executablePath:process.env.E2E_CHROMIUM_PATH}:{})});
try{
 const context=await browser.newContext({viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York',extraHTTPHeaders:{'X-Forwarded-For':clientIp}});
 await installSyntheticMapTiles(context);
 const page=await context.newPage();const errors=[];
 await setBrowserActor(page,actor,base);
 page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=500)errors.push(`${r.status()} ${new URL(r.url()).pathname}`)});
 const {expect}=await import('@playwright/test');
 await page.goto(base+`/schedule?planView=preview&planId=${plan.id}&versionId=${version.id}`);
 await expect(page.getByRole('button',{name:'Ready to begin?',exact:true})).toBeEnabled();
 await page.getByRole('button',{name:'Ready to begin?',exact:true}).click();
 const dialog=page.getByRole('dialog');
 await dialog.getByLabel('I have reviewed all weeks and the notes above.').check();
 for(const checkbox of await dialog.getByLabel('I understand this note.',{exact:true}).all())await checkbox.check();
 const activate=dialog.getByRole('button',{name:'Activate this plan',exact:true});await expect(activate).toBeDisabled();
 await dialog.getByLabel('I understand this plan is experimental, has no recorded qualified coaching sign-off, and has not been validated for training outcomes.',{exact:true}).check();
 await expect(activate).toBeEnabled();
 const responsePromise=page.waitForResponse(r=>r.request().method()==='POST'&&new URL(r.url()).pathname===prefix+'/activate');
 await activate.click();const response=await responsePromise;assert.equal(response.status(),200);
 const submitted=response.request().postDataJSON();assert.equal(submitted.contentHash,preview.contentHash);assert.equal(submitted.acknowledgedExperimental,true);
 const receipt=await response.json();assert.equal(receipt.activationMode,'EXPERIMENTAL');assert.equal(receipt.acknowledgedExperimental,true);assert.equal(receipt.rules,'hermes-road-v4');
 assert.deepEqual(await api(prefix+'/activate',submitted),receipt);results.push('real UI requires separate consent and activates exact reviewed preview; replay is idempotent');
 await page.waitForURL(base+'/schedule');
 const notice='This experimental plan has not been statistically validated for training outcomes.';
 await expect(page.getByRole('note').filter({hasText:notice})).toBeVisible();
 await expect(page.getByRole('heading',{name:inputs.title,exact:true,level:1})).toBeVisible();
 await expect(page.locator('.schedule-plan-day')).toHaveCount(7);
 await expect(page.getByRole('button',{name:'Session details',exact:true}).first()).toBeVisible();
 await page.screenshot({path:resolve(output,'active-schedule.png')});
 const calendar=await api(prefix+`/workouts?from=${start}&to=${add(start,6)}`);
 assert.deepEqual(calendar.weeks.flatMap(w=>w.days).map(d=>d.id),preview.weeks[0].days.map(d=>d.id));
 await page.goto(base+'/today-run');await expect(page.getByRole('note').filter({hasText:notice})).toBeVisible();await page.screenshot({path:resolve(output,'active-today.png')});
 results.push('native Schedule and Today show active generated plan and persistent experimental disclosure');
 const after=await api('/api/run-plans');assert.equal(after.rulesApproved,false);assert.equal(after.plans.find(p=>p.id===plan.id).state,'ACTIVE');
 const member=fixture.actors.member;
 async function authored(path,method='GET',body,revision){
  const r=await fetchForFixture(isolated,'/api/training'+path,{method,headers:{Authorization:`Bearer ${member.token}`,'Idempotency-Key':crypto.randomUUID(),'X-Forwarded-For':clientIp,'Content-Type':'application/json',...(revision==null?{}:{'If-Match':String(revision)})},...(body?{body:JSON.stringify(body)}:{})});
  const value=await r.json();assert.equal(r.status,200,`authored ${method} ${path}: ${value.code||'unexpected status'}`);return value;
 }
 const memberProfile=await authored('/me');let first;
 for(const n of [1,2]){const event=await authored(`/athletes/${memberProfile.id}/events`,'POST',{date:today,title:`QA same-day ${n}`,minutes:20,sport:'Running',source:'20m @65% Steady'});if(n===1)first=event;}
 const moved=await authored(`/events/${first.id}`,'PATCH',{date:add(today,1)},first.revision);assert.equal(moved.date,add(today,1));
 results.push('two same-day authored sessions and date revision succeed with PostgreSQL guards');
 assert.deepEqual(errors,[]);results.push('no page exceptions or HTTP 5xx; professional approval remains false');
 writeFileSync(resolve(output,'live-flow.json'),JSON.stringify({baseURL:base,syntheticOnly:true,results,passed:true},null,2));
 console.log(JSON.stringify({passed:true,checks:results.length,syntheticOnly:true}));
}finally{await browser.close()}
