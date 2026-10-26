import {test,staged} from './fixtures.js';
test('F13-H1 staged badges surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'badges');});
