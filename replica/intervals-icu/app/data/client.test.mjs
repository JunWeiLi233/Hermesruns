import { describe, it, expect } from 'vitest';
import { createLocalClient } from './local.mjs';
import { compileWorkout, parseActivityFile } from './model.mjs';
const memory = () => {
  const map = new Map();
  return {
    getItem: k => map.get(k) ?? null,
    setItem: (k, v) => map.set(k, v)
  };
};
const client = (storage = memory()) => createLocalClient({
  storage
});
describe('working local data layer', () => {
  it('persists a newly scheduled workout across client reconstruction', async () => {
    const storage = memory(),
      a = client(storage),
      me = await a.getMe();
    const e = await a.createEvent({
      athleteId: me.id,
      date: '2026-10-16',
      title: 'A real saved prescription',
      minutes: 40
    });
    expect((await client(storage).getCalendar({
      athleteId: me.id
    })).events.some(x => x.id === e.id)).toBe(true);
  });
  it('allows a read grant and rejects a follower write', async () => {
    const a = client();
    a.setActor('follower');
    const me = await a.getMe();
    expect((await a.getActivities({
      athleteId: 'rowan'
    })).items.length).toBeGreaterThan(0);
    await expect(a.createEvent({
      athleteId: 'rowan',
      date: '2026-10-16',
      title: 'Denied',
      minutes: 10
    })).rejects.toMatchObject({
      status: 404
    });
    expect(me.id).toBe('follower');
  });
  it('does not confer athlete access through admin membership', async () => {
    const a = client();
    a.setActor('admin');
    await expect(a.getActivities({
      athleteId: 'rowan'
    })).rejects.toMatchObject({
      status: 404
    });
    expect((await a.getRoster()).items.find(x => x.id === 'rowan').load).toBeNull();
  });
  it('checks membership and explicit current consent for group coaching', async () => {
    const a = client();
    await a.decideTeamConsent({
      teamId: 'team',
      decision: 'granted',
      level: 'coach',
      wellness: [],
      scopeRevision: 1
    });
    a.setActor('admin');
    expect((await a.getActivities({
      athleteId: 'rowan'
    })).items.length).toBeGreaterThan(0);
    await a.updateTeam({
      teamId: 'team',
      coachingEnabled: false,
      revision: 1
    });
    await expect(a.getActivities({
      athleteId: 'rowan'
    })).rejects.toMatchObject({
      status: 404
    });
  });
  it('retains a direct grant after group consent revocation', async () => {
    const a = client();
    await a.decideTeamConsent({
      teamId: 'team',
      decision: 'granted',
      level: 'coach',
      wellness: [],
      scopeRevision: 1
    });
    await a.decideTeamConsent({
      teamId: 'team',
      decision: 'revoked',
      level: 'coach',
      wellness: [],
      scopeRevision: 1
    });
    a.setActor('coach');
    expect((await a.getActivities({
      athleteId: 'rowan'
    })).items.length).toBeGreaterThan(0);
  });
  it('masks wellness independently from calendar access', async () => {
    const a = client();
    a.setActor('coach');
    expect((await a.getWellness({
      athleteId: 'rowan'
    })).items[0].sleep).toBeUndefined();
    await expect(a.saveWellness({
      athleteId: 'rowan',
      date: '2026-10-15',
      sleep: 8
    })).rejects.toMatchObject({
      status: 404
    });
  });
  it('freezes plan content and skips a target revoked after preview', async () => {
    const a = client();
    a.setActor('coach');
    const p = await a.previewPlan({
      planId: 'plan',
      athleteIds: ['rowan', 'jules'],
      date: '2026-10-19'
    });
    a.setActor('rowan');
    await a.revokeAll();
    a.setActor('coach');
    const result = await a.commitBulk({
      operationId: p.id,
      hash: p.hash
    });
    expect(result.outcomes.find(x => x.athleteId === 'rowan').state).toBe('denied');
    expect(result.outcomes.find(x => x.athleteId === 'jules').state).toBe('applied');
  });
  it('rejects a forged bulk preview hash without mutation', async () => {
    const a = client();
    a.setActor('coach');
    const p = await a.previewPlan({
      planId: 'plan',
      athleteIds: ['rowan'],
      date: '2026-10-19'
    });
    await expect(a.commitBulk({
      operationId: p.id,
      hash: 'wrong'
    })).rejects.toMatchObject({
      status: 409
    });
  });
  it('prevents removal of the last team administrator', async () => {
    const a = client();
    a.setActor('admin');
    await expect(a.updateMember({
      teamId: 'team',
      userId: 'admin',
      role: 'member'
    })).rejects.toMatchObject({
      status: 409
    });
  });
  it('never links the same activity twice', async () => {
    const a = client();
    const e = await a.createEvent({
      athleteId: 'rowan',
      date: '2026-10-14',
      title: 'Link once',
      minutes: 38
    });
    await a.linkCompletion({
      eventId: e.id,
      activityId: 'easy'
    });
    await expect(a.linkCompletion({
      eventId: 'event',
      activityId: 'easy'
    })).rejects.toMatchObject({
      status: 409
    });
  });
  it('keeps idempotent event replay unique and rejects changed content', async () => {
    const a = client(),
      payload = {
        athleteId: 'rowan',
        date: '2026-10-16',
        title: 'Once',
        minutes: 40,
        key: 'one'
      };
    expect((await a.createEvent(payload)).id).toBe((await a.createEvent(payload)).id);
    await expect(a.createEvent({
      ...payload,
      title: 'Changed'
    })).rejects.toMatchObject({
      status: 409
    });
  });
  it('preserves unknown load and a known zero as different values', async () => {
    const a = client();
    const rows = (await a.getActivities({
      athleteId: 'rowan'
    })).items;
    expect(rows.find(x => x.id === 'easy').load).toBeNull();
    expect(rows.find(x => x.id === 'recovery').load).toBe(0);
  });
  it('rejects stale event revisions', async () => {
    const a = client();
    await a.updateEvent({
      eventId: 'event',
      date: '2026-10-16',
      revision: 1
    });
    await expect(a.updateEvent({
      eventId: 'event',
      date: '2026-10-17',
      revision: 1
    })).rejects.toMatchObject({
      status: 412
    });
  });
  it('rejects an impossible civil date', async () => {
    await expect(client().createEvent({
      athleteId: 'rowan',
      date: '2026-02-30',
      title: 'Bad date',
      minutes: 20
    })).rejects.toMatchObject({
      status: 422
    });
  });
  it('blocks a removed member from a team conversation', async () => {
    const a = client();
    a.setActor('admin');
    await a.updateMember({
      teamId: 'team',
      userId: 'rowan',
      role: 'removed'
    });
    a.setActor('rowan');
    await expect(a.sendMessage({
      conversationId: 'group',
      body: 'Not allowed'
    })).rejects.toMatchObject({
      status: 404
    });
  });
  it('marks only eligible import replays duplicate, not a new activity', async () => {
    const a = client(),
      payload = {
        name: 'example.gpx',
        date: '2026-10-15',
        sport: 'Running',
        minutes: 30,
        samples: [],
        fingerprint: 'same'
      };
    const first = await a.importActivity(payload),
      second = await a.importActivity(payload);
    expect(first.state).toBe('imported');
    expect(second.state).toBe('duplicate');
    expect(second.activityId).toBe(first.activityId);
  });
});
describe('original workout and activity parsing', () => {
  it('compiles bounded repeats and unit targets', () => {
    const r = compileWorkout('10m @65% Warm up\n3x\n  2m @95% Work\n  1m @55% Recover\n5m @60% Cool down');
    expect(r.errors).toEqual([]);
    expect(r.minutes).toBe(24);
    expect(r.steps).toHaveLength(8);
  });
  it('does not discard malformed workout source', () => {
    expect(compileWorkout('3m at some effort').errors[0]).toMatch(/Line 1/);
  });
  it('reads GPX timestamps and namespace-aware heart-rate samples', () => {
    const r = parseActivityFile('ride.gpx', '<gpx><trk><name>Original test session</name><trkseg><trkpt><time>2026-10-15T10:00:00Z</time><extensions><hr>130</hr></extensions></trkpt><trkpt><time>2026-10-15T10:01:00Z</time><extensions><hr>140</hr></extensions></trkpt></trkseg></trk></gpx>');
    expect(r.minutes).toBe(1);
    expect(r.samples[1].hr).toBe(140);
    expect(r.date).toBe('2026-10-15');
  });
  it('rejects unparseable activity files instead of creating a blank session', () => {
    expect(() => parseActivityFile('bad.gpx', '<not-gpx/>')).toThrow();
  });
});
