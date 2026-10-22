import { describe, expect, it } from 'vitest';
import { civilDate, EMPTY_FILTER, filterErrors, matches, selectActivities, sortActivities, statistics, totals } from '../core/model.js';
import { seedActivities } from '../core/seed.js';
describe('shared query rules',()=>{
  const rows=seedActivities();
  it('includes both calendar endpoints in the account zone',()=>{expect(selectActivities(rows,{...EMPTY_FILTER,start:'2026-10-14',end:'2026-10-16'},'America/New_York').map(a=>a.id)).toEqual([2,3]);});
  it('keeps repeated DST hour instants on the same calendar day',()=>{expect(civilDate('2026-11-01T05:30:00Z','America/New_York')).toBe('2026-11-01');expect(civilDate('2026-11-01T06:30:00Z','America/New_York')).toBe('2026-11-01');});
  it('does not reinterpret UTC instants as local timestamps',()=>{expect(civilDate('2026-10-18T02:00:00Z','America/New_York')).toBe('2026-10-17');expect(civilDate('2026-10-18T02:00:00Z','Asia/Shanghai')).toBe('2026-10-18');});
  it('combines categories with AND and excludes unknown bounded metrics',()=>{const row={...rows[0],distanceKm:null,commute:null};expect(matches(row,EMPTY_FILTER,'UTC')).toBe(true);expect(matches(row,{...EMPTY_FILTER,min:'0'},'UTC')).toBe(false);expect(matches(row,{...EMPTY_FILTER,commute:'no'},'UTC')).toBe(false);});
  it('retains a known zero while sorting missing values last both ways',()=>{const data=[{id:1,distanceKm:null},{id:2,distanceKm:0},{id:3,distanceKm:9}];expect(sortActivities(data,'distanceKm',false).map(a=>a.id)).toEqual([2,3,1]);expect(sortActivities(data,'distanceKm',true).map(a=>a.id)).toEqual([3,2,1]);});
  it('uses normalized kilometre thresholds for imperial criteria',()=>{const row={...rows[0],distanceKm:1.609344};expect(matches(row,{...EMPTY_FILTER,min:String(1*1.609344),max:String(1*1.609344)},'UTC')).toBe(true);});
  it('rejects malformed, impossible, inverted and negative ranges without throwing',()=>{for(const f of [{start:'2026-99-99'},{start:'2026-02-31'},{start:'2026-10-19',end:'2026-10-18'},{min:'4',max:'3'},{minMinutes:'-1'}])expect(Object.keys(filterErrors({...EMPTY_FILTER,...f})).length).toBeGreaterThan(0);});
  it('includes no-GPS summaries but no invented cells',()=>{const indoor=rows.filter(a=>!a.pointCount);expect(totals(indoor).distanceKm).toBeCloseTo(6.3);expect(totals(indoor).gps).toBe(0);expect(indoor.every(a=>!a.cells.length)).toBe(true);});
  it('does not turn all-unknown metrics into zero',()=>{expect(totals([{distanceKm:null,movingSeconds:null,ascentM:null,segments:[]}]).distanceKm).toBeNull();});
  it('aggregates rolling periods by calendar day and maintains cumulative ordering',()=>{const s=statistics(rows,'America/New_York',new Date('2026-10-18T20:00:00Z'));expect(s.toDate[0].count).toBe(7);expect(s.rolling[0].count).toBe(4);expect(s.cumulative.at(-1).distanceKm).toBeCloseTo(s.totals.distanceKm);expect(s.records.distance.id).toBe(2);});
});
