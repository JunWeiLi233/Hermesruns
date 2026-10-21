import { seed } from './seed.mjs';
import { addDays, civilDate, compileWorkout, derive, detectIntervals, fitness } from './model.mjs';
export class ClientError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
    this.code = String(status);
  }
}
const fail = (s, m) => {
    throw new ClientError(s, m);
  },
  copy = x => JSON.parse(JSON.stringify(x)),
  uid = () => crypto.randomUUID(),
  KEY = 'hermes-intervals-build-v1';
export function createLocalClient({
  storage = localStorage
} = {}) {
  let db;
  try {
    db = JSON.parse(storage.getItem(KEY));
  } catch {
    db = null;
  }
  if (db?.version !== 1) db = seed();
  const listeners = new Set();
  const user = id => db.users.find(u => u.id === id) || fail(404, 'Athlete unavailable.'),
    team = id => db.teams.find(t => t.id === id) || fail(404, 'Team unavailable.'),
    member = (t, id = db.actor) => t.members.find(m => m.userId === id && m.state === 'active');
  const admin = t => {
      if (member(t)?.role !== 'admin') fail(404, 'Team administration is unavailable.');
    },
    rev = (row, v) => {
      if (v != null && row.revision !== v) fail(412, 'This item changed. Reload before saving.');
    },
    touch = id => user(id).dataRevision++;
  function grants(id) {
    if (id === db.actor) return [{
      level: 'coach',
      wellness: ['sleep', 'restingHr', 'feeling'],
      source: 'owner'
    }];
    const paths = db.relationships.filter(r => r.subject === id && r.grantee === db.actor && r.state === 'accepted').map(r => ({
      ...r,
      source: 'direct'
    }));
    db.teams.forEach(t => {
      const c = t.consents.find(c => c.userId === id && c.state === 'granted' && c.scopeRevision === t.scopeRevision),
        target = member(t, id),
        staff = member(t);
      if (t.coachingEnabled && target?.role === 'member' && c && staff && ['admin', 'coach', 'follower'].includes(staff.role)) paths.push({
        level: staff.role === 'follower' ? 'read' : c.level,
        wellness: c.wellness,
        source: t.id
      });
    });
    return paths;
  }
  const guard = (id, write = false, field) => {
    if (!grants(id).some(g => (!write || g.level === 'coach') && (!field || g.wellness.includes(field)))) fail(404, 'Current access does not permit this operation.');
  };
  function activity(id, write = false) {
    const a = db.activities.find(a => a.id === id) || fail(404, 'Session unavailable.');
    guard(a.athleteId, write);
    if (a.athleteId !== db.actor && !a.shareable) fail(404, 'This source cannot be shared.');
    return a;
  }
  function tx(fn) {
    const old = copy(db);
    try {
      const result = fn();
      storage.setItem(KEY, JSON.stringify(db));
      listeners.forEach(f => f());
      return copy(result ?? {});
    } catch (e) {
      db = old;
      throw e;
    }
  }
  const readable = w => w.ownerId === db.actor || w.sharedWith?.includes(db.actor) || db.messages.some(m => m.workoutId === w.id && db.conversations.some(c => c.id === m.conversationId && canTalk(c)));
  function createEvent(p) {
    guard(p.athleteId, true);
    if (!civilDate(p.date) || !p.title?.trim() || !Number.isFinite(+p.minutes) || +p.minutes <= 0) fail(422, 'Enter a title, positive duration and valid date.');
    if (p.key && db.receipts[p.key]) {
      const r = db.receipts[p.key];
      if (r.actor !== db.actor || r.payload !== JSON.stringify(p)) fail(409, 'Request key reused with different content.');
      return db.events.find(e => e.id === r.id);
    }
    const e = {
      ...p,
      id: uid(),
      minutes: +p.minutes,
      sport: p.sport || 'Running',
      projectedLoad: p.projectedLoad ?? Math.round(+p.minutes),
      state: 'planned',
      revision: 1
    };
    db.events.push(e);
    touch(p.athleteId);
    if (p.key) db.receipts[p.key] = {
      actor: db.actor,
      id: e.id,
      payload: JSON.stringify(p)
    };
    return e;
  }
  function canTalk(c) {
    if (c.kind === 'group') return !!member(team(c.teamId));
    if (!c.participants.includes(db.actor)) return false;
    if (c.activityId) {
      try {
        activity(c.activityId);
      } catch {
        return false;
      }
    }
    return true;
  }
  const api = {
    mode: 'local',
    getSecurityKey() {
      return JSON.stringify([db.actor, db.relationships, db.teams]);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    getActor() {
      return db.actor;
    },
    getDemoActors() {
      return db.users.map(({
        id,
        name
      }) => ({
        id,
        name
      }));
    },
    setActor(id) {
      user(id);
      tx(() => {
        db.actor = id;
      });
    },
    async getMe() {
      return copy(user(db.actor));
    },
    async updateProfile(p) {
      return tx(() => {
        const u = user(db.actor);
        rev(u, p.revision);
        if (p.zone) try {
          new Intl.DateTimeFormat('en', {
            timeZone: p.zone
          });
        } catch {
          fail(422, 'Choose an IANA time zone.');
        }
        if (p.fitnessTau != null && (+p.fitnessTau < 1 || +p.fitnessTau > 180) || p.fatigueTau != null && (+p.fatigueTau < 1 || +p.fatigueTau > 60)) fail(422, 'Time constants are outside supported limits.');
        if (p.name != null && !p.name.trim()) fail(422, 'Enter your name.');
        if (p.maxHr != null && (+p.maxHr < 80 || +p.maxHr > 240)) fail(422, 'Maximum heart rate must be 80–240.');
        for (const k of ['name', 'zone', 'units', 'maxHr', 'ftp', 'discoverable', 'routePrivate', 'notifications', 'fitnessTau', 'fatigueTau']) if (p[k] != null) u[k] = p[k];
        u.revision++;
        if (p.maxHr != null) db.activities.filter(a => a.athleteId === db.actor).forEach(a => Object.assign(a, derive(a, u)));
        return u;
      });
    },
    async login({
      email,
      password
    }) {
      if (password !== 'demo') fail(401, 'Use a sample email and password “demo”.');
      const u = db.users.find(u => u.email === email.toLowerCase());
      if (!u) fail(401, 'Sample account unavailable.');
      api.setActor(u.id);
      return {
        user: copy(u)
      };
    },
    async signup(p) {
      return tx(() => {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email) || !p.name?.trim()) fail(422, 'Enter a name and valid sample email.');
        if (db.users.some(u => u.email === p.email.toLowerCase())) fail(409, 'That sample email is in use.');
        try {
          new Intl.DateTimeFormat('en', {
            timeZone: p.zone || 'America/New_York'
          });
        } catch {
          fail(422, 'Choose an IANA time zone.');
        }
        const u = {
          id: uid(),
          name: p.name,
          email: p.email.toLowerCase(),
          zone: p.zone || 'America/New_York',
          units: p.units || 'metric',
          maxHr: 190,
          revision: 1,
          dataRevision: 1,
          discoverable: false,
          routePrivate: true
        };
        db.users.push(u);
        db.actor = u.id;
        return u;
      });
    },
    async getRoster() {
      return {
        items: db.users.filter(u => u.id === db.actor || grants(u.id).length || db.teams.some(t => member(t) && member(t,u.id) && (t.visibility==='members'||['admin','coach'].includes(member(t).role)))).map(u => {
          const g = grants(u.id),
            a = db.activities.filter(a => a.athleteId === u.id && (u.id === db.actor || a.shareable));
          return {
            id: u.id,
            name: u.name,
            access: u.id === db.actor ? 'owner' : g.some(g => g.level === 'coach') ? 'coach' : g.length ? 'read' : 'none',
            minutes: g.length ? a.reduce((n, a) => n + a.minutes, 0) : null,
            load: g.length ? a.reduce((n, a) => n + (a.load ?? 0), 0) : null
          };
        })
      };
    },
    async searchAthletes() {
      return {
        items: db.users.filter(u => u.discoverable && u.id !== db.actor).map(({
          id,
          name,
          coach
        }) => ({
          id,
          name,
          coach
        }))
      };
    },
    async getActivities({
      athleteId
    }) {
      guard(athleteId);
      return {
        items: copy(db.activities.filter(a => a.athleteId === athleteId && (athleteId === db.actor || a.shareable)))
      };
    },
    async getActivity({
      activityId
    }) {
      const a = activity(activityId);
      return {
        ...copy(a),
        maxHr: user(a.athleteId).maxHr || 190,
        intervals: copy(a.intervals || detectIntervals(a))
      };
    },
    async updateActivity(p) {
      return tx(() => {
        const a = activity(p.activityId, true);
        rev(a, p.revision);
        if (p.title != null) a.title = p.title;
        if (p.rpe != null) {
          if (+p.rpe < 1 || +p.rpe > 10) fail(422, 'RPE must be 1–10.');
          a.rpe = +p.rpe;
          Object.assign(a, derive(a, user(a.athleteId)));
        }
        a.revision++;
        touch(a.athleteId);
        return a;
      });
    },
    async saveIntervals(p) {
      return tx(() => {
        const a = activity(p.activityId, true);
        rev(a, p.revision);
        if (p.intervals.some(i => i.start < 0 || i.end <= i.start || i.end > a.minutes * 60)) fail(422, 'Interval bounds must fit the session.');
        a.intervals = p.intervals;
        a.revision++;
        return a;
      });
    },
    async importActivity(p) {
      return tx(() => {
        if (p.athleteId && p.athleteId !== db.actor) fail(404, 'Raw imports belong to the signed-in athlete.');
        if (!civilDate(p.date) || p.minutes <= 0) fail(422, 'A valid date and duration are required.');
        const existing = db.activities.find(a => a.athleteId === db.actor && a.fingerprint === p.fingerprint && p.fingerprint);
        if (existing) return {
          state: 'duplicate',
          activityId: existing.id
        };
        const a = {
          ...p,
          id: uid(),
          athleteId: db.actor,
          title: p.title || p.name,
          revision: 1,
          source: p.source || 'file',
          shareable: true
        };
        Object.assign(a, derive(a, user(db.actor)));
        db.activities.push(a);
        touch(db.actor);
        return {
          state: 'imported',
          activityId: a.id
        };
      });
    },
    async createManual(p) {
      return tx(() => {
        guard(p.athleteId, true);
        if (!civilDate(p.date) || +p.minutes <= 0 || +p.rpe < 1 || +p.rpe > 10) fail(422, 'Enter date, duration and RPE 1–10.');
        const a = {
          ...p,
          id: uid(),
          minutes: +p.minutes,
          rpe: +p.rpe,
          revision: 1,
          source: 'manual',
          samples: [],
          shareable: true
        };
        Object.assign(a, derive(a, user(p.athleteId)));
        db.activities.push(a);
        touch(p.athleteId);
        return a;
      });
    },
    async getCalendar({
      athleteId,
      start,
      end
    }) {
      guard(athleteId);
      const range = a => (!start || a.date >= start) && (!end || a.date <= end);
      return {
        events: copy(db.events.filter(e => e.athleteId === athleteId && range(e))),
        activities: (await api.getActivities({
          athleteId
        })).items.filter(range)
      };
    },
    async createEvent(p) {
      return tx(() => createEvent(p));
    },
    async updateEvent(p) {
      return tx(() => {
        const e = db.events.find(e => e.id === p.eventId) || fail(404, 'Entry unavailable.');
        guard(e.athleteId, true);
        rev(e, p.revision);
        if (p.date && !civilDate(p.date)) fail(422, 'Choose a valid date.');
        if (e.state === 'completed' && p.date) fail(409, 'Completed history cannot move.');
        for (const k of ['date', 'title', 'state']) if (p[k] != null) e[k] = p[k];
        e.revision++;
        touch(e.athleteId);
        return e;
      });
    },
    async linkCompletion(p) {
      return tx(() => {
        const e = db.events.find(e => e.id === p.eventId) || fail(404, 'Entry unavailable.');
        guard(e.athleteId, true);
        const a = activity(p.activityId);
        if (a.athleteId !== e.athleteId) fail(422, 'Choose a session for this athlete.');
        if (db.events.some(x => x.id !== e.id && x.activityId === a.id)) fail(409, 'Session already linked.');
        e.activityId = a.id;
        e.state = 'completed';
        e.revision++;
        return e;
      });
    },
    async getFitness(p) {
      const c = await api.getCalendar({
        athleteId: p.athleteId
      });
      return {
        items: fitness(c.activities, c.events, {
          ...p,
          fitnessTau: user(p.athleteId).fitnessTau || 42,
          fatigueTau: user(p.athleteId).fatigueTau || 7
        }),
        assumption: 'Zero baseline at window start. Unknown session loads make days provisional; dashed future values are projections.'
      };
    },
    async getWellness({
      athleteId
    }) {
      guard(athleteId);
      const fields = new Set(grants(athleteId).flatMap(g => g.wellness));
      return {
        items: db.wellness.filter(w => w.athleteId === athleteId).map(w => Object.fromEntries(Object.entries(w).filter(([k]) => ['date', 'revision', 'source', 'athleteId'].includes(k) || fields.has(k))))
      };
    },
    async saveWellness(p) {
      return tx(() => {
        if (!civilDate(p.date)) fail(422, 'Choose a valid day.');
        const fields = ['sleep', 'restingHr', 'feeling'].filter(k => p[k] != null);
        fields.forEach(k => guard(p.athleteId, true, k));
        if (p.sleep != null && (p.sleep < 0 || p.sleep > 24) || p.restingHr != null && (p.restingHr < 25 || p.restingHr > 150) || p.feeling != null && (p.feeling < 1 || p.feeling > 5)) fail(422, 'Sleep 0–24h, resting HR 25–150, feeling 1–5.');
        let row = db.wellness.find(w => w.athleteId === p.athleteId && w.date === p.date);
        if (row) rev(row, p.revision);else {
          row = {
            athleteId: p.athleteId,
            date: p.date,
            revision: 0
          };
          db.wellness.push(row);
        }
        fields.forEach(k => row[k] = +p[k]);
        row.revision++;
        row.source = 'manual';
        return row;
      });
    },
    async getLibrary() {
      return {
        workouts: copy(db.workouts.filter(readable)),
        folders: copy(db.folders.filter(f => f.ownerId === db.actor)),
        plans: copy(db.plans.filter(readable))
      };
    },
    async saveWorkout(p) {
      return tx(() => {
        const compiled = compileWorkout(p.source);
        if (compiled.errors.length) fail(422, compiled.errors.join(' '));
        let w = p.workoutId ? db.workouts.find(w => w.id === p.workoutId && w.ownerId === db.actor) : null;
        if (p.workoutId && !w) fail(404, 'Only owned workouts can be edited.');
        if (!p.title?.trim()) fail(422, 'Name this workout.');
        if (w) {
          rev(w, p.revision);
          w.previousVersions = [...(w.previousVersions || []), copy({
            ...w,
            previousVersions: null
          })];
          w.version++;
          w.revision++;
          Object.assign(w, {
            title: p.title,
            source: p.source,
            sport: p.sport,
            folderId: p.folderId
          }, compiled);
        } else {
          w = {
            ...p,
            ...compiled,
            id: uid(),
            ownerId: db.actor,
            version: 1,
            revision: 1,
            sharedWith: []
          };
          db.workouts.push(w);
        }
        return w;
      });
    },
    async createFolder(p) {
      return tx(() => {
        if (!p.name?.trim()) fail(422, 'Name the folder.');
        const row = {
          id: uid(),
          ownerId: db.actor,
          name: p.name
        };
        db.folders.push(row);
        return row;
      });
    },
    async savePlan(p) {
      return tx(() => {
        if (!p.title?.trim() || !p.items?.length) fail(422, 'A plan needs a name and sessions.');
        const row = {
          ...p,
          id: uid(),
          ownerId: db.actor,
          version: 1,
          revision: 1,
          sharedWith: []
        };
        db.plans.push(row);
        return row;
      });
    },
    async previewPlan(p) {
      return tx(() => {
        if (!civilDate(p.date)) fail(422, 'Choose a valid start.');
        const plan = db.plans.find(x => x.id === p.planId && readable(x)) || fail(404, 'Plan unavailable.');
        if (!p.athleteIds.length || p.athleteIds.length > 50) fail(422, 'Choose 1–50 athletes.');
        const row = {
          id: uid(),
          actor: db.actor,
          kind: 'plan',
          planId: plan.id,
          source: copy(plan.items),
          version: plan.version,
          date: p.date,
          created: Date.now(),
          targets: [...new Set(p.athleteIds)].map(id => ({
            athleteId: id,
            name: user(id).name,
            revision: user(id).dataRevision,
            eligible: grants(id).some(g => g.level === 'coach')
          })),
          hash: uid(),
          outcomes: []
        };
        db.operations.push(row);
        return row;
      });
    },
    async previewConfiguration(p) {
      return tx(() => {
        if (!p.athleteIds.length || !['metric', 'imperial'].includes(p.units)) fail(422, 'Choose athletes and units.');
        const row = {
          id: uid(),
          actor: db.actor,
          kind: 'configuration',
          source: {
            units: p.units
          },
          date: '2026-10-15',
          created: Date.now(),
          targets: p.athleteIds.map(id => ({
            athleteId: id,
            name: user(id).name,
            revision: user(id).dataRevision,
            eligible: grants(id).some(g => g.level === 'coach')
          })),
          hash: uid(),
          outcomes: []
        };
        db.operations.push(row);
        return row;
      });
    },
    async commitBulk(p) {
      return tx(() => {
        const op = db.operations.find(o => o.id === p.operationId && o.actor === db.actor) || fail(404, 'Preview unavailable.');
        if (op.hash !== p.hash || Date.now() - op.created > 600000) fail(409, 'Preview expired or changed. Review again.');
        if (op.outcomes.length) return {
          ...op,
          outcomes: op.outcomes.map(o => grants(o.athleteId).some(g => g.level === 'coach') ? o : {
            athleteId: o.athleteId,
            name: o.name,
            state: 'previous receipt; current access ended'
          })
        };
        op.outcomes = op.targets.map(t => {
          if (!t.eligible || !grants(t.athleteId).some(g => g.level === 'coach')) return {
            ...t,
            state: 'denied'
          };
          if (user(t.athleteId).dataRevision !== t.revision) return {
            ...t,
            state: 'conflict'
          };
          if (op.kind === 'configuration') {
            user(t.athleteId).units = op.source.units;
            touch(t.athleteId);
          } else {
            if (db.assignments.some(a => a.athleteId === t.athleteId && a.planId === op.planId && a.date === op.date && a.version === op.version)) return {
              ...t,
              state: 'already applied'
            };
            op.source.forEach(item => createEvent({
              ...item,
              athleteId: t.athleteId,
              date: addDays(op.date, item.day),
              sourceVersion: op.version
            }));
            db.assignments.push({
              id: uid(),
              athleteId: t.athleteId,
              planId: op.planId,
              version: op.version,
              date: op.date,
              snapshot: copy(op.source)
            });
          }
          return {
            ...t,
            state: 'applied'
          };
        });
        return op;
      });
    },
    async getRequests() {
      return {
        items: copy(db.relationships.filter(r => r.subject === db.actor || r.grantee === db.actor).map(r => ({
          ...r,
          subjectName: user(r.subject).name,
          granteeName: user(r.grantee).name
        })))
      };
    },
    async requestAccess(p) {
      return tx(() => {
        if (p.athleteId === db.actor || !['read', 'coach'].includes(p.level)) fail(422, 'Choose another athlete and access level.');
        const row = {
          id: uid(),
          subject: p.athleteId,
          grantee: db.actor,
          level: p.level,
          state: 'pending',
          wellness: []
        };
        db.relationships.push(row);
        return row;
      });
    },
    async decideAccess(p) {
      return tx(() => {
        const r = db.relationships.find(r => r.id === p.relationshipId && r.subject === db.actor) || fail(404, 'Request unavailable.');
        if (!['accepted', 'declined', 'revoked'].includes(p.decision)) fail(422, 'Choose accept, decline or revoke.');
        r.state = p.decision;
        r.wellness = p.wellness || [];
        return r;
      });
    },
    async getAccess() {
      return {
        items: copy(db.relationships.filter(r => r.subject === db.actor).map(r => ({
          ...r,
          granteeName: user(r.grantee).name
        }))),
        groups: copy(db.teams.flatMap(t => t.consents.filter(c => c.userId === db.actor).map(c => ({
          ...c,
          teamName: t.name,
          teamId: t.id
        }))))
      };
    },
    async revokeAll() {
      return tx(() => {
        db.relationships.filter(r => r.subject === db.actor).forEach(r => r.state = 'revoked');
        db.teams.forEach(t => t.consents.filter(c => c.userId === db.actor).forEach(c => c.state = 'revoked'));
        return {
          state: 'revoked'
        };
      });
    },
    async getTeams() {
      return {
        items: copy(db.teams.filter(t => member(t)).map(t => ({
          ...t,
          ownRole: member(t).role,
          consents: t.consents.filter(c => c.userId === db.actor || ['admin', 'coach'].includes(member(t).role)),
          members: t.members.filter(m => t.visibility === 'members' || ['admin', 'coach'].includes(member(t).role) || m.userId === db.actor).map(m => ({
            ...m,
            name: user(m.userId).name
          })),
          consent: (() => {
            const c = t.consents.find(c => c.userId === db.actor);
            return c ? {
              ...c,
              state: c.scopeRevision !== t.scopeRevision && c.state === 'granted' ? 'scope changed — review required' : c.state
            } : null;
          })() || {
            state: 'pending'
          }
        })))
      };
    },
    async updateTeam(p) {
      return tx(() => {
        const t = team(p.teamId);
        admin(t);
        rev(t, p.revision);
        if (p.coachingEnabled != null && p.coachingEnabled !== t.coachingEnabled) {
          t.coachingEnabled = p.coachingEnabled;
          t.scopeRevision++;
        }
        for (const k of ['name', 'visibility', 'posting']) if (p[k] != null) t[k] = p[k];
        t.revision++;
        return t;
      });
    },
    async updateMember(p) {
      return tx(() => {
        const t = team(p.teamId);
        if (p.userId !== db.actor || p.role !== 'removed') admin(t);
        const m = t.members.find(m => m.userId === p.userId && m.state !== 'removed') || fail(404, 'Membership unavailable.');
        if (m.role === 'admin' && p.role !== 'admin' && t.members.filter(m => m.role === 'admin' && m.state === 'active').length === 1) fail(409, 'Appoint another administrator first.');
        if (!['admin', 'coach', 'follower', 'member', 'removed'].includes(p.role)) fail(422, 'Choose an allowed role.');
        if (p.role === 'removed') {
          m.state = 'removed';
          t.consents.filter(c => c.userId === p.userId).forEach(c => c.state = 'revoked');
        } else {
          m.role = p.role;
          m.state = 'active';
        }
        t.revision++;
        return t;
      });
    },
    async joinTeam({
      teamId
    }) {
      return tx(() => {
        const t = team(teamId);
        let m = t.members.find(m => m.userId === db.actor);
        if (!m) {
          m = {
            userId: db.actor,
            role: 'member',
            state: 'pending'
          };
          t.members.push(m);
        }
        return m;
      });
    },
    async decideTeamConsent(p) {
      return tx(() => {
        const t = team(p.teamId);
        if (member(t)?.role !== 'member') fail(404, 'Only an active athlete member can grant their own scope.');
        if (p.scopeRevision !== t.scopeRevision) fail(409, 'Team scope changed. Review again.');
        if (!['granted', 'declined', 'revoked'].includes(p.decision)) fail(422, 'Choose grant, decline or revoke.');
        let c = t.consents.find(c => c.userId === db.actor);
        if (!c) {
          c = {
            userId: db.actor
          };
          t.consents.push(c);
        }
        Object.assign(c, {
          state: p.decision,
          level: p.level || 'read',
          wellness: p.wellness || [],
          scopeRevision: p.scopeRevision
        });
        return c;
      });
    },
    async getJoinCard() {
      const t = team('team');
      return {
        id: t.id,
        name: t.name,
        slug: t.slug
      };
    },
    async getActivityConversation({
      activityId
    }) {
      const a = activity(activityId);
      let c = db.conversations.find(c => c.activityId === activityId && c.participants.includes(db.actor));
      if (c) return copy(c);
      return tx(() => {
        c = {
          id: uid(),
          name: `Discussion: ${a.title}`,
          kind: 'activity',
          activityId,
          participants: [...new Set([db.actor, a.athleteId])]
        };
        db.conversations.push(c);
        return c;
      });
    },
    async getConversations() {
      return {
        items: copy(db.conversations.filter(canTalk))
      };
    },
    async getMessages({
      conversationId
    }) {
      const c = db.conversations.find(c => c.id === conversationId);
      if (!c || !canTalk(c)) fail(404, 'Conversation unavailable.');
      return {
        items: copy(db.messages.filter(m => m.conversationId === conversationId).map(m => ({
          ...m,
          senderName: user(m.sender).name,
          sharedWorkout: m.workoutId ? (() => {
            const w = db.workouts.find(w => w.id === m.workoutId && readable(w));
            return w ? {
              id: w.id,
              title: w.title,
              version: w.version
            } : null;
          })() : null
        })))
      };
    },
    async sendMessage(p) {
      return tx(() => {
        const c = db.conversations.find(c => c.id === p.conversationId);
        if (!c || !canTalk(c)) fail(404, 'Conversation access has ended.');
        if (c.kind === 'group' && team(c.teamId).posting === 'staff' && !['admin', 'coach'].includes(member(team(c.teamId))?.role)) fail(404, 'Only team staff may post.');
        if (!p.body?.trim() || p.body.length > 2000) fail(422, 'Write 1–2,000 characters.');
        if (p.workoutId && !db.workouts.some(w => w.id === p.workoutId && readable(w))) fail(404, 'Workout unavailable.');
        const row = {
          ...p,
          id: uid(),
          sender: db.actor,
          at: new Date().toISOString()
        };
        db.messages.push(row);
        return row;
      });
    },
    async getComparisons() {
      return {
        items: copy(db.comparisons.filter(c => c.ownerId === db.actor))
      };
    },
    async saveComparison(p) {
      return tx(() => {
        if (p.activityIds.length < 2) fail(422, 'Choose at least two sessions.');
        p.activityIds.forEach(id => activity(id));
        const row = {
          ...p,
          id: uid(),
          ownerId: db.actor
        };
        db.comparisons.push(row);
        return row;
      });
    },
    async getConnections() {
      return {
        items: copy(db.connections.filter(c => c.ownerId === db.actor))
      };
    },
    async getSeasons({
      athleteId
    }) {
      guard(athleteId);
      return {
        items: copy(db.seasons.filter(s => s.athleteId === athleteId))
      };
    },
    async saveSeason(p) {
      return tx(() => {
        guard(p.athleteId, true);
        if (!civilDate(p.start) || !civilDate(p.end) || p.end <= p.start) fail(422, 'Season end must follow its start.');
        const row = {
          ...p,
          id: uid()
        };
        db.seasons.push(row);
        return row;
      });
    }
  };
  api.getActivityOverlays=async p=>({items:await Promise.all(p.activityIds.slice(0,8).map(activityId=>api.getActivity({activityId})))});
  return api;
}
