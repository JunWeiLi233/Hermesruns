// Recovery for proposed edits to an active plan. Published inputs stay server-owned.
const unavailable=cause=>Object.assign(new Error('SETUP_STORAGE_UNAVAILABLE',{cause}),{code:'SETUP_STORAGE_UNAVAILABLE'});
async function access(owner, planId, operation, value) {
  const db=await new Promise((resolve,reject)=>{
    const request=indexedDB.open('hermes-plan-setups',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('edits',{keyPath:'key'});
    request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
  }).catch(error=>{throw unavailable(error);});
  try {
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction('edits',operation==='get'?'readonly':'readwrite');const store=tx.objectStore('edits');
      const key=`${owner}:${planId}`;
      const request=operation==='put'?store.put({key,owner:String(owner),planId,origin:location.origin,...value}):operation==='delete'?store.delete(key):store.get(key);
      let result;request.onsuccess=()=>{result=request.result;};tx.oncomplete=()=>resolve(result);tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(tx.error);
    });
  } catch(error) { throw unavailable(error); }
  finally {db.close();}
}
export async function readSetupEdit(owner,planId) {
  const item=await access(owner,planId,'get');
  return item?.owner===String(owner)&&item?.origin===location.origin&&item?.planId===planId?item:null;
}
export const saveSetupEdit=(owner,planId,value)=>access(owner,planId,'put',value);
export const clearSetupEdit=(owner,planId)=>access(owner,planId,'delete');
