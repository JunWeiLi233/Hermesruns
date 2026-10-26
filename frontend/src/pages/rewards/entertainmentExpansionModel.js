export const ACCESSORIES = ['scarf', 'cap', 'satchel'];
export const BACKGROUNDS = ['meadow', 'night'];

export function memoryError(draft) {
  if (!draft.title.trim() || [...draft.title].length > 80) return 'title';
  if ([...draft.body].length > 1000) return 'body';
  if (draft.date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(draft.date)) return 'date';
    const [year, month, day] = draft.date.split('-').map(Number);
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (year < 1 || month < 1 || month > 12 || day < 1 || day > days[month - 1]) return 'date';
  }
  return null;
}

export function memoryPayload(draft) {
  return { title: draft.title, body: draft.body, date: draft.date || null };
}

export function commandOperation(method, path) {
  const parts = path.split('/').filter(Boolean);
  if (parts[0] === 'companion') return 'companion.save';
  if (parts[0] === 'memories') return `memory.${method === 'DELETE' ? 'delete' : method === 'PUT' ? 'update' : 'create'}${parts[1] ? `/${parts[1]}` : ''}`;
  if (parts[0] === 'missions') return `mission.action/${parts[1]}`;
  if (parts[0] === 'invites') return `invite.${parts[1]}`;
  if (parts[0] === 'groups') {
    if (parts.length === 1) return 'group.create';
    if (parts[2] === 'slots') return `group.slot/${parts[1]}/${parts[3]}`;
    if (parts[2] === 'invites') return parts[4] === 'revoke' ? `group.revoke/${parts[1]}/${parts[3]}` : `group.invite/${parts[1]}`;
    return `group.${parts[2] === 'leave' ? 'leave' : 'delete'}/${parts[1]}`;
  }
  throw new Error('Unknown entertainment command');
}

export function checkedExpansion(state, metadata) {
  const versioned = value => value && Number.isInteger(value.version) && value.version >= 0;
  if (!state || !metadata || typeof state.accountId !== 'string' || state.accountId !== metadata.accountId
    || !versioned(state.companion) || !ACCESSORIES.includes(state.companion.accessory)
    || !BACKGROUNDS.includes(state.companion.background) || typeof state.companion.hidden !== 'boolean'
    || !Array.isArray(state.memories) || !state.memories.every(row => versioned(row) && typeof row.id === 'string'
      && typeof row.title === 'string' && typeof row.body === 'string' && !memoryError({ ...row, date: row.date || '' }))
    || !Array.isArray(state.missions) || state.missions.length !== 4
    || !['rest', 'reflection', 'story', 'walk-jog'].every(id => state.missions.some(row => versioned(row)
      && row.missionId === id && ['available', 'chosen', 'paused', 'completed', 'skipped'].includes(row.status)
      && row.completionSource === 'self-marked'))
    || !Array.isArray(state.groups) || !state.groups.every(row => versioned(row) && typeof row.id === 'string'
      && typeof row.ownerAccountId === 'string' && Array.isArray(row.members) && row.members.length <= 4
      && row.members.some(member => member.accountId === state.accountId)
      && Array.isArray(row.slots) && row.slots.length === 4 && row.slots.every((slot, index) => slot.index === index
        && (slot.symbol === null || ['sun', 'leaf', 'star', 'wave'].includes(slot.symbol)))
      && Array.isArray(row.invites) && typeof row.complete === 'boolean')) {
    throw new Error('Invalid private entertainment state');
  }
  return { ...state, metadata };
}
