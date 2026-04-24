const COACH_STORAGE_KEY = 'hermes_assigned_coach_v1';

const COACH_ROSTER = [
  {
    id: 'mara-voss',
    name: 'Mara Voss',
    roleEn: 'Endurance Head Coach',
    roleZh: '耐力主教练',
  },
  {
    id: 'elias-brooks',
    name: 'Elias Brooks',
    roleEn: 'Race Strategy Coach',
    roleZh: '比赛策略教练',
  },
  {
    id: 'naomi-vale',
    name: 'Naomi Vale',
    roleEn: 'Performance Coach',
    roleZh: '表现教练',
  },
  {
    id: 'lucas-rye',
    name: 'Lucas Rye',
    roleEn: 'Training Block Coach',
    roleZh: '训练周期教练',
  },
];

function hashString(value) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash);
}

function getCoachStorage() {
  try {
    const raw = window.localStorage.getItem(COACH_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function setCoachStorage(storage) {
  try {
    window.localStorage.setItem(COACH_STORAGE_KEY, JSON.stringify(storage));
  } catch {
    // Ignore storage failures and rely on deterministic fallback.
  }
}

function getUserCoachKey(profile, email) {
  const profileId = profile?.id != null ? String(profile.id) : '';
  const profileEmail = profile?.email ? String(profile.email).trim().toLowerCase() : '';
  const authEmail = email ? String(email).trim().toLowerCase() : '';
  const displayName = profile?.displayName ? String(profile.displayName).trim() : '';
  return profileId || profileEmail || authEmail || displayName || 'hermes-runner';
}

export function resolveAssignedCoach(profile, email) {
  const userKey = getUserCoachKey(profile, email);
  const storage = getCoachStorage();
  const storedCoachId = storage[userKey];
  const storedCoach = COACH_ROSTER.find((entry) => entry.id === storedCoachId);
  if (storedCoach) return storedCoach;

  const coach = COACH_ROSTER[hashString(userKey) % COACH_ROSTER.length];
  setCoachStorage({ ...storage, [userKey]: coach.id });
  return coach;
}

export function getCoachRoleLabel(coach, lang) {
  if (!coach) return '';
  return lang === 'zh-CN' ? coach.roleZh : coach.roleEn;
}
