import {test,staged} from './fixtures.js';
test('F23-H1 staged gear costs and maintenance surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'gear');});
