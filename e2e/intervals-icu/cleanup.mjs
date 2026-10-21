// Delete only the exact synthetic accounts created by provision.ps1 for this QA run.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve,sep} from 'node:path';
const run=resolve(process.env.HERMES_TRAINING_QA_RUN||'');
const privateRoot=resolve(import.meta.dirname,'../../.private-backups')+sep;
if(!run.toLowerCase().startsWith(privateRoot.toLowerCase()))throw Error('Protected fixture path required.');
const fixture=JSON.parse(readFileSync(resolve(run,'actors.json'),'utf8').replace(/^\uFEFF/,''));
if(fixture.baseURL!=='http://localhost:8080'||!/^[a-f0-9]{32}$/.test(fixture.tag))throw Error('Unexpected QA fixture.');
const results=[];
for(const role of ['athlete','member','coach','follower','outsider']){
 const actor=fixture.actors[role];
 if(actor.email!==`qa-training-${fixture.tag}-${role}@example.test`)throw Error('Synthetic identity mismatch.');
 const headers={Authorization:`Bearer ${actor.token}`,'Content-Type':'application/json'};
 const identity=await fetch(`${fixture.baseURL}/api/profile/me`,{headers});
 if(identity.status!==200||(await identity.json()).email!==actor.email)throw Error(`Identity check failed for QA ${role}; no deletion attempted.`);
 const response=await fetch(`${fixture.baseURL}/api/training/me`,{method:'DELETE',headers,body:JSON.stringify({confirmation:'DELETE'})});
 if(response.status!==200||(await response.json()).deleted!==true)throw Error(`QA ${role} cleanup failed.`);
 results.push({role,deleted:true});
}
writeFileSync(resolve(run,'cleanup-api-results.json'),JSON.stringify(results,null,2));
console.log(JSON.stringify({syntheticAccountsDeleted:results.length}));
