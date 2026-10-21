import {test,staged} from './fixtures.js';
test('F08-H1 staged public sharing surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'shares');});
