import { useState } from 'react';
import { Button, Field, Notice } from './primitives';

const distanceFields = ['easyM', 'longM', 'steadyM', 'intervalM'];
export default function SessionCapsEditor({ caps, mode, isMile, onChange, s }) {
  const [reset, setReset] = useState(0);
  const timed = mode === 'RUN_WALK';
  const factor = isMile ? 1609.344 : 1000;
  const incompatible = timed ? distanceFields.some(key => caps?.[key] != null) : caps?.runWalkS != null;
  const clear = () => { onChange(null); setReset(n => n + 1); };
  return <fieldset className="tp-choice-group">
    <legend>{s('sessionCaps')}</legend><p className="tp-muted">{s('sessionCapsHelp')}</p>
    {incompatible && <Notice tone="warning">{s('capsModeChanged')}</Notice>}
    <div className="tp-fields">{(timed ? ['runWalkS'] : distanceFields).map(key => <Field
      key={`${key}:${reset}`} type="number" min={timed ? 15 : 1000 / factor} max={timed ? 120 : 100000 / factor} step="any"
      label={`${s(`cap_${key}`)} (${timed ? s('minuteUnit') : isMile ? 'mi' : 'km'})`}
      hint={s(timed ? 'capTimeHint' : 'capDistanceHint')}
      defaultValue={caps?.[key] == null ? '' : Number((caps[key] / (timed ? 60 : factor)).toFixed(4))}
      onChange={event => onChange({ ...caps, [key]: event.target.value === '' ? null : Math.floor(Number(event.target.value) * (timed ? 60 : factor) / (timed ? 30 : 50)) * (timed ? 30 : 50) })}
    />)}</div>
    <Button variant="ghost" onClick={clear}>{s('clearCaps')}</Button>
  </fieldset>;
}
