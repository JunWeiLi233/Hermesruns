import { afterEach, expect, it } from 'vitest';
import { rememberTrainingAuthReturn, consumeTrainingAuthReturn } from './trainingAuthReturn';
afterEach(()=>sessionStorage.clear());
it('restores a same-origin training deep link once after an OAuth navigation',()=>{
  rememberTrainingAuthReturn('/training/activity?id=session-1','https://hermes.test',sessionStorage,100);
  expect(consumeTrainingAuthReturn('https://hermes.test',sessionStorage,101)).toBe('/training/activity?id=session-1');
  expect(consumeTrainingAuthReturn('https://hermes.test',sessionStorage,102)).toBeNull();
});
it('discards external destinations and expired handoffs',()=>{
  rememberTrainingAuthReturn('https://other.test/training/team','https://hermes.test');expect(consumeTrainingAuthReturn('https://hermes.test')).toBeNull();
  rememberTrainingAuthReturn('/training/team','https://hermes.test',sessionStorage,100);expect(consumeTrainingAuthReturn('https://hermes.test',sessionStorage,1800101)).toBeNull();
});
