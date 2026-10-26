import {test,expect,filters,axe} from './support.mjs';
test('F02-M-E1 explicit civil date bounds survive Apply and refresh',async({page,app})=>{
 await filters(page);await page.getByLabel('From date',{exact:true}).fill('2026-10-19');await page.getByLabel('Through date',{exact:true}).fill('2026-10-19');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page).toHaveURL(/from=2026-10-19/);expect(new URL(page.url()).searchParams.get('to')).toBe('2026-10-19');await page.reload();await filters(page);await expect(page.getByLabel('From date',{exact:true})).toHaveValue('2026-10-19');await expect(page.getByLabel('Through date',{exact:true})).toHaveValue('2026-10-19');await axe(page);
});
test('P5 date shortcuts and collapsed advanced metrics preserve the simple map',async({page,app},info)=>{
 await page.screenshot({path:info.outputPath('S02-default-map.png')});await filters(page);const advanced=page.getByText('Advanced filters',{exact:true});await expect(advanced.locator('..')).not.toHaveAttribute('open','');
 await page.getByRole('group',{name:'Dates',exact:true}).getByRole('button',{name:'Past 30 days',exact:true}).click();
 const from=await page.getByLabel('From date',{exact:true}).inputValue(),to=await page.getByLabel('Through date',{exact:true}).inputValue();expect((Date.parse(to)-Date.parse(from))/86400000).toBe(29);
 await page.getByRole('group',{name:'Dates',exact:true}).getByRole('button',{name:'All dates',exact:true}).click();await advanced.click();
 await page.getByLabel('Minimum elevation gain (m)',{exact:true}).fill('0');await page.getByLabel('Minimum average heart rate (bpm)',{exact:true}).fill('150');
 await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByText('65 workouts · 325 km',{exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get('minAscentM')).toBe('0');
 await page.screenshot({path:info.outputPath('S03-advanced-filters.png')});await axe(page);
 await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();
});
test('P3 source sport, equipment and unknown gear use the same filtered workout list',async({page,app})=>{
 await filters(page);await page.getByLabel('Gear',{exact:true}).selectOption('source:Trail shoes');await page.getByText('Advanced filters',{exact:true}).click();
 await page.getByLabel('Source sport',{exact:true}).selectOption('TrailRun');await page.getByLabel('Indoor trainer',{exact:true}).selectOption('yes');await page.getByRole('button',{name:'Apply',exact:true}).click();
 await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();await page.getByText('Browse matching workouts',{exact:true}).click();await page.getByRole('button',{name:/Élan/}).click();
 await expect(page.getByRole('dialog')).toContainText('Stored watch');await expect(page.getByRole('dialog')).toContainText('Trail shoes');await axe(page);await page.keyboard.press('Escape');
 await filters(page);await page.getByRole('button',{name:'Clear filters',exact:true}).click();await page.getByLabel('Gear',{exact:true}).selectOption('UNKNOWN');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByText('1 workouts · 8 km',{exact:true})).toBeVisible();
});
test('F02-HM-H1/E1 Unicode, metric combinations and zero results',async({page,app})=>{
 await filters(page);await page.getByLabel('Workout name',{exact:true}).fill('Élan 🏃');await page.getByLabel('Workout name',{exact:true}).press('Enter');await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();await page.getByLabel('Minimum distance (km)',{exact:true}).fill('6');await page.getByRole('button',{name:'Apply',exact:true}).click();await expect(page.getByText('0 workouts · 0 km',{exact:true})).toBeVisible();await expect(page.getByText('No matching workouts. Clear or adjust the filters.')).toBeVisible();await page.getByRole('button',{name:'Clear filters',exact:true}).click();await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);
});
test('F02-HM-E2 invalid ranges block Apply without changing the applied query',async({page,app})=>{
 await filters(page);await page.getByLabel('Minimum distance (km)',{exact:true}).fill('8');await page.getByLabel('Maximum distance (km)',{exact:true}).fill('3');await expect(page.getByRole('button',{name:'Apply',exact:true})).toBeDisabled();await expect(page.getByRole('alert')).toContainText('The end of each range');await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await axe(page);
});
test('HM-N1 expired map session goes to sign-in without stale route data',async({page,app})=>{
 app.expected401=true;app.expire=true;await page.reload();await expect(page).toHaveURL(/\/login/);await expect(page.getByRole('region',{name:/^Workout map/})).toHaveCount(0);expect(await page.evaluate(()=>localStorage.getItem('hermes_jwt'))).toBeNull();
});
