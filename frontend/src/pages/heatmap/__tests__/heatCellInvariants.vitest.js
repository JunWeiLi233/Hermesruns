import {expect,it} from 'vitest';
import {buildHeatCoverage} from '../workoutMapModel';
import {projectHeatCoordinate} from '../workoutHeatJob';

const part=coordinates=>({activityId:1,segmentId:0,coordinates});
const project=([x,y])=>({x,y});
const cells=coordinates=>[...buildHeatCoverage([part(coordinates)],project,[-5,-5,105,105])].map(([key])=>key).sort();

it('equivalent diagonal input preserves heat cells when direction or sampling changes',()=>{
 for(const [a,b] of [[[.2,.2],[100.8,100.8]],[[.1,.7],[99.7,76.3]],[[100.8,.2],[.2,100.8]]]){
  const middle=a.map((v,i)=>v+(b[i]-v)/3);
  expect(cells([b,a])).toEqual(cells([a,b]));
  expect(cells([a,middle,b])).toEqual(cells([a,b]));
 }
});
it.each([9,12,15])('preserves diagonal coverage at world-pixel magnitudes for zoom %s',zoom=>{
 const origin=projectHeatCoordinate([40.7,-73.9],zoom),x=Math.floor(origin.x),y=Math.floor(origin.y);
 const a=[x+100.8,y+.2],b=[x+.2,y+100.8],middle=a.map((v,i)=>v+(b[i]-v)/3),bounds=[x-5,y-5,x+105,y+105];
 const coverage=coordinates=>[...buildHeatCoverage([part(coordinates)],project,bounds)].map(([key])=>key).sort();
 expect(coverage([b,a])).toEqual(coverage([a,b]));expect(coverage([a,middle,b])).toEqual(coverage([a,b]));
});
