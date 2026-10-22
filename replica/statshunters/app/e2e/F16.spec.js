import {test,staged} from './fixtures.js';
test('F16-H1 staged club comparisons surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'clubs');});
