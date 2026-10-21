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
const points=Array.from({length:300},(_,i)=>[1+i%20,40.72+i*.00007,-74.01+i*.00004,null,.5,20]);
// Invented ordered loop, large enough to retain a visible interior after two
// zoom-out steps. Repeated runs must not become a filled density blob.
const corners=[[40.72,-74.01],[40.75,-74.01],[40.75,-73.97],[40.72,-73.97],[40.72,-74.01]];
const trace=corners.slice(0,-1).flatMap((start,leg)=>Array.from({length:25},(_,i)=>({latitude:start[0]+(corners[leg+1][0]-start[0])*i/25,longitude:start[1]+(corners[leg+1][1]-start[1])*i/25}))).concat({latitude:corners[0][0],longitude:corners[0][1]});
const data={pointCount:points.length,points,bounds:{minLatitude:40.7,maxLatitude:40.8,minLongitude:-74.05,maxLongitude:-73.95},diagnostics:{complete:true}};
const browser=await chromium.launch({channel:'chrome',headless:true});
const checks=[];
try {
  for(const [name,viewport] of [['desktop',{width:1440,height:900}],['mobile',{width:390,height:844}]]){
    const context=await browser.newContext({viewport});
    await context.addInitScript(()=>{localStorage.setItem('hermes_jwt','synthetic-simple-heatmap');localStorage.setItem('hermes_email','simple-map@example.test');localStorage.setItem('hermes_role','USER');localStorage.setItem('hermes_lang','en');localStorage.setItem('hermes_theme','light');});
    await context.route('**/api/**',async route=>{
      const url=new URL(route.request().url());
      const headers={'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'*','Access-Control-Allow-Methods':'GET,POST,PATCH,OPTIONS'};
      if(route.request().method()==='OPTIONS'){await route.fulfill({status:204,headers});return;}
      if(url.pathname.startsWith('/api/maps/tiles')){await route.fulfill({headers,contentType:'image/svg+xml',body:'<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><rect width="256" height="256" fill="#172029"/></svg>'});return;}
      if(url.pathname==='/api/activities/route-previews'){await route.fulfill({headers,json:url.searchParams.get('ids').split(',').map(activityId=>({activityId:Number(activityId),points:trace,availability:'READY',pointCount:trace.length}))});return;}
      const body=url.pathname.startsWith('/api/profile/heatmap')?data:url.pathname==='/api/auth/protected/ping'?{role:'USER'}:url.pathname==='/api/training/me'?{id:'synthetic-owner',units:'metric',revision:1,zone:'UTC'}:url.pathname==='/api/profile/me'?{displayName:'Map test',email:'simple-map@example.test',timeZone:'UTC'}:{};
      await route.fulfill({headers,json:body});
    });
    const page=await context.newPage();const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    await page.goto(origin+'/heatmap');
    const canvas=page.locator('.heatmap-page-dot-canvas[data-render-mode=routes]');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute('data-route-segments','20');
    await expect(page.locator('.leaflet-control-attribution')).toBeVisible();
    await expect(page.getByRole('button')).toHaveCount(4);
    await expect(page.locator('.ex-native-nav,.hm-explorer-toolbar,.mobile-runner-nav,.heatmap-page-topbar')).toHaveCount(0);
    const layout=await page.locator('main').evaluate(node=>{const rect=node.getBoundingClientRect();return{x:rect.x,y:rect.y,width:rect.width,height:rect.height,viewportWidth:innerWidth,viewportHeight:innerHeight,overflow:document.documentElement.scrollWidth>innerWidth};});
    if(layout.x!==0||layout.y!==0||layout.width!==viewport.width||layout.height!==viewport.height){
      console.log(JSON.stringify({layout,ancestors:await page.locator('main').evaluate(node=>{const result=[];for(let p=node;p;p=p.parentElement){const style=getComputedStyle(p);result.push({tag:p.tagName,class:p.className,id:p.id,transform:style.transform,filter:style.filter,backdropFilter:style.backdropFilter,contain:style.contain,position:style.position,width:style.width,maxWidth:style.maxWidth,margin:style.margin,padding:style.padding});}return result;})}));
      await page.screenshot({path:path.join(output,'simple-heatmap-layout-before.png')});
    }
    expect(layout.x).toBe(0);expect(layout.y).toBe(0);expect(layout.width).toBe(viewport.width);expect(layout.height).toBe(viewport.height);expect(layout.overflow).toBe(false);
    const mapSize=await page.locator('.heatmap-page-map-canvas').boundingBox();
    expect(mapSize).toEqual({x:0,y:0,width:viewport.width,height:viewport.height});
    const readCoverage=()=>canvas.evaluate(node=>{const data=node.getContext('2d').getImageData(0,0,node.width,node.height).data;let painted=0,red=0,minX=node.width,minY=node.height,maxX=0,maxY=0;for(let i=0;i<data.length;i+=4){if(data[i+3]>100){painted++;const x=(i/4)%node.width,y=Math.floor(i/4/node.width);minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);if(data[i]>200&&data[i+1]<100&&data[i+2]<100)red++;}}return{painted,red,fillRatio:painted/((maxX-minX+1)*(maxY-minY+1)),centerAlpha:data[(Math.floor((minY+maxY)/2)*node.width+Math.floor((minX+maxX)/2))*4+3]};});
    const pixels=await readCoverage();
    expect(pixels.red).toBeGreaterThan(100);expect(pixels.centerAlpha).toBe(0);expect(pixels.fillRatio).toBeLessThan(.6);
    const initialZoom=Number(await canvas.getAttribute('data-render-zoom'));
    for(let step=1;step<=2;step++){
      await page.getByRole('button',{name:'Zoom out',exact:true}).click();
      await expect(canvas).toHaveAttribute('data-render-zoom',String(initialZoom-step));
    }
    const zoomedOut=await readCoverage();
    expect(zoomedOut.red).toBeGreaterThan(30);expect(zoomedOut.centerAlpha).toBe(0);expect(zoomedOut.fillRatio).toBeLessThan(.6);
    await page.screenshot({path:path.join(output,`simple-heatmap-${name}-zoomed-out.png`)});
    await page.getByRole('button',{name:'Zoom in',exact:true}).click();
    await expect(canvas).toHaveAttribute('data-render-zoom',String(initialZoom-1));
    await page.locator('.leaflet-container').press('ArrowRight');
    await expect(canvas).toBeVisible();
    const accessibility=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();
    expect(accessibility.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
    await page.screenshot({path:path.join(output,`simple-heatmap-${name}.png`)});
    expect(errors).toEqual([]);
    checks.push({viewport:name,layout,pixels,zoomedOut,zoomLevels:[initialZoom,initialZoom-1,initialZoom-2],axeViolations:0,consoleErrors:0,status:'passed'});
    await context.close();
  }
  await mkdir(output,{recursive:true});await writeFile(path.join(output,'simple-heatmap-browser.json'),JSON.stringify({status:'passed',syntheticOnly:true,checks},null,2));
  console.log(JSON.stringify({status:'passed',viewports:checks.map(c=>c.viewport)}));
}finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
