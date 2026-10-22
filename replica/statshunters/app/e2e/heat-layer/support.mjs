import {test as base,expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../../',import.meta.url)),staticRoot=path.join(root,'backend/src/main/resources/static');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webp':'image/webp'};
const corners=[[40.72,-74.01],[40.75,-74.01],[40.75,-73.97],[40.72,-73.97],[40.72,-74.01]],bounds=[40.72,-74.01,40.75,-73.97];
const workouts=Array.from({length:66},(_,i)=>({id:i+1,name:i===0?'Élan 🏃 morning loop — an independently recorded longer workout name':i===65?'Indoor session':`Loop ${i+1}`,distanceKm:i===65?8:5,movingTimeSeconds:1800,date:'2026-10-19',startDate:'2026-10-19',provider:'FILE',sport:'RUN',gearId:i===65?null:String(i%2+1),gear:'Test shoes',shoeName:'Test shoes',totalElevationGain:i===65?null:30,averageHeartRate:i===65?null:150,sourceSport:i===65?null:i===0?'TrailRun':'Run',subtype:i===65?null:i===0?'race':'regular',commute:i%2===0?false:null,trainer:i%3===0?true:false,sourceGear:i===0?'Trail shoes':null,device:i===0?'Stored watch':null,noGps:i===65}));
const deferred=()=>{let release;const promise=new Promise(resolve=>{release=resolve;});return{promise,release};};
export const test=base.extend({
 origin:[async({},use)=>{const server=createServer(async(req,res)=>{try{const requested=path.resolve(staticRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));if(!requested.startsWith(staticRoot+path.sep)&&requested!==staticRoot){res.writeHead(403);res.end();return;}const file=await stat(requested).then(s=>s.isFile()?requested:null).catch(()=>null)||path.join(staticRoot,'index.html');res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));}catch{res.writeHead(500);res.end();}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));await use(`http://127.0.0.1:${server.address().port}`);await new Promise(resolve=>server.close(resolve));},{scope:'worker'}],
 app:async({page,origin},use)=>{
  const app={origin,preferences:{mode:'lines',basemap:'streets',weight:1.6,color:'#ff3038',hoverColor:'#ef1818',highlightColor:'#151b22'},revision:1,geometryRequests:[],patches:[],detailGate:null,patchGate:null,detailStatus:200,patchStatus:200,expire:false,expected401:false,expectedStatus:new Set()};
  const errors=[],serverErrors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',message=>{if(message.type()==='error'&&!(app.expected401&&message.text().includes('401'))&&![...app.expectedStatus].some(status=>message.text().includes('status of '+status)))errors.push(message.text());});page.on('response',response=>{if(response.status()>=500)serverErrors.push({url:response.url(),status:response.status()});});
  await page.addInitScript(()=>{
   // A full navigation to sign-in must not resurrect a credential removed by
   // the application's 401 handler. Seed once per isolated test tab.
   if(!sessionStorage.getItem('heatmap_qa_seeded')){
    localStorage.setItem('hermes_jwt','synthetic-qa');localStorage.setItem('hermes_email','map@example.test');localStorage.setItem('hermes_role','USER');sessionStorage.setItem('heatmap_qa_seeded','1');
   }
   localStorage.setItem('hermes_lang','en');localStorage.setItem('hermes_theme','light');
  });
  await page.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),method=route.request().method(),headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
   try {
    if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
    if(url.pathname.startsWith('/api/maps/tiles')){await route.fulfill({headers,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8e9eb"/></svg>'});return;}
    let body={};
    if(url.pathname.endsWith('/heatmap/preferences')){
     if(method==='PATCH'){app.patches.push(route.request().postDataJSON());if(app.patchGate)await app.patchGate.promise;if(app.patchStatus!==200){app.expectedStatus.add(app.patchStatus);await route.fulfill({headers,status:app.patchStatus,json:{message:'Settings changed'}});return;}app.preferences={...app.preferences,...route.request().postDataJSON()};app.revision++;}body={preferences:app.preferences,revision:app.revision,snapshot:'qa:'+app.revision};
    } else if(url.pathname.endsWith('/heatmap/query')||url.pathname.endsWith('/workouts/query')) {
     if(app.expire){await route.fulfill({headers,status:401,json:{message:'Expired'}});return;}
     if(url.pathname.endsWith('/heatmap/query')){app.geometryRequests.push(route.request().postDataJSON());app.geometryReadTimes?.push(Date.now());if(app.geometryThrottles>0){app.geometryThrottles--;app.expectedStatus.add(429);await route.fulfill({headers:{...headers,'Retry-After':'1'},status:429,json:{message:'Synthetic map cooldown'}});return;}}
     if(url.pathname.endsWith('/heatmap/query')&&app.geometryStatus){app.expectedStatus.add(app.geometryStatus);await route.fulfill({headers,status:app.geometryStatus,json:{message:'Synthetic map query failure'}});return;}
     if(url.pathname.endsWith('/heatmap/query')&&app.geometryGate)await app.geometryGate.promise;const request=route.request().postDataJSON(),f=request.filter||{};
     const pool=app.largeHistory?Array.from({length:1001},(_,i)=>({...workouts[i%65],id:i+1,noGps:false})):workouts.map(w=>({...w,...app.workoutOverrides?.[w.id]}));const items=pool.filter(w=>(!f.q||w.name.toLowerCase().includes(f.q.toLowerCase()))&&(!f.sport||f.sport===w.sport)&&(!f.gear||(f.gear==='UNKNOWN'?!w.gearId&&!w.sourceGear:f.gear.startsWith('source:')?f.gear.slice(7)===w.sourceGear:f.gear===w.gearId))&&(!f.from||w.date>=f.from)&&(!f.to||w.date<=f.to)&&(!Number.isFinite(f.minDistanceKm)||w.distanceKm>=f.minDistanceKm)&&(!Number.isFinite(f.maxDistanceKm)||w.distanceKm<=f.maxDistanceKm)&&(!Number.isFinite(f.minMinutes)||w.movingTimeSeconds/60>=f.minMinutes)&&(!Number.isFinite(f.maxMinutes)||w.movingTimeSeconds/60<=f.maxMinutes)&&['sourceSport','subtype'].every(k=>!f[k]||f[k]===(w[k]||'UNKNOWN'))&&['commute','trainer'].every(k=>!f[k]||(f[k]==='unknown'?w[k]==null:w[k]===(f[k]==='yes')))&&[['AscentM',w.totalElevationGain],['SpeedKmh',w.movingTimeSeconds>0?w.distanceKm*3600/w.movingTimeSeconds:null],['HeartRate',w.averageHeartRate]].every(([k,v])=>(!Number.isFinite(f['min'+k])||(v!=null&&v>=f['min'+k]))&&(!Number.isFinite(f['max'+k])||(v!=null&&v<=f['max'+k]))));
     if(url.pathname.endsWith('/workouts/query')){const offset=Number(request.cursor)||0;body={items:request.ids?items.filter(w=>request.ids.includes(String(w.id))):items.slice(offset,offset+50),snapshot:'qa:'+app.revision,nextCursor:request.ids?null:offset+50<items.length?String(offset+50):null};}
     else{const gps=items.filter(w=>!w.noGps),segments=gps.map(w=>({activityId:w.id,coordinates:app.routeCoordinates||(w.id===65?[[40.722,-74.009],[40.748,-74.009]]:corners),segmentId:0,part:0}));const offset=Number(request.cursor)||0,limit=app.largeHistory?200:segments.length;body={segments:segments.slice(offset,offset+limit),snapshot:'qa:'+app.revision,complete:offset+limit>=segments.length,nextCursor:offset+limit<segments.length?String(offset+limit):null,summary:{activityCount:items.length,gpsActivityCount:gps.length,distanceKm:items.reduce((a,w)=>a+w.distanceKm,0)},bounds:gps.length?bounds:null,focusBounds:gps.length?bounds:null,options:{gear:{'1':'Test shoes','2':'Other shoes'},sourceGear:['Trail shoes'],sourceSports:['Run','TrailRun'],subtypes:['race','regular']},zone:'America/New_York'};}
    } else if(url.pathname==='/api/activities') {if(app.detailGate)await app.detailGate.promise;if(app.detailStatus!==200){app.expectedStatus.add(app.detailStatus);await route.fulfill({headers,status:app.detailStatus,json:{message:'Unavailable'}});return;}body=workouts.find(w=>w.id===Number(url.searchParams.get('id')));}
    else if(url.pathname.endsWith('/tiles')){
     app.coverageReadTimes?.push(Date.now());if(app.coverageThrottles>0){app.coverageThrottles--;app.expectedStatus.add(429);await route.fulfill({headers:{...headers,'Retry-After':'1'},status:429,json:{message:'Synthetic coverage cooldown'}});return;}
     if(app.coverageStatus&&app.coverageStatus!==200){app.expectedStatus.add(app.coverageStatus);await route.fulfill({headers,status:app.coverageStatus,json:{message:'Coverage unavailable'}});return;}
     const id=Number(url.pathname.split('/').at(-2)),n=2**14,x=Math.floor((-73.99+180)/360*n),y=Math.floor((1-Math.log(Math.tan(Math.PI/4+40.735*Math.PI/360))/Math.PI)/2*n);
     if(app.coverageGate?.id===id)await app.coverageGate.promise;
     body={snapshot:'qa:'+app.revision,tileZoom:14,tileCount:id===66?null:3,newTileCount:id===66?null:id===1?2:0,cells:id===1?[[x,y],[x+1,y]]:[],complete:true,nextCursor:null,quality:{basis:'retained-history'}};
     if(id===1&&app.coverageCells){const offset=url.searchParams.has('cursor')?500:0;if(offset&&app.coveragePageGate)await app.coveragePageGate.promise;body={...body,snapshot:offset&&app.coveragePageSnapshot||body.snapshot,tileCount:app.coverageCells.length,newTileCount:app.coverageCells.length,cells:app.coverageCells.slice(offset,offset+500),complete:offset+500>=app.coverageCells.length,nextCursor:offset+500<app.coverageCells.length?'coverage-next':null};}
    }
    else if(url.pathname.endsWith('/track')){app.trackCalls=(app.trackCalls||0)+1;const id=Number(url.pathname.split('/').at(-2));body={segments:id===66?[]:[{activityId:id,coordinates:corners}],snapshot:'qa:'+app.revision,complete:true,nextCursor:null};}
    else if(url.pathname==='/api/auth/protected/ping')body={role:'USER'};
    else if(url.pathname==='/api/training/me')body={id:'synthetic',units:app.units||'metric',revision:1,zone:'UTC'};
    else if(url.pathname==='/api/profile/me')body={displayName:'Map QA',email:'map@example.test',timeZone:'America/New_York'};
    await route.fulfill({headers,json:body});
   } catch(error){if(!page.isClosed()&&!/closed|intercepted|canceled/i.test(error.message))throw error;}
  });
  app.holdGeometry=()=>{app.geometryGate=deferred();return ()=>{app.geometryGate.release();app.geometryGate=null;};};app.holdDetails=()=>{app.detailGate=deferred();return app.detailGate.release;};app.holdPatch=()=>{app.patchGate=deferred();return app.patchGate.release;};
  app.holdCoverage=id=>{app.coverageGate={...deferred(),id};return app.coverageGate.release;};app.holdCoveragePage=()=>{app.coveragePageGate=deferred();return app.coveragePageGate.release;};
  await page.goto(origin+'/heatmap');await expect(map(page)).toHaveAttribute('data-render-mode','lines');await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();
  await use(app);app.geometryGate?.release();app.detailGate?.release();app.patchGate?.release();app.coverageGate?.release();app.coveragePageGate?.release();expect(serverErrors,'Unexpected 5xx responses').toEqual([]);expect(errors,'Unexpected browser errors').toEqual([]);
 }
});
export {expect};
export const map=page=>page.getByRole('region',{name:/^Workout map/});
export const display=page=>page.getByRole('button',{name:'Display',exact:true}).click();
export const filters=page=>page.getByRole('button',{name:'Filters',exact:true}).click();
export const close=page=>page.getByRole('button',{name:'Close',exact:true}).click();
export async function browse(page){await filters(page);await page.getByText('Browse matching workouts',{exact:true}).click();}
export async function axe(page){const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);}
export async function pickRoute(page,touch=false){const point=await map(page).locator('canvas').evaluateAll(nodes=>{for(const node of nodes){const r=node.getBoundingClientRect(),pixels=node.getContext('2d').getImageData(0,0,node.width,node.height).data;for(let y=2;y<node.height-2;y++)for(let x=2;x<node.width-2;x++){const i=(y*node.width+x)*4;if(pixels[i+3]>200&&r.left+x>60&&r.left+x<innerWidth-70&&r.top+y>80&&r.top+y<innerHeight-80&&document.querySelector('.workout-map-surface').contains(document.elementFromPoint(r.left+x,r.top+y)))return{x:r.left+x,y:r.top+y};}}return null;});expect(point).not.toBeNull();if(touch)await page.touchscreen.tap(point.x,point.y);else await page.mouse.click(point.x,point.y);}
