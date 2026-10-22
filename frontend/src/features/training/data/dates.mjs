let accountZone = 'UTC';
export function setAccountZone(zone) { try { new Intl.DateTimeFormat('en',{timeZone:zone}).format();accountZone=zone; } catch { accountZone='UTC'; } }
export function currentDate(now = new Date()) {
  const parts=Object.fromEntries(new Intl.DateTimeFormat('en',{timeZone:accountZone,year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now).map(p=>[p.type,p.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}
export function weekStart(now) { const date=new Date(`${currentDate(now)}T12:00:00Z`);date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);return date.toISOString().slice(0,10); }
