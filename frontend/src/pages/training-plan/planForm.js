export function validateGoal(values, today) {
  if (![5,10].includes(Number(values.distance))) return 'goal_invalid';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.date)||values.date<=today) return 'date_invalid';
  const end=new Date(`${values.date}T00:00:00Z`);
  if (!Number.isFinite(end.getTime())||end.toISOString().slice(0,10)!==values.date) return 'date_invalid';
  if ((end-new Date(`${today}T00:00:00Z`))/86400000>182) return 'date_long';
  if (!values.name.trim()||values.name.trim().length>120||/[<>\x00-\x1f\x7f]/.test(values.name)) return 'name_invalid';
  return null;
}
export function localMinute(date=new Date()) {
  const pad=value=>String(value).padStart(2,'0');
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
export function resolveLocalStarts(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return [];
  const parsed=new Date(value);
  if (!Number.isFinite(parsed.getTime())||localMinute(parsed)!==value) return [];
  return [...new Set([-120,-60,-30,0,30,60,120].map(minutes=>parsed.getTime()+minutes*60000))]
    .filter(time=>localMinute(new Date(time))===value).sort((a,b)=>a-b);
}
export function manualPayload(values, unit, clientKey) {
  const starts=resolveLocalStarts(values.start);
  const selected=Number(values.occurrence||0);
  const distance=Number(values.distance)*(unit==='mile'?1609.344:1000);
  const elapsed=Number(values.hours)*3600+Number(values.minutes)*60+Number(values.seconds);
  if (!starts.length||!Number.isSafeInteger(selected)||!starts[selected]||starts[selected]>Date.now()+300000) return {error:'start_invalid'};
  if (!Number.isFinite(distance)||distance<1||distance>1000000) return {error:'distance_invalid'};
  if (![values.hours,values.minutes,values.seconds].every(v=>/^\d+$/.test(String(v)))||Number(values.minutes)>59||Number(values.seconds)>59||elapsed<1||elapsed>604800) return {error:'duration_invalid'};
  if (!values.name.trim()||values.name.trim().length>120||/[<>\x00-\x1f\x7f]/.test(values.name)) return {error:'name_invalid'};
  return {value:{clientKey,startedAt:new Date(starts[selected]).toISOString(),timeZone:Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC',distanceMeters:Math.round(distance),elapsedSeconds:elapsed,name:values.name.trim()}};
}
