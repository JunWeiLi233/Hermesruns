import {renderHeatJob} from './workoutHeatJob';
let parts=[];
self.onmessage=async({data:{revision,job}})=>{
  try {
    if(job.parts!==undefined)parts=job.parts;
    const tiles=await renderHeatJob({...job,parts});
    self.postMessage({revision,tiles},tiles.map(tile=>tile.data.buffer));
  }catch{self.postMessage({revision,error:true});}
};
