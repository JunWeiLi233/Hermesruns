import {test,expect,map,display,filters,close,pickRoute,axe} from './support.mjs';

test('a fully paged history survives repeated mode changes and camera moves without route reads',async({page,app,isMobile},info)=>{
 app.largeHistory=true;
 await filters(page);await page.getByLabel('Workout name',{exact:true}).fill('Loop');
 await page.getByRole('button',{name:'Apply',exact:true}).click();await close(page);
 await expect(map(page)).toHaveAttribute('data-route-parts','1001');
 await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);
 const reads=app.geometryRequests.length;
 expect(app.geometryRequests.slice(-6).map(q=>q.cursor||'0')).toEqual(['0','200','400','600','800','1000']);
 app.geometryStatus=503;
 for(const mode of ['Route heat','Activity lines','Route heat','Activity lines']){
  await display(page);await page.getByRole('radio',{name:mode,exact:true}).check();
  await expect(page.getByRole('status').filter({hasText:'Saved to your account'})).toBeVisible();await close(page);
  for(const delta of [-1,1]){const zoom=Number(await map(page).getAttribute('data-render-zoom'));await page.getByRole('button',{name:delta>0?'Zoom in':'Zoom out',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-zoom',String(zoom+delta));}
  await map(page).press('ArrowRight');await map(page).press('ArrowDown');await map(page).press('ArrowLeft');await map(page).press('ArrowUp');
  await page.getByRole('button',{name:'Show all matching routes',exact:true}).click();
  if(mode==='Route heat')await expect(map(page)).toHaveAttribute('data-heat-state','ready');
  await page.waitForTimeout(350);
  expect(app.geometryRequests).toHaveLength(reads);await expect(map(page)).toHaveAttribute('data-route-parts','1001');
  await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);
 }
 await pickRoute(page,isMobile);await expect(page.getByRole('dialog')).toBeVisible();await axe(page);await close(page);
 await page.screenshot({path:info.outputPath('paged-history-after-mode-and-camera.png')});
});

test('camera controls remain local while a heat preference save is pending',async({page,app},info)=>{
 const reads=app.geometryRequests.length;app.geometryStatus=503;const release=app.holdPatch();
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();
 await expect(page.getByRole('status').filter({hasText:'Saving'})).toBeVisible();
 // The narrow drawer intentionally covers camera controls; close it while the
 // save is held so this follows the same reachable interaction as a user.
 await close(page);
 for(const delta of [1,-1]){const zoom=Number(await map(page).getAttribute('data-render-zoom'));await page.getByRole('button',{name:delta>0?'Zoom in':'Zoom out',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-zoom',String(zoom+delta));}
 await map(page).press('ArrowRight');await map(page).press('ArrowLeft');
 expect(app.geometryRequests).toHaveLength(reads);release();
 await display(page);await expect(page.getByRole('status').filter({hasText:'Saved to your account'})).toBeVisible();await close(page);
 await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 await display(page);await page.getByRole('radio',{name:'Activity lines',exact:true}).check();await expect(page.getByRole('radio',{name:'Activity lines',exact:true})).toBeEnabled();await close(page);
 await page.waitForTimeout(350);expect(app.geometryRequests).toHaveLength(reads);await expect(page.getByRole('alert')).toHaveCount(0);await expect(map(page)).toHaveAttribute('data-route-parts','65');
 await page.screenshot({path:info.outputPath('pending-save-camera-stable.png')});
});
