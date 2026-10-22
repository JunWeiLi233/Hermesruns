import {test,expect,map,display,close,pickRoute,axe} from './support.mjs';

for(const mode of ['lines','heat'])test(`load once: ${mode} keeps zoom, pan and picking local after the server becomes unavailable`,async({page,app,isMobile},info)=>{
 if(mode==='heat'){await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);await expect(map(page)).toHaveAttribute('data-heat-state','ready');}
 await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await expect(map(page)).toHaveAttribute('data-route-parts','65');
 const reads=app.geometryRequests.length;expect(app.geometryRequests.every(q=>q.zoom===20&&!('bbox' in q))).toBe(true);
 app.geometryStatus=503;
 for(const delta of [-1,-1,1,1,1,-1]){const zoom=Number(await map(page).getAttribute('data-render-zoom'));await page.getByRole('button',{name:delta>0?'Zoom in':'Zoom out',exact:true}).click();await expect(map(page)).toHaveAttribute('data-render-zoom',String(zoom+delta));}
 await map(page).press('ArrowRight');await map(page).press('ArrowLeft');await page.getByRole('button',{name:'Show all matching routes',exact:true}).click();
 // Exceed the former 150ms network debounce: zoom must never schedule a read.
 await page.waitForTimeout(350);expect(app.geometryRequests).toHaveLength(reads);
 await expect(page.getByRole('alert')).toHaveCount(0);await expect(page.getByRole('status').filter({hasText:'Loading routes'})).toHaveCount(0);await expect(map(page)).toHaveAttribute('data-route-parts','65');
 if(mode==='heat')await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 await pickRoute(page,isMobile);await expect(page.getByRole('dialog')).toBeVisible();await axe(page);await close(page);
 await page.screenshot({path:info.outputPath(`loaded-${mode}-after-zoom.png`)});
});


test('display choices reuse the loaded route set and keep workout snapshots valid',async({page,app})=>{
 const reads=app.geometryRequests.length;await display(page);
 for(const name of ['Route heat','Activity lines']){await page.getByRole('radio',{name,exact:true}).check();await expect(page.getByRole('radio',{name,exact:true})).toBeEnabled();}
 await page.getByRole('button',{name:'Activity color #a0392a',exact:true}).click();await expect(page.getByRole('button',{name:'Activity color #a0392a',exact:true})).toBeEnabled();
 await page.getByRole('radio',{name:'Dark map',exact:true}).check();await expect(page.getByRole('radio',{name:'Dark map',exact:true})).toBeEnabled();
 await close(page);expect(app.geometryRequests).toHaveLength(reads);await expect(map(page)).toHaveAttribute('data-route-parts','65');
 await page.getByRole('button',{name:'Filters',exact:true}).click();await page.getByText('Browse matching workouts',{exact:true}).click();await page.getByRole('button',{name:/Élan/}).click();
 await expect(page.getByRole('dialog')).toContainText('3 / 2');await axe(page);
});
