import {test,expect,map,browse,axe,pickRoute,display,close} from './support.mjs';
async function pickShared(page,isMobile){
 if(await map(page).getAttribute('data-render-mode')!=='heat'){await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();await close(page);}
 await expect(map(page)).toHaveAttribute('data-heat-state','ready');await pickRoute(page,isMobile);
}

test('HM-HC-002 stale continuation paints no partial cells and the same action recovers',async({page,app,isMobile})=>{
 app.coverageCells=Array.from({length:501},(_,i)=>[4800+i,6150]);await pickShared(page,isMobile);await expect(page.getByRole('dialog')).toContainText('501 / 501');
 app.coveragePageSnapshot='retired';await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();
 await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeEnabled();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(page.getByRole('dialog')).toBeVisible();
 app.coveragePageSnapshot=null;await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','501');
 await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(map(page)).toHaveAttribute('data-render-mode','heat');await axe(page);
});

test('F04-CV-H1 retained precision and completed pace seconds share the same base',async({page,app})=>{
 app.workoutOverrides={1:{distanceKm:5.0055,movingSeconds:1992}};
 await browse(page);await page.getByRole('button',{name:/Élan/}).click();const popup=page.getByRole('dialog');
 await expect(popup).toContainText('5.01 km');await expect(popup).toContainText('9.05 km/h');await expect(popup).toContainText('6:37 /km');await expect(popup).toContainText('Stored watch');await expect(popup).toContainText('Trail shoes');await expect(popup).toContainText('Test shoes');await expect(popup).toContainText('3 / 2');await axe(page);
});

test('F04-CV-E5 miles use the same retained distance and completed pace seconds',async({page,app})=>{
 app.workoutOverrides={1:{distanceKm:1.609344*359/359.9,movingSeconds:359}};app.units='imperial';await page.reload();await expect(page.getByRole('button',{name:'Zoom in',exact:true})).toBeEnabled();
 await browse(page);await page.getByRole('button',{name:/Élan/}).click();const popup=page.getByRole('dialog');await expect(popup).toContainText('1 mi');await expect(popup).toContainText('5:59 /mi');await expect(popup).toContainText('10 mi/h');await expect(popup).toContainText('3 / 2');await axe(page);
});

test('F04-CV-E1 repeated and no-GPS workouts never advertise false new coverage',async({page,app,isMobile})=>{
 await pickShared(page,isMobile);await page.getByLabel('Overlapping workouts').selectOption('2');await expect(page.getByRole('dialog')).toContainText('3 / 0');await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();await expect(page.getByRole('button',{name:'Highlight route',exact:true})).toBeEnabled();await axe(page);await close(page);
 await browse(page);await page.getByRole('button',{name:'Load more',exact:true}).click();await page.getByRole('button',{name:/Indoor session/}).click();await expect(page.getByRole('dialog')).toContainText('— / —');await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();await axe(page);
});

test('F04-CV-E2 a late coverage reply cannot replace a different overlapping workout',async({page,app,isMobile})=>{
 const release=app.holdCoverage(1);await pickShared(page,isMobile);await expect(page.getByRole('heading',{name:/Élan/})).toBeVisible();await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();
 await page.getByLabel('Overlapping workouts').selectOption('2');await expect(page.getByRole('dialog')).toContainText('3 / 0');release();await expect(page.getByRole('heading',{name:'Loop 2',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await axe(page);
});

test('F04-CV-E3 paged highlight has one active action and cannot repaint after close',async({page,app,isMobile})=>{
 app.coverageCells=Array.from({length:501},(_,i)=>[4800+i,6150]);const release=app.holdCoveragePage();await pickShared(page,isMobile);await expect(page.getByRole('dialog')).toContainText('501 / 501');
 await page.getByRole('button',{name:'Highlight new coverage',exact:true}).dblclick();await expect(page.getByRole('button',{name:'Highlight new coverage',exact:true})).toBeDisabled();expect(app.trackCalls).toBe(1);await close(page);release();
 await display(page);await expect(page.getByRole('region',{name:'Display',exact:true})).toBeVisible();await expect(page.getByRole('dialog')).toHaveCount(0);await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await axe(page);await close(page);
 await pickShared(page,isMobile);await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','501');await page.getByRole('button',{name:'Show all routes',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);
});

test('F04-CV-H2/E7 coverage is independent of filter scope and highlight is transient on refresh',async({page,app})=>{
 await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('dialog')).toContainText('3 / 2');await close(page);await browse(page);
 await page.getByLabel('Workout name',{exact:true}).fill('Élan');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();await close(page);await browse(page);await page.getByRole('button',{name:/Élan/}).click();await expect(page.getByRole('dialog')).toContainText('3 / 2');await page.getByRole('button',{name:'Highlight new coverage',exact:true}).click();await expect(map(page)).toHaveAttribute('data-new-tile-cells','2');
 await page.reload();await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();await expect(map(page)).toHaveAttribute('data-new-tile-cells','0');await expect(page.getByRole('dialog')).toHaveCount(0);await axe(page);
});
