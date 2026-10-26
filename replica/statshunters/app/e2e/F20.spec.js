import {test,staged} from './fixtures.js';
test('F20-H1 staged provider description writes surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'provider-description');});
