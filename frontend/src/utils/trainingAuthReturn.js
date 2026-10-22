import { trainingPlanReturnPath } from './trainingPlanReturnPath';
const key='hermes_training_auth_return';
export function rememberTrainingAuthReturn(value,origin,storage=sessionStorage,now=Date.now()){
  try{const path=trainingPlanReturnPath(value,origin);if(path==='/profile'){storage.removeItem(key);return;}storage.setItem(key,JSON.stringify({path,expires:now+30*60*1000}));}catch{/* Navigation remains available if browser storage is disabled. */}
}
export function consumeTrainingAuthReturn(origin,storage=sessionStorage,now=Date.now()){
  try{const raw=storage.getItem(key);storage.removeItem(key);if(!raw)return null;const saved=JSON.parse(raw);if(typeof saved.expires!=='number'||saved.expires<=now)return null;const path=trainingPlanReturnPath(saved.path,origin);return path==='/profile'?null:path;}catch{return null;}
}
