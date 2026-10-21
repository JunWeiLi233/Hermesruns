import {test,expect,map,display,close,browse,axe} from './support.mjs';

async function zoomTo(page,target){
 let current=Number(await map(page).getAttribute('data-render-zoom'));
 while(current!==target){await page.getByRole('button',{name:current<target?'Zoom in':'Zoom out',exact:true}).click();current+=current<target?1:-1;await expect(map(page)).toHaveAttribute('data-render-zoom',String(current));}
 await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}

test('F04-HCQ-E1 new cells stay geographic through matched zooms and pan, then Clear restores each mode',async({page,app},info)=>{
 const n=2**14,x=Math.floor((-73.99+180)/360*n),y=Math.floor((1-Math.log(Math.tan(Math.PI/4+40.735*Math.PI/360))/Math.PI)/2*n);
 for(const mode of ['lines','heat']){
  // Begin each display-mode run with transient list/popup state reset.
  await page.reload();await expect(map(page)).toHaveAttribute('data-route-parts','65');
  if(mode==='heat'){await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);}
  await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('dialog')).toContainText('3 / 2');
  await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');
  for(const zoom of [10,12,14,15]){
   await zoomTo(page,zoom);await expect(map(page)).toHaveAttribute('data-render-mode','highlight');await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');
   const alpha=await map(page).locator('canvas').evaluateAll((nodes,{x,y,zoom})=>{
    const size=256*2**zoom,project=([lat,lon])=>[size*(lon/360+.5),size*(.5-Math.log((1+Math.sin(lat*Math.PI/180))/(1-Math.sin(lat*Math.PI/180)))/(4*Math.PI))];
    const a=project([40.72,-74.01]),b=project([40.75,-73.97]);
    const px=innerWidth/2+(x+.5)*256*2**(zoom-14)-(a[0]+b[0])/2,py=innerHeight/2+(y+.5)*256*2**(zoom-14)-(a[1]+b[1])/2;
    let result=0;for(const node of nodes){const r=node.getBoundingClientRect(),cx=Math.round((px-r.left)*node.width/r.width),cy=Math.round((py-r.top)*node.height/r.height);if(cx<0||cy<0||cx>=node.width||cy>=node.height)continue;const data=node.getContext('2d').getImageData(cx,cy,1,1).data;if(Math.abs(data[0]-230)<6&&Math.abs(data[1]-155)<6&&Math.abs(data[2]-37)<6)result=Math.max(result,data[3]);}return result;
   },{x,y,zoom});expect(alpha).toBeGreaterThan(40);
  }
  await map(page).press('ArrowRight');await map(page).press('ArrowLeft');await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');await expect(page.getByRole('button',{name:'Workout start',exact:true})).toBeVisible();
  await page.screenshot({path:info.outputPath(`new-cells-zoom15-${mode}.png`)});await axe(page);
  await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(map(page)).toHaveAttribute('data-render-mode',mode);await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();
 }
});

test('F02-HCQ-E1 query failure and incoming revision recover through the existing Retry',async({page,app})=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 for(const status of [400,409]){
  app.geometryStatus=status;await page.evaluate(()=>window.dispatchEvent(new Event('hermes:strava-sync-finished')));await expect(page.getByRole('alert')).toContainText(status===409?'Your history changed. Reload this view.':'Routes could not load.');await expect(map(page)).toHaveAttribute('data-route-parts','0');
  app.geometryStatus=null;app.revision++;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('alert')).toHaveCount(0);await expect(map(page)).toHaveAttribute('data-route-parts','65');await expect(map(page)).toHaveAttribute('data-heat-state','ready');await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);
 }
});

test('F06-HCQ-E2 heat and new-cell reads honor server cooldown and recover without a new control',async({page,app})=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 app.geometryReadTimes=[];app.geometryThrottles=1;await page.evaluate(()=>window.dispatchEvent(new Event('hermes:strava-sync-finished')));await expect.poll(()=>app.geometryReadTimes.length).toBe(1);await expect(page.getByRole('alert')).toHaveCount(0);await expect(map(page)).toHaveAttribute('data-heat-state','ready');expect(app.geometryReadTimes[1]-app.geometryReadTimes[0]).toBeGreaterThanOrEqual(950);
 app.coverageReadTimes=[];app.coverageThrottles=1;await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('dialog')).toContainText('3 / 2');expect(app.coverageReadTimes[1]-app.coverageReadTimes[0]).toBeGreaterThanOrEqual(950);
 await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode','heat');await axe(page);
});
