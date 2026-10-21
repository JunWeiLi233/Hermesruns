import {mkdir} from 'node:fs/promises';
import {resolve} from 'node:path';
import {test,expect,browserLogin,get,scan} from './helpers.mjs';

for(const [width,height] of [[390,844],[1440,900]])test(`DIFF-F03 pace review explains excluded owned evidence ${width}`,async({page,request},info)=>{
  const auth=await browserLogin(page,request,48);await page.setViewportSize({width,height});
  const list=await get(request,auth,'/api/run-plans');const p=list.plans.find(p=>p.state==='ACTIVE');
  const before=await get(request,auth,`/api/run-plans/${p.id}/pace-review`);expect(before.excludedSources.length).toBeGreaterThan(0);
  await page.goto('/training-plan');await page.getByText('Why other linked runs were left out',{exact:true}).click();
  const excluded=before.excludedSources[0];await expect(page.getByRole('link',{name:excluded.name,exact:true})).toHaveAttribute('href',`/runs/${excluded.activityId}`);
  await expect(page.getByText(/This session needs a complete run link/).first()).toBeVisible();
  await scan(page,`pace-eligibility-${width}`,info);
  await page.getByText('Why other linked runs were left out',{exact:true}).scrollIntoViewIfNeeded();
  const dir=resolve(import.meta.dirname,'../../replica/runna/clone-screens/website-extension-diff');await mkdir(dir,{recursive:true});
  await page.screenshot({path:resolve(dir,`S10-exclusions-${width}x${height}.png`),fullPage:false});
  const after=await get(request,auth,`/api/run-plans/${p.id}/pace-review`);
  expect(after).toEqual(before);expect((await get(request,auth,`/api/run-plans/${p.id}`)).revision).toBe(p.revision);
});
