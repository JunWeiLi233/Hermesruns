import { DEFAULT_PREFS, EMPTY_FILTER } from './model.js';
export const freshWorkspace = () => ({version:1,revision:0,activities:[],jobs:[],preferences:{...DEFAULT_PREFS},filter:{...EMPTY_FILTER},opened:false,receipt:null,nextId:1});
const DB_NAME='hermes-explorer-local-v1';
export function indexedStore() {
  let promise;
  const open=()=>promise??=new Promise((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{request.result.createObjectStore('workspace');request.result.createObjectStore('assets');};
    request.onsuccess=()=>{const db=request.result;db.onversionchange=()=>db.close();resolve(db);};
    request.onerror=()=>reject(new Error('Browser storage is unavailable. Allow storage for this site and try again.'));
    request.onblocked=()=>reject(new Error('Close the other Explorer tabs, then reload this page.'));
  });
  return {
    async load(){const db=await open();return new Promise((resolve,reject)=>{const tx=db.transaction('workspace');const req=tx.objectStore('workspace').get('current');req.onsuccess=()=>resolve(req.result||freshWorkspace());req.onerror=()=>reject(new Error('Saved history could not be read.'));});},
    async save(value,{asset,clear=false}={}){const db=await open();return new Promise((resolve,reject)=>{
      const tx=db.transaction(['workspace','assets'],'readwrite');tx.objectStore('workspace').put(value,'current');
      if(clear)tx.objectStore('assets').clear();if(asset)tx.objectStore('assets').put(asset.file,asset.hash);
      tx.oncomplete=resolve;tx.onerror=()=>reject(new Error('History could not be saved. Browser storage may be full. No new result was committed.'));tx.onabort=()=>reject(new Error('Saving was interrupted. Try again.'));
    });},
  };
}
// Tests use the same transactional interface without requiring a browser database.
export function memoryStore(initial=freshWorkspace()) {
  let value=structuredClone(initial);const assets=new Map();
  return {async load(){return structuredClone(value);},async save(next,{asset,clear=false}={}){value=structuredClone(next);if(clear)assets.clear();if(asset)assets.set(asset.hash,asset.file);},assets};
}
