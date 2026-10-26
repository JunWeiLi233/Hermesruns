import {test,expect,open,scan} from './helpers.mjs';
test('F02-H1 connections stay in the existing Settings tab',async({page},info)=>{
 await open(page,'/training/connections');await expect(page).toHaveURL(/\/settings\?section=connections/);await expect(page.getByText('Strava',{exact:true}).first()).toBeVisible();await scan(page,'connections',info);
});
