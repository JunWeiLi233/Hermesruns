import {test,expect,login,open,fixture,screen} from './fixtures.js';
test('F01-H1 independent file import from an empty workspace persists after refresh',async({page},info)=>{
  await login(page);await expect(page.getByRole('heading',{name:'A map made of your own days outside'})).toBeVisible();await screen(page,info,'empty-map');
  await page.getByRole('button',{name:'Add activity files',exact:true}).first().click();await screen(page,info,'import-dialog');
  await page.getByLabel('FIT, GPX or TCX activity files').setInputFiles('../public/examples/independent-loop.gpx');await page.getByRole('checkbox',{name:'I have permission to store and analyze these independently sourced activity files.'}).check();
  await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(page.getByRole('heading',{name:'From file to familiar ground.'})).toBeVisible();await fixture(page.request,'tick');await expect(page.getByText('complete',{exact:true}).first()).toBeVisible();await screen(page,info,'complete-job');
  await open(page,'map');await expect(page.getByRole('heading',{name:'Places become familiar.'})).toBeVisible();await page.reload();await expect(page.getByRole('link',{name:'Sunday reservoir circuit',exact:true}).first()).toBeVisible();await screen(page,info,'imported-map');
});
test('F01-E1 empty import never creates a job',async({page},info)=>{await login(page);await page.getByRole('button',{name:'Add activity files',exact:true}).first().click();await page.getByRole('button',{name:'Import files',exact:true}).click();await expect(page.getByText('Choose at least one activity file.')).toBeVisible();await screen(page,info,'empty-file-validation');});
