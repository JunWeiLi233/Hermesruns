import { it, expect } from 'vitest';
import { createLocalClient } from './local.mjs';
const client = () => createLocalClient({
  storage: {
    getItem: () => null,
    setItem: () => {}
  }
});
it('does not let preview consumers tamper with the pinned source or apply it twice', async () => {
  const api = client();
  api.setActor('coach');
  const p = await api.previewPlan({
    planId: 'plan',
    athleteIds: ['rowan'],
    date: '2026-10-19'
  });
  p.source[0].title = 'Tampered';
  await api.commitBulk({
    operationId: p.id,
    hash: p.hash
  });
  const first = await api.getCalendar({
    athleteId: 'rowan'
  });
  await api.commitBulk({
    operationId: p.id,
    hash: p.hash
  });
  const second = await api.getCalendar({
    athleteId: 'rowan'
  });
  expect(first.events.some(e => e.title === 'Tampered')).toBe(false);
  expect(second.events.length).toBe(first.events.length);
});
it('rejects consent to a previous group scope revision', async () => {
  const api = client();
  api.setActor('admin');
  await api.updateTeam({
    teamId: 'team',
    coachingEnabled: false,
    revision: 1
  });
  api.setActor('rowan');
  await expect(api.decideTeamConsent({
    teamId: 'team',
    decision: 'granted',
    scopeRevision: 1
  })).rejects.toMatchObject({
    status: 409
  });
});
it('rejects coached raw imports even with calendar editing permission', async () => {
  const api = client();
  api.setActor('coach');
  await expect(api.importActivity({
    athleteId: 'rowan',
    date: '2026-10-15',
    minutes: 40
  })).rejects.toMatchObject({
    status: 404
  });
});
it('allows a team administrator to approve a pending membership without granting data', async () => {
  const api = client();
  const u = await api.signup({
    name: 'New sample',
    email: 'new@example.test',
    zone: 'America/New_York'
  });
  await api.joinTeam({
    teamId: 'team'
  });
  api.setActor('admin');
  await api.updateMember({
    teamId: 'team',
    userId: u.id,
    role: 'member'
  });
  await expect(api.getActivities({
    athleteId: u.id
  })).rejects.toMatchObject({
    status: 404
  });
});
