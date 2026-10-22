import { describe, expect, it } from 'vitest';
import { coverage, displaySegment, GRID_SIZE, prepareSegments, project, segmentCells } from '../core/geometry.js';
describe('full-source geometry',()=>{
  it('includes intermediate cells without a sample point inside',()=>{const a={lat:0.001,lon:0.001},b={lat:0.001,lon:.08};expect(segmentCells(a,b).length).toBeGreaterThan(3);});
  it('retains every accepted point above the old 100,000 stride limit',()=>{const points=Array.from({length:100_001},(_,i)=>({lat:40+i*1e-9,lon:-74}));expect(prepareSegments([points]).pointCount).toBe(100_001);});
  it('rejects oversized geometry instead of sampling',()=>{expect(()=>prepareSegments([Array.from({length:200_001},()=>({lat:0,lon:0}))])).toThrow('200,000');});
  it('breaks a gap greater than 10 km',()=>{const s=prepareSegments([[{lat:0,lon:0},{lat:0,lon:.01},{lat:20,lon:20}]]);expect(s.breaks).toBe(1);expect(s.segments.map(s=>s.length)).toEqual([2,1]);expect(coverage(s.segments).distanceKm).toBeLessThan(2);});
  it('handles dateline tracks without a world-spanning route or coverage',()=>{const a={lat:0,lon:179.999},b={lat:0,lon:-179.999};const result=segmentCells(a,b);expect(result.length).toBeLessThan(4);expect(result.some(key=>key.startsWith(`${GRID_SIZE-1}:`))).toBe(true);expect(result.some(key=>key.startsWith('0:'))).toBe(true);expect(Math.abs(displaySegment([a,b])[1][1]-179.999)).toBeLessThan(.01);});
  it('uses a cardinal-free half-open corner convention',()=>{const inverse=(x,y)=>({lon:x/GRID_SIZE*360-180,lat:Math.atan(Math.sinh(Math.PI*(1-2*y/GRID_SIZE)))*180/Math.PI});const a=inverse(8192.25,8192.25),b=inverse(8194.25,8194.25);expect(project(a).x).toBeCloseTo(8192.25);expect(segmentCells(a,b)).toEqual(['8192:8192','8193:8193','8194:8194']);});
  it('separates invalid coordinate records without joining across them',()=>{expect(prepareSegments([[{lat:1,lon:1},{lat:NaN,lon:1},{lat:1.01,lon:1.01}]]).segments.map(s=>s.length)).toEqual([1,1]);});
  it('rejects unsupported polar latitude instead of counting clamped cells',()=>{expect(()=>prepareSegments([[{lat:89,lon:1}]])).toThrow('latitude');});
});
