import {test,staged} from './fixtures.js';
test('F21-H1 staged tile comparison export surface is explicit and accessible',async({page},info)=>{info.annotations.push({type:'scope',description:'Full flow deferred by release plan'});await staged(page,info,'tile-compare');});
