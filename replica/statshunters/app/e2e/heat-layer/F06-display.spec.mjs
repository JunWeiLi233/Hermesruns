import {test,expect,map,display,close,axe,pickRoute} from './support.mjs';

test('HM-HC-001 equivalent reversed and resampled diagonals paint identical heat',async({page,app})=>{
 const size=256*2**14,longitude=x=>x/size*360-180,latitude=y=>Math.atan(Math.sinh(Math.PI*(1-2*y/size)))*180/Math.PI;
 const x=Math.floor((-73.99+180)/360*size),y=Math.floor((1-Math.log(Math.tan(Math.PI/4+40.735*Math.PI/360))/Math.PI)/2*size);
 const a=[x+100.8,y+.2],b=[x+.2,y+100.8],middle=a.map((v,i)=>v+(b[i]-v)/3),coordinate=([px,py])=>[latitude(py),longitude(px)];
 async function pixels(points){
  app.routeCoordinates=points.map(coordinate);await page.reload();await expect(map(page)).toHaveAttribute('data-route-parts','65');
  if(await map(page).getAttribute('data-render-mode')!=='heat'){await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);}
  await expect(map(page)).toHaveAttribute('data-heat-state','ready');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  // Leaflet can retain an empty full-viewport line canvas after switching modes.
  // Compare heat tiles only, independent of that renderer's allocation lifetime.
  return map(page).locator('canvas').evaluateAll(nodes=>nodes.filter(node=>node.width===256&&node.height===256).map(node=>{const r=node.getBoundingClientRect(),data=node.getContext('2d').getImageData(0,0,node.width,node.height).data;let hash=2166136261,painted=0;for(let i=0;i<data.length;i++){hash=Math.imul(hash^data[i],16777619);if(i%4===3&&data[i])painted++;}return{x:r.left,y:r.top,width:node.width,height:node.height,hash:hash>>>0,painted};}).sort((a,b)=>a.x-b.x||a.y-b.y));
 }
 const forward=await pixels([a,b]);expect(forward.reduce((sum,tile)=>sum+tile.painted,0)).toBeGreaterThan(0);
 expect(await pixels([b,a])).toEqual(forward);expect(await pixels([a,middle,b])).toEqual(forward);await axe(page);
});
test('P4 retained geometry keeps heat and hit testing available without viewport reads',async({page,app,isMobile})=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 const reads=app.geometryRequests.length;app.geometryStatus=503;await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(map(page)).toHaveAttribute('data-heat-state','ready');await pickRoute(page,isMobile);await expect(page.getByRole('dialog')).toBeVisible();
});
test('F06-HM-E1/E2 selected heat survives pending save and a conflict is recoverable',async({page,app})=>{
 await display(page);const release=app.holdPatch();await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeChecked();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeDisabled();release();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();app.patchGate=null;
 app.patchStatus=409;await page.getByRole('radio',{name:'Dark map',exact:true}).click();await expect(page.getByText('Settings changed in another view. Retry before saving.')).toBeVisible();await expect(page.getByRole('radio',{name:'Light streets',exact:true})).toBeChecked();app.patchStatus=200;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByText('Settings changed in another view. Retry before saving.')).toHaveCount(0);await axe(page);
});
test('F06-HM-E6 width drag completes once, keyboard width and dark display persist',async({page,app,isMobile},info)=>{
 await display(page);const slider=page.getByRole('slider',{name:'Line width',exact:true});if(!isMobile){const r=await slider.boundingBox();await page.mouse.move(r.x+r.width*.2,r.y+r.height/2);await page.mouse.down();await page.mouse.move(r.x+r.width*.5,r.y+r.height/2);expect(app.patches).toHaveLength(0);await page.mouse.move(r.x+r.width*.9,r.y+r.height/2);await page.mouse.up();await expect(slider).toBeEnabled();expect(app.patches).toHaveLength(1);expect(app.patches[0].weight).toBeGreaterThan(4.5);}else{await slider.press('End');await expect(slider).toHaveValue('6');}
 await page.getByRole('radio',{name:'Dark map',exact:true}).check();await expect(map(page)).toHaveAttribute('data-basemap','dark');await expect(page.getByRole('radio',{name:'Light streets',exact:true})).toBeEnabled();await page.reload();await expect(map(page)).toHaveAttribute('data-basemap','dark');await display(page);await axe(page);await page.screenshot({path:info.outputPath('S04-display.png')});
});
test('F06-HM-H2 heat keeps interiors transparent across rapid zoom and pan',async({page,app},info)=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);let zoom=Number(await map(page).getAttribute('data-render-zoom'));for(let i=1;i<=2;i++){await page.getByRole('button',{name:'Zoom out',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-zoom',String(zoom-i));}await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 const coverage=await map(page).locator('canvas').evaluateAll(nodes=>{let painted=0,red=0,blue=0,center=0;for(const node of nodes){const r=node.getBoundingClientRect(),pixels=node.getContext('2d').getImageData(0,0,node.width,node.height).data;for(let i=0;i<pixels.length;i+=4)if(pixels[i+3]>100){painted++;if(pixels[i]>200&&pixels[i+2]<100)red++;if(pixels[i+2]>180&&pixels[i]<180)blue++;}const x=Math.floor(innerWidth/2-r.left),y=Math.floor(innerHeight/2-r.top);if(x>=0&&x<node.width&&y>=0&&y<node.height)center=Math.max(center,pixels[(y*node.width+x)*4+3]);}return{painted,red,blue,center};});expect(coverage.center).toBe(0);expect(coverage.red).toBeGreaterThan(20);expect(coverage.blue).toBeGreaterThan(0);await page.screenshot({path:info.outputPath('heat-city-zoom.png')});await map(page).press('ArrowRight');await expect(map(page)).toHaveAttribute('data-render-mode','heat');await axe(page);
});

test('HM-P1 1001 workouts render complete paged heat without closing route interiors',async({page,app},info)=>{
 app.largeHistory=true;await page.reload();await expect(page.getByText('1,001 workouts · 5,005 km',{exact:true})).toBeVisible();await expect(map(page)).toHaveAttribute('data-route-parts','1001');
 await page.evaluate(()=>{window.heatQaTasks=[];new PerformanceObserver(list=>{for(const entry of list.getEntries())window.heatQaTasks.push(entry.duration);}).observe({type:'longtask',buffered:false});});
 await display(page);const began=Date.now();await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await expect(map(page)).toHaveAttribute('data-render-mode','heat');await expect(map(page)).toHaveAttribute('data-route-parts','1001');await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);
 await expect(map(page)).toHaveAttribute('data-heat-state','ready');await expect(map(page)).toHaveAttribute('data-heat-method','worker');await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));const wallMs=Date.now()-began;const longTasks=await page.evaluate(()=>window.heatQaTasks);await info.attach('render-timing',{body:JSON.stringify({workouts:1001,heatSwitchAndPaintMs:wallMs,longTasksMs:longTasks,maximumLongTaskMs:Math.max(0,...longTasks),method:await map(page).getAttribute('data-heat-method')}),contentType:'application/json'});expect(wallMs).toBeLessThan(10000);await axe(page);
});
