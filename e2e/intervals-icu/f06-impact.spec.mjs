import {test,expect,open,scan} from './helpers.mjs';
test('F06-H1 sport totals and period comparison belong to existing Analysis',async({page},info)=>{
 await open(page,'/analysis?view=totals');await expect(page.getByRole('heading',{name:'Volume by sport'})).toBeVisible();await scan(page,'analysis-totals',info);
 await page.getByRole('button',{name:'Close',exact:true}).click();await expect(page).toHaveURL(/\/analysis$/);
 await page.getByRole('button',{name:'Compare periods',exact:true}).click();await expect(page.getByLabel('Comparison athlete')).toBeVisible();await scan(page,'analysis-periods',info);
 await page.goto('/analysis/load-balance?fitness=1');await expect(page.getByRole('heading',{name:'Fitness and fatigue estimates',level:2})).toBeVisible();await scan(page,'load-fitness-model',info);
});
