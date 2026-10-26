export function seed() {
  const samples = Array.from({
    length: 53
  }, (_, i) => ({
    offset: i * 60,
    hr: i >= 15 && i <= 17 ? null : Math.round(128 + 22 * Math.sin(i / 3) + (i > 20 && i < 35 ? 18 : 0)),
    power: null
  }));
  return {
    version: 1,
    actor: 'rowan',
    users: [['rowan', 'Rowan Ellis', 'rowan'], ['jules', 'Jules Park', 'jules'], ['coach', 'Mara Quinn', 'mara'], ['admin', 'Tori Bell', 'tori'], ['follower', 'Sam Rivera', 'sam']].map(([id, name, email]) => ({
      id,
      name,
      email: email + '@example.test',
      zone: 'America/New_York',
      units: 'metric',
      maxHr: 190,
      ftp: 240,
      revision: 1,
      dataRevision: 1,
      discoverable: id !== 'admin',
      coach: id === 'coach',
      routePrivate: true
    })),
    activities: [{
      id: 'hills',
      athleteId: 'rowan',
      title: 'Hill repetitions',
      date: '2026-10-13',
      sport: 'Running',
      minutes: 52,
      load: 71,
      coverage: .96,
      model: 'HR bands v1',
      samples,
      revision: 1,
      source: 'file',
      shareable: true
    }, {
      id: 'easy',
      athleteId: 'rowan',
      title: 'Easy river loop',
      date: '2026-10-14',
      sport: 'Running',
      minutes: 38,
      load: null,
      coverage: 0,
      model: 'Unknown',
      samples: [],
      revision: 1,
      source: 'file',
      shareable: true
    }, {
      id: 'recovery',
      athleteId: 'rowan',
      title: 'Recovery spin',
      date: '2026-10-12',
      sport: 'Cycling',
      minutes: 30,
      load: 0,
      coverage: 1,
      model: 'HR bands v1',
      samples: Array.from({
        length: 31
      }, (_, i) => ({
        offset: i * 60,
        hr: 100,
        power: 90
      })),
      revision: 1,
      source: 'file',
      shareable: true
    }, {
      id: 'jules-run',
      athleteId: 'jules',
      title: 'Towpath progression',
      date: '2026-10-14',
      sport: 'Running',
      minutes: 45,
      load: 65,
      coverage: 1,
      model: 'RPE v1',
      rpe: 3,
      samples: [],
      revision: 1,
      source: 'manual',
      shareable: true
    }],
    events: [{
      id: 'event',
      athleteId: 'rowan',
      date: '2026-10-15',
      title: 'Steady progression',
      minutes: 45,
      sport: 'Running',
      projectedLoad: 42,
      state: 'planned',
      revision: 1
    }],
    workouts: [{
      id: 'workout',
      ownerId: 'rowan',
      title: 'Steady progression',
      folderId: 'base',
      sport: 'Running',
      source: '10m @65% Warm up\n25m @80% Build gradually\n10m @55% Cool down',
      minutes: 45,
      version: 1,
      revision: 1,
      sharedWith: ['coach']
    }, {
      id: 'coach-workout',
      ownerId: 'coach',
      title: 'Controlled intervals',
      folderId: null,
      sport: 'Cycling',
      source: '10m @65% Warm up\n3x\n  2m @95% Work\n  1m @55% Recover\n5m @60% Cool down',
      minutes: 24,
      version: 1,
      revision: 1,
      sharedWith: ['rowan']
    }],
    folders: [{
      id: 'base',
      ownerId: 'rowan',
      name: 'Foundation sessions'
    }],
    plans: [{
      id: 'plan',
      ownerId: 'coach',
      title: 'Four-week foundation',
      version: 1,
      revision: 1,
      sharedWith: ['rowan'],
      items: [{
        day: 0,
        title: 'Controlled session',
        minutes: 40,
        sport: 'Running',
        projectedLoad: 40
      }, {
        day: 2,
        title: 'Easy endurance',
        minutes: 50,
        sport: 'Running',
        projectedLoad: 45
      }]
    }],
    assignments: [],
    wellness: [{
      athleteId: 'rowan',
      date: '2026-10-15',
      sleep: 7.5,
      restingHr: 54,
      feeling: 4,
      revision: 1,
      source: 'manual'
    }],
    relationships: [{
      id: 'coach-rowan',
      subject: 'rowan',
      grantee: 'coach',
      level: 'coach',
      state: 'accepted',
      wellness: []
    }, {
      id: 'coach-jules',
      subject: 'jules',
      grantee: 'coach',
      level: 'coach',
      state: 'accepted',
      wellness: []
    }, {
      id: 'follow-rowan',
      subject: 'rowan',
      grantee: 'follower',
      level: 'read',
      state: 'accepted',
      wellness: []
    }],
    teams: [{
      id: 'team',
      ownerId: 'admin',
      name: 'Northfield Endurance',
      slug: 'northfield',
      coachingEnabled: true,
      scopeRevision: 1,
      revision: 1,
      visibility: 'members',
      posting: 'members',
      members: [{
        userId: 'admin',
        role: 'admin',
        state: 'active'
      }, {
        userId: 'coach',
        role: 'coach',
        state: 'active'
      }, {
        userId: 'follower',
        role: 'follower',
        state: 'active'
      }, {
        userId: 'rowan',
        role: 'member',
        state: 'active'
      }, {
        userId: 'jules',
        role: 'member',
        state: 'active'
      }],
      consents: []
    }],
    conversations: [{
      id: 'direct',
      name: 'Training conversation',
      kind: 'direct',
      participants: ['rowan', 'coach']
    }, {
      id: 'activity',
      name: 'Hill session discussion',
      kind: 'activity',
      activityId: 'hills',
      participants: ['rowan', 'coach']
    }, {
      id: 'group',
      name: 'Northfield team room',
      kind: 'group',
      teamId: 'team'
    }],
    messages: [{
      id: 'm1',
      conversationId: 'direct',
      sender: 'coach',
      body: 'How did the last progression feel? Adjust the next session if you need more recovery.',
      at: '2026-10-14T18:00:00Z'
    }],
    comparisons: [],
    operations: [],
    seasons: [],
    connections: [],
    receipts: {}
  };
}
