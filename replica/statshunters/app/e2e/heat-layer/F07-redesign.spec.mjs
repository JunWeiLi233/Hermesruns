import {test,expect,filters,display,close,axe,map} from './support.mjs';

test('reference summary collapses without reloading routes and quick dates preserve URL filters',async({page,app},info)=>{
 await expect(page.getByRole('heading',{name:'Heatmap',exact:true})).toBeVisible();
 await page.screenshot({path:info.outputPath('01-summary.png')});
 const zoom=await map(page).getAttribute('data-render-zoom');
 await page.getByRole('button',{name:'Collapse summary',exact:true}).click();
 await expect(page.getByRole('button',{name:'Show heatmap summary and filters',exact:true})).toBeFocused();
 await expect(map(page)).toHaveAttribute('data-route-parts','65');await expect(map(page)).toHaveAttribute('data-render-zoom',zoom);
 await page.screenshot({path:info.outputPath('02-collapsed.png')});await axe(page);
 await page.getByRole('button',{name:'Show heatmap summary and filters',exact:true}).click();
 await filters(page);await page.getByLabel('Workout name',{exact:true}).fill('Élan');await page.getByRole('button',{name:'Apply',exact:true}).click();await close(page);
 await page.getByRole('group',{name:'Quick dates',exact:true}).getByRole('button',{name:'Year to date',exact:true}).click();
 await expect(page).toHaveURL(/q=/);expect(new URL(page.url()).searchParams.get('from')).toMatch(/-01-01$/);
 await page.reload();await expect(page.getByRole('button',{name:'Year to date',exact:true})).toHaveAttribute('aria-pressed','true');
 await filters(page);await expect(page.getByLabel('Workout name',{exact:true})).toHaveValue('Élan');await axe(page);
});

test('filter and display panels keep actions reachable at narrow widths',async({page,app},info)=>{
 await filters(page);const panel=page.getByRole('region',{name:'Filters',exact:true});
 await expect(panel.getByRole('button',{name:'Apply',exact:true})).toBeInViewport();
 await page.screenshot({path:info.outputPath('03-filters.png')});await axe(page);
 await panel.getByRole('button',{name:'Unclassified',exact:true}).click();await panel.getByRole('button',{name:'Apply',exact:true}).click();await expect(page).toHaveURL(/sport=UNKNOWN/);
 await panel.getByRole('button',{name:'Clear filters',exact:true}).click();await close(page);
 await display(page);await page.getByRole('radio',{name:'Route heat',exact:true}).check();await expect(page.getByRole('radio',{name:'Route heat',exact:true})).toBeEnabled();
 await expect(page.getByRole('status').filter({hasText:'Saved to your account'})).toBeVisible();expect(app.patches.at(-1)).toEqual({mode:'heat'});
 await expect(page.getByText('66 workouts · 333 km',{exact:true})).toBeVisible();await expect(map(page)).toHaveAttribute('data-heat-state','ready');
 await page.screenshot({path:info.outputPath('04-display.png')});await axe(page);
 await page.getByRole('radio',{name:'Activity lines',exact:true}).focus();await page.keyboard.press('Space');await expect(map(page)).toHaveAttribute('data-render-mode','lines');
 await page.keyboard.press('Escape');await expect(page.getByRole('button',{name:'Display',exact:true})).toBeFocused();
 await page.setViewportSize({width:320,height:640});await filters(page);await expect(page.getByRole('button',{name:'Apply',exact:true})).toBeInViewport();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await axe(page);
 await page.screenshot({path:info.outputPath('05-narrow-filters.png')});
});
