import { describe, expect, it } from 'vitest';
import { summarizeAdminShoeCatalogStatus } from './adminShoeCatalogStatus.js';

describe('summarizeAdminShoeCatalogStatus', () => {
  it('counts the shared admin catalog models by the same image status shown on dashboard/shoes', () => {
    expect(summarizeAdminShoeCatalogStatus([
      { brand: 'ASICS', model: 'Nimbus', liveImageUrl: '/nimbus.png' },
      { brand: 'ASICS', model: 'Magic Speed', pendingImageUrl: '/magic-pending.png', liveImageUrl: '/magic-live.png' },
      { brand: 'Nike', model: 'Pegasus' },
    ])).toEqual({ total: 3, pending: 1, live: 1, missing: 1 });
  });

  it('does not derive counts from runner-owned shoe fields', () => {
    expect(summarizeAdminShoeCatalogStatus([
      { brand: 'ASICS', model: 'Nimbus', runnerEmail: 'runner@example.com', photoUrl: '/runner-photo.png' },
    ])).toEqual({ total: 1, pending: 0, live: 0, missing: 1 });
  });
});
