import {test,expect,map,display,close,browse,axe,pickRoute} from './support.mjs';

test('R4/R5 optional new coverage keeps default map clean and clear restores heat',async({page,app,isMobile},info)=>{
 await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');await pickRoute(page,isMobile);
 const popup=page.getByRole('dialog');await expect(popup).toContainText('3 / 2');await axe(page);await page.screenshot({path:info.outputPath('S06-coverage-counts.png')});
 await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');await expect(map(page)).toHaveAttribute('data-render-mode','highlight');await expect(page.getByRole('button',{name:'Workout start',exact:true})).toBeVisible();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);await page.screenshot({path:info.outputPath('S02-new-coverage.png')});
 await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(map(page)).toHaveAttribute('data-render-mode','heat');await axe(page);
});
test('R4 coverage failure is recoverable without blocking workout details or route highlight',async({page,app})=>{
 app.coverageStatus=422;await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByText('Coverage could not load.')).toBeVisible();await expect(page.getByRole('button',{name:'Highlight route',exact:true})).toBeEnabled();await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();
 app.coverageStatus=200;await page.getByRole('button',{name:'Retry coverage',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('3 / 2');await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeEnabled();await axe(page);
});

test('F04-M-E1/E2 overlap choices change details and overflow reaches the full filtered list',async({page,app,isMobile})=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');await pickRoute(page,isMobile);
 const overlap=page.getByLabel('Overlapping workouts');await expect(overlap).toBeEnabled();await expect(overlap.locator('option')).toHaveCount(8);await overlap.selectOption('8');await expect(page.getByRole('heading',{name:'Loop 8',exact:true})).toBeVisible();await expect(overlap).toHaveValue('8');await axe(page);
 await page.getByRole('button',{name:'Browse all matches',exact:true}).click();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('region',{name:'Filters',exact:true})).toBeVisible();await page.getByRole('button',{name:'Load more',exact:true}).click();await expect(page.getByRole('button',{name:/Indoor session/})).toBeVisible();await expect(page.getByRole('button',{name:'Load more',exact:true})).toHaveCount(0);await axe(page);
});

test('F04-M-E3 route hit testing survives matched zoom levels in lines and heat',async({page,app,isMobile})=>{
 // Keep actual route coverage under the zoom center, rather than zooming into
 // the empty interior of the separate loop-transparency fixture.
 app.routeCoordinates=[[40.72,-74.01],[40.735,-73.99],[40.75,-73.97]];await page.reload();await expect(map(page)).toHaveAttribute('data-route-parts','65');await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeEnabled();
 for(const mode of ['lines','heat']){
  if(mode==='heat'){await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);}
  for(const target of [9,12,15]){
   let z=Number(await map(page).getAttribute('data-render-zoom'));while(z!==target){await page.getByRole('button',{name:z<target?'Zoom in':'Zoom out',exact:true}).click();z+=z<target?1:-1;await expect(map(page)).toHaveAttribute('data-render-zoom',String(z));}
   if(mode==='heat')await expect(map(page)).toHaveAttribute('data-heat-state','ready');else await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);
   await pickRoute(page,isMobile);await expect(page.getByRole('heading',{name:/Élan/})).toBeVisible();await page.getByRole('button',{name:'Highlight route',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode','highlight');await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode',mode);
  }
 }
 await axe(page);
});

for(const viewport of [{width:320,height:568},{width:844,height:390}])test(`F04-M-E4 popup actions remain reachable at ${viewport.width}x${viewport.height}`,async({page,app,isMobile},info)=>{
 await page.setViewportSize(viewport);await page.getByRole('button',{name:'Show all matching routes',exact:true}).click();await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');await pickRoute(page,isMobile);const popup=page.getByRole('dialog');await expect(popup).toBeVisible();
 await axe(page);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await popup.getByRole('button',{name:'Highlight route',exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:info.outputPath(`popup-${viewport.width}x${viewport.height}.png`)});await popup.getByRole('button',{name:'Highlight route',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode','highlight');await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);
});
test('F04-HM-H1/H2 pointer or touch overlap selection, popup, highlight and clear',async({page,app,isMobile},info)=>{
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(map(page)).toHaveAttribute('data-render-mode','heat');await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 await pickRoute(page,isMobile);const popup=page.getByRole('dialog');await expect(popup).toBeVisible();await expect(page.getByLabel('Overlapping workouts')).toBeVisible();await expect(popup).toContainText('5 km');await expect(page.getByText(/^Showing up to eight nearby workouts\./)).toBeVisible();expect(await page.getByLabel('Overlapping workouts').locator('option').allTextContents()).toEqual(expect.arrayContaining([expect.stringContaining('2026-10-19')]));await axe(page);await page.screenshot({path:info.outputPath('workout-popup.png')});
 await page.getByRole('button',{name:'Highlight route',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode','highlight');await expect(page.getByRole('button',{name:'Workout start',exact:true})).toBeVisible();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-mode','heat');await axe(page);
});
test('F04-HM-E1 a late dismissed detail cannot cover the display drawer',async({page,app})=>{
 const release=app.holdDetails();await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('dialog')).toBeVisible();await display(page);release();await page.waitForTimeout(100);await expect(page.getByRole('dialog')).toHaveCount(0);await expect(page.getByRole('region',{name:'Display',exact:true})).toBeVisible();await axe(page);
});
test('F04-HM-E2 no GPS after paged keyboard browsing preserves workout and totals',async({page,app})=>{
 await browse(page);await page.getByRole('button',{name:'Load more',exact:true}).click();await page.getByRole('button',{name:/Indoor session/}).click();await page.getByRole('button',{name:'Highlight route',exact:true}).click();await expect(page.getByText('No stored GPS route is available.')).toBeVisible();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('F04-HM-N1 unavailable workout remains recoverable',async({page,app})=>{
 app.detailStatus=404;await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('alert')).toContainText('This workout could not load.');app.detailStatus=200;await page.getByRole('button',{name:'Retry',exact:true}).click();await expect(page.getByRole('heading',{name:/Élan/})).toBeVisible();await axe(page);
});
