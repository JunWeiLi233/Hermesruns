import { coverage } from './geometry.js';
// Independently invented coordinates and history. Never reads recon screenshots/data.
export function seedActivities() {
  const examples=[['Morning park circuit','run',6.4,2280,42,'Daily shoes',18],['Towpath afternoon','ride',24.8,4440,126,'Road bike',16],['A walk between meetings','walk',3.2,2460,18,null,14],['Indoor steady effort','run',5.1,1800,null,'Daily shoes',12],['Long woodland ramble past the old reservoir and the north meadow','hike',8.7,3360,164,'Trail shoes',9],['Meadow roads','ride',17.2,3240,82,'Road bike',4],['Pool intervals','swim',1.2,2400,null,null,2],['September sunset','run',7.8,2820,29,'Daily shoes',25]];
  return examples.map(([name,sport,distanceKm,movingSeconds,ascentM,gear,day],i)=>{
    const indoor=i===3||i===6;const month=i===7?'09':'10';
    const centers=[[40.78,-73.97],[40.80,-73.94],[40.76,-73.99],[0,0],[40.84,-73.96],[40.80,-73.90],[0,0],[40.75,-73.96]];
    const segments=indoor?[]:[Array.from({length:65},(_,j)=>{const t=j/64*Math.PI*2;return {lat:centers[i][0]+Math.sin(t)*(sport==='ride'?.018:.009),lon:centers[i][1]+Math.cos(t)*(sport==='ride'?.028:.008)+Math.sin(t*3)*.003,time:new Date(Date.UTC(2026,Number(month)-1,day,12,Math.floor(j/64*movingSeconds/60))).toISOString(),ele:20+Math.sin(t)*5};})];
    return {id:i+1,name,startTime:`2026-${month}-${String(day).padStart(2,'0')}T12:00:00Z`,sport,subtype:i===6?'workout':'regular',commute:i===2,trainer:indoor,gear,distanceKm,movingSeconds,elapsedSeconds:movingSeconds+120,ascentM,averageHr:i%3===0?142:null,segments,cells:coverage(segments).cells,pointCount:segments.reduce((n,s)=>n+s.length,0),quality:{precision:'synthetic',breaks:0,movingTimeEstimated:false,gridVersion:'mercator-z14-halfopen-v1'},source:{classification:'synthetic',format:'Invented example'}};
  });
}
