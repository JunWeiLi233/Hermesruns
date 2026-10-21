import {chromium, expect} from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {createServer} from 'node:http';
import {readFile,stat,mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../../../',import.meta.url));
const output=path.join(root,'replica/statshunters/validation');
const staticRoot=path.join(root,'backend/src/main/resources/static');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.webp':'image/webp','.json':'application/json'};
const server=createServer(async(req,res)=>{
  try {
    const requested=path.resolve(staticRoot,'.'+decodeURIComponent(new URL(req.url,'http://localhost').pathname));
    if(!requested.startsWith(staticRoot+path.sep)&&requested!==staticRoot){res.writeHead(403);res.end();return;}
    const file=await stat(requested).then(s=>s.isFile()?requested:null).catch(()=>null)||path.join(staticRoot,'index.html');
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(await readFile(file));
  }catch{res.writeHead(500);res.end();}
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const origin=`http://127.0.0.1:${server.address().port}`;
const corners=[[40.72,-74.01],[40.75,-74.01],[40.75,-73.97],[40.72,-73.97],[40.72,-74.01]];
const segments=Array.from({length:64},(_,i)=>({activityId:i+1,segmentId:0,part:0,coordinates:corners,sourcePointCount:5,retainedPointCount:5,sourceSegmentsKnown:true})).concat({activityId:65,segmentId:0,part:0,coordinates:[[40.722,-74.009],[40.748,-74.009]],sourcePointCount:2,retainedPointCount:2,sourceSegmentsKnown:true});
const bounds=[40.72,-74.01,40.75,-73.97];
const browser=await chromium.launch({channel:'chrome',headless:true});const checks=[];
try {
 for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]) {
  const context=await browser.newContext({viewport});let preferences={mode:'lines',basemap:'streets',weight:1.6,color:'#ff3038',hoverColor:'#ef1818',highlightColor:'#151b22'},revision=1,filters={};
  await context.addInitScript(()=>{localStorage.setItem('hermes_jwt','synthetic-workout-map');localStorage.setItem('hermes_email','map@example.test');localStorage.setItem('hermes_role','USER');localStorage.setItem('hermes_lang','en');localStorage.setItem('hermes_theme','light');});
  await context.route('**/api/**',async route=>{
   const url=new URL(route.request().url()),method=route.request().method();const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
   if(method==='OPTIONS'){await route.fulfill({status:204,headers});return;}
   if(url.pathname.startsWith('/api/maps/tiles')){await route.fulfill({headers,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#e8e9eb"/></svg>'});return;}
   let body={};
   if(url.pathname.endsWith('/heatmap/preferences')){if(method==='PATCH'){preferences={...preferences,...route.request().postDataJSON()};revision++;}body={preferences,revision};}
   else if(url.pathname.endsWith('/heatmap/query')){filters=route.request().postDataJSON().filter;const empty=filters.q==='no-such-workout';body={segments:empty?[]:segments,snapshot:'fixture:'+revision,complete:true,nextCursor:null,summary:{activityCount:empty?0:65,gpsActivityCount:empty?0:65,distanceKm:empty?0:325,movingSeconds:117000},bounds:empty?null:bounds,focusBounds:empty?null:bounds,options:{gear:{'1':'Test shoes'}},zone:'America/New_York'};}
   else if(url.pathname.endsWith('/workouts/query'))body={items:[{id:1,name:'Invented morning loop',date:'2026-10-19',distanceKm:5}],snapshot:'fixture:'+revision,nextCursor:null};
   else if(url.pathname.endsWith('/track'))body={segments:[segments[0]],snapshot:'fixture:'+revision,complete:true,nextCursor:null};
   else if(url.pathname==='/api/activities')body={id:Number(url.searchParams.get('id')),name:'Invented morning loop',distanceKm:5,movingTimeSeconds:1800,startDate:'2026-10-19',provider:'FILE',totalElevationGain:35,shoeName:'Test shoes'};
   else if(url.pathname==='/api/auth/protected/ping')body={role:'USER'};
   else if(url.pathname==='/api/training/me')body={id:'test',units:'metric',revision:1,zone:'UTC'};
   else if(url.pathname==='/api/profile/me')body={displayName:'Map test',email:'map@example.test',timeZone:'America/New_York'};
   await route.fulfill({headers,json:body});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(origin+'/heatmap');const surface=page.locator('.workout-map-surface');
  await expect(surface).toHaveAttribute('data-render-mode','lines');await expect(surface).toHaveAttribute('data-route-parts','65');
  await expect(page.locator('.workout-map-panel')).toHaveCount(0);await expect(page.locator('.mobile-runner-nav,.ex-native-nav,.hm-explorer-toolbar')).toHaveCount(0);
  const layout=await page.locator('main').evaluate(node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,overflow:document.documentElement.scrollWidth>innerWidth};});
  expect(layout).toEqual({x:0,y:0,width:viewport.width,height:viewport.height,overflow:false});
  await page.screenshot({path:path.join(output,`workout-map-${name}-lines.png`)});
  await page.getByRole('button',{name:'Display',exact:true}).click();await page.getByLabel('Route display',{exact:true}).selectOption('heat');
  await expect(surface).toHaveAttribute('data-render-mode','heat');await expect(page.getByLabel('Route display',{exact:true})).toBeEnabled();
  await page.getByRole('button',{name:'Close',exact:true}).click();
  const initialZoom=Number(await surface.getAttribute('data-render-zoom'));
  for(let step=1;step<=2;step++){await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(surface).toHaveAttribute('data-render-zoom',String(initialZoom-step));}
  await page.waitForTimeout(600);
  const heat=await page.locator('.workout-map-heat-tile').evaluateAll(nodes=>{let painted=0,red=0,blue=0;for(const node of nodes){const p=node.getContext('2d').getImageData(0,0,256,256).data;for(let i=0;i<p.length;i+=4)if(p[i+3]>100){painted++;if(p[i]>200&&p[i+2]<100)red++;if(p[i+2]>180&&p[i]<180)blue++;}}return{painted,red,blue};});
  expect(heat.painted).toBeGreaterThan(40);expect(heat.red).toBeGreaterThan(20);expect(heat.blue).toBeGreaterThan(0);
  await page.screenshot({path:path.join(output,`workout-map-${name}-heat-zoomed-out.png`)});
  // Return to the full route framing. Keyboard selection uses the same popup as map taps.
  await page.getByRole('button',{name:'Show all matching routes',exact:true}).click();
  await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByText('Browse matching workouts',{exact:true}).click();
  await page.getByRole('button',{name:/Invented morning loop/}).click();await expect(page.getByRole('dialog')).toContainText('5 km');
  await expect(page.getByRole('dialog')).toContainText('6:00 /km');await page.getByRole('button',{name:'Highlight route',exact:true}).click();
  await expect(surface).toHaveAttribute('data-render-mode','highlight');await expect(surface).toHaveAttribute('data-route-parts','1');await expect(page.locator('.workout-map-start')).toBeVisible();
  await expect(page.locator('.workout-map-total')).toHaveText('65 workouts · 325 km');
  await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(surface).toHaveAttribute('data-render-mode','heat');await expect(surface).toHaveAttribute('data-route-parts','65');
  // Pointer hit testing, including a bounded picker for overlapping workouts.
  const hit=await page.locator('.workout-map-heat-tile').evaluateAll(nodes=>{for(const node of nodes){const r=node.getBoundingClientRect(),p=node.getContext('2d').getImageData(0,0,256,256).data;for(let y=1;y<255;y++)for(let x=1;x<255;x++){const i=(y*256+x)*4;if(p[i+3]>200&&r.left+x>60&&r.left+x<innerWidth-70&&r.top+y>80&&r.top+y<innerHeight-80)return{x:r.left+x,y:r.top+y};}}return null;});
  expect(hit).not.toBeNull();await page.mouse.click(hit.x,hit.y);await expect(page.getByRole('dialog')).toBeVisible();await expect(page.getByLabel('Overlapping workouts')).toBeVisible();await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByLabel('Workout name',{exact:true}).fill('no-such-workout');await page.getByLabel('Workout name',{exact:true}).press('Enter');
  await expect(page.locator('.workout-map-total')).toHaveText('0 workouts · 0 km');expect(new URL(page.url()).searchParams.get('q')).toBe('no-such-workout');await expect(page.getByRole('status').filter({hasText:'No matching workouts'})).toBeVisible();
  await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.locator('.workout-map-total')).toHaveText('65 workouts · 325 km');await page.keyboard.press('Escape');
  const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
  expect(errors).toEqual([]);checks.push({viewport:name,layout,heat,initialZoom,workoutPopup:true,pointerOverlap:true,highlightPreservesTotals:true,bookmarkFilter:true,axeViolations:0,consoleErrors:0,status:'passed'});await context.close();
 }
 await writeFile(path.join(output,'workout-map-browser.json'),JSON.stringify({status:'passed',syntheticOnly:true,checks},null,2));console.log(JSON.stringify({status:'passed',checks}));
} finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
