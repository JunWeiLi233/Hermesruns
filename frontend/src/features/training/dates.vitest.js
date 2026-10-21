import { afterEach, expect, it } from 'vitest';
import { currentDate, setAccountZone, weekStart } from './data/dates.mjs';
afterEach(()=>setAccountZone('UTC'));
it('opens the account civil week across a UTC midnight boundary',()=>{
  const time=new Date('2026-10-12T01:00:00Z');setAccountZone('America/Los_Angeles');
  expect(currentDate(time)).toBe('2026-10-11');expect(weekStart(time)).toBe('2026-10-05');
  setAccountZone('UTC');expect(weekStart(time)).toBe('2026-10-12');
});
