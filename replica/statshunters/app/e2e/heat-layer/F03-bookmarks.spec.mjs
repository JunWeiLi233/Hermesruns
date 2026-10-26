import {test,expect,filters,axe} from './support.mjs';
test('F03-HM-H1 bookmark reload and unsaved drawer draft remain separate',async({page,app})=>{
 await filters(page);await page.getByLabel('Workout name',{exact:true}).fill('Élan');await page.getByLabel('Workout name',{exact:true}).press('Enter');await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();expect(new URL(page.url()).searchParams.get('q')).toBe('Élan');await page.reload();await expect(page.getByText('1 workouts · 5 km',{exact:true})).toBeVisible();await filters(page);await page.getByLabel('Workout name',{exact:true}).fill('unsaved draft');await page.keyboard.press('Escape');await filters(page);await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue('Élan');await axe(page);
});
