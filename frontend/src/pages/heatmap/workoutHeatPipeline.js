import {renderHeatJob} from './workoutHeatJob';

export function createHeatPipeline(onResult,onError) {
  let worker=null,workerParts=null,dead=false,busy=false,pending=null,current=null,revision=0;
  const yieldControl=()=>new Promise(resolve=>setTimeout(resolve,0));
  const finish=(id,tiles,error=false)=>{
    busy=false;
    if(!dead&&id===revision){if(error)onError();else onResult(tiles,worker?'worker':'cooperative');}
    if(!dead&&pending)start();
  };
  const fallback=({id,job})=>renderHeatJob(job,yieldControl).then(tiles=>finish(id,tiles)).catch(()=>finish(id,null,true));
  function start(){
    current=pending;pending=null;busy=true;
    if(worker){
      const {parts,...view}=current.job;
      worker.postMessage({revision:current.id,job:parts===workerParts?view:current.job});workerParts=parts;
    }else void fallback(current);
  }
  try {
    worker=new Worker(new URL('./workoutHeat.worker.js',import.meta.url),{type:'module'});
    worker.onmessage=({data})=>finish(data.revision,data.tiles,data.error);
    worker.onerror=event=>{event.preventDefault();worker.terminate();worker=null;if(current)void fallback(current);};
  }catch{worker=null;}
  return {
    render(job){pending={id:++revision,job};if(!busy)start();},
    cancel(){revision++;pending=null;},
    destroy(){dead=true;revision++;pending=null;worker?.terminate();},
  };
}
