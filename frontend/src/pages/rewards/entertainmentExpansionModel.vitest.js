import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

async function model() {
  expect(existsSync(resolve(dirname(fileURLToPath(import.meta.url)), 'entertainmentExpansionModel.js')), 'expansion model exists').toBe(true);
  const path = './entertainmentExpansionModel.js';
  return import(/* @vite-ignore */ path);
}

it('offers exactly three free accessories and two backgrounds without activity prerequisites', async () => {
  const { ACCESSORIES, BACKGROUNDS } = await model();
  expect(ACCESSORIES).toHaveLength(3);
  expect(new Set(ACCESSORIES).size).toBe(3);
  expect(ACCESSORIES).toEqual(['scarf', 'cap', 'satchel']);
  expect(BACKGROUNDS).toHaveLength(2);
  expect(BACKGROUNDS).toEqual(['meadow', 'night']);
});

it('validates bounded text while preserving literal dates including leap day', async () => {
  const { memoryError } = await model();
  expect(memoryError({ title: 'Quiet day', body: 'A small moment.', date: '2024-02-29' })).toBe(null);
  expect(memoryError({ title: 'a'.repeat(81), body: '', date: '' })).toBe('title');
  expect(memoryError({ title: 'A', body: 'a'.repeat(1001), date: '' })).toBe('body');
  expect(memoryError({ title: 'A', body: '', date: '2025-02-29' })).toBe('date');
  expect(memoryError({ title: 'A', body: '', date: '2026-13-01' })).toBe('date');
  expect(memoryError({ title: ' ', body: 'hello', date: '' })).toBe('title');
  expect(memoryError({ title: '🌿'.repeat(80), body: '🌿'.repeat(1000), date: '' })).toBe(null);
});

it('does not convert a literal date through UTC or the browser calendar', async () => {
  const { memoryPayload } = await model();
  const draft = { title: ' A ', body: '  keep spacing\n', date: '2026-10-11' };
  expect(memoryPayload(draft)).toEqual({ title: ' A ', body: '  keep spacing\n', date: '2026-10-11' });
  expect(memoryPayload({ ...draft, date: '' }).date).toBe(null);
});
