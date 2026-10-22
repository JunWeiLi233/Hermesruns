import { planRequest } from './planApi';
export const MANUAL_RUN_CHANGED='hermes-manual-run-changed';
const changed=owner=>window.dispatchEvent(new CustomEvent(MANUAL_RUN_CHANGED,{detail:{owner:String(owner)}}));

function database() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('hermes-manual-runs', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('pending', { keyPath: 'owner' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function access(owner, action, value) {
  const db = await database();
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction('pending', action === 'get' ? 'readonly' : 'readwrite');
      const store = tx.objectStore('pending');
      const request = action === 'put' ? store.put(value) : action === 'delete' ? store.delete(String(owner)) : store.get(String(owner));
      let result; request.onsuccess = () => { result = request.result; };
      tx.oncomplete = () => {if(action!=='get')changed(owner);resolve(result);}; tx.onerror = () => reject(tx.error); tx.onabort = () => reject(tx.error);
    });
  } finally { db.close(); }
}
export const pendingRun = owner => access(owner, 'get');
export const discardPendingRun = owner => access(owner, 'delete');
async function enqueue(item) {
  const db = await database();
  try {
    await new Promise((resolve,reject) => {
      const tx=db.transaction('pending','readwrite');const store=tx.objectStore('pending');
      const read=store.get(item.owner);let conflict=false;
      read.onsuccess=()=>{if(read.result){conflict=true;tx.abort();}else store.add(item);};
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);tx.onabort=()=>reject(conflict?Object.assign(new Error('PENDING_RUN_EXISTS'),{code:'PENDING_RUN_EXISTS'}):tx.error);
    });
  } finally {db.close();}
}
export async function queueManualRun(owner, payload, linkIntent) {
  if (await pendingRun(owner)) throw Object.assign(new Error('PENDING_RUN_EXISTS'), { code: 'PENDING_RUN_EXISTS' });
  const body = { ...payload, clientKey: crypto.randomUUID() };
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(body)))), b => b.toString(16).padStart(2, '0')).join('');
  const item = { owner: String(owner), origin: location.origin, body, hash, linkIntent, saved: null };
  await enqueue(item); changed(owner); return item;
}
export async function savePendingRun(owner) {
  const item = await pendingRun(owner);
  if (!item || item.owner !== String(owner) || item.origin !== location.origin) throw new Error('NO_PENDING_RUN');
  const hash = Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(item.body)))), b => b.toString(16).padStart(2, '0')).join('');
  if (hash !== item.hash) throw new Error('PENDING_RUN_CHANGED');
  // Never replay creation to fix a link. Receipt replay handles a lost save response.
  if (!item.saved) {
    item.saved = await planRequest('/api/manual-runs', { method: 'POST', body: item.body });
    await access(owner, 'put', item);
  }
  return item;
}
