import { useEffect, useId, useRef, useState } from 'react';
import { ACCESSORIES, BACKGROUNDS } from './entertainmentExpansionModel';

export default function CompanionCloset({ state, text, onSave, disabled = false, savedRequestId }) {
  const [preview, setPreview] = useState(null);
  const heading = useRef(null);
  const previousHidden = useRef(state.hidden);
  const id = useId();
  const arrangement = preview || state;
  useEffect(() => { if (savedRequestId) setPreview(null); }, [savedRequestId]);
  useEffect(() => {
    if (previousHidden.current !== state.hidden) heading.current?.focus();
    previousHidden.current = state.hidden;
  }, [state.hidden]);
  if (state.hidden) return <div className="entertainment-hidden">
    <p>{text('companion_hidden')}</p>
    <button ref={heading} type="button" disabled={disabled} onClick={() => onSave({ accessory: state.accessory, background: state.background, hidden: false })}>{text('companion_restore')}</button>
  </div>;
  return <div>
    <div className="entertainment-heading"><h3 ref={heading} tabIndex={-1}>{text('companion_title')}</h3>
      <button type="button" disabled={disabled} onClick={() => { setPreview(null); onSave({ accessory: state.accessory, background: state.background, hidden: true }); }}>{text('companion_hide')}</button></div>
    <p>{text('closet_intro')}</p>
    <svg className="entertainment-companion" viewBox="0 0 280 200" role="img" aria-label={text('companion_alt', { accessory: text(arrangement.accessory), background: text(arrangement.background) })}>
      <rect width="280" height="200" rx="16" fill={arrangement.background === 'night' ? '#21394d' : '#edf3e4'} />
      {arrangement.background === 'night' ? <g fill="#f3e3ad"><circle cx="225" cy="38" r="16" /><circle cx="45" cy="29" r="2" /><circle cx="76" cy="57" r="2" /><circle cx="184" cy="20" r="2" /></g>
        : <g fill="#668454"><path d="M28 167q12-32 22 0M218 167q10-24 20 0" /><ellipse cx="140" cy="174" rx="87" ry="7" opacity=".3" /></g>}
      <path d="M167 148q59-53 62 2q-5 36-62 19" fill="#bc754d" stroke="#684232" strokeWidth="3" />
      <path d="M209 133q33 17 7 31l-17-17" fill="#f5e4c7" />
      <ellipse cx="136" cy="137" rx="40" ry="40" fill="#c78150" stroke="#684232" strokeWidth="3" />
      <ellipse cx="135" cy="143" rx="23" ry="25" fill="#f5e4c7" />
      <path d="M94 65l-4-37 32 23M150 49l30-23-2 45" fill="#c78150" stroke="#684232" strokeWidth="3" />
      <path d="M99 56l-1-17 15 13M161 50l11-12-1 21" fill="#dfb393" />
      <ellipse cx="135" cy="79" rx="46" ry="37" fill="#c78150" stroke="#684232" strokeWidth="3" />
      <path d="M92 81q22 42 43 30q27 10 44-30l-27 8-17 13-16-13z" fill="#f5e4c7" />
      <g fill="#322e2a"><circle cx="117" cy="74" r="3" /><circle cx="155" cy="74" r="3" /><path d="M129 92q7-4 13 0l-7 7z" /></g>
      <path d="M113 175h-16M156 175h16" stroke="#684232" strokeWidth="5" strokeLinecap="round" />
      {arrangement.accessory === 'scarf' && <g fill="#a74835"><path d="M99 107q35 13 71 0l-2 13q-31 12-68 0z" /><path d="M150 118l15 1-4 35-14-4z" /></g>}
      {arrangement.accessory === 'cap' && <g fill="#42634a"><path d="M103 52q32-32 65 0z" /><path d="M102 52h74v7h-74z" /></g>}
      {arrangement.accessory === 'satchel' && <g stroke="#644a31" strokeWidth="3"><path d="M111 111l43 39" fill="none" /><rect x="148" y="138" width="27" height="23" rx="4" fill="#d2b072" /><path d="M149 146h25" /></g>}
    </svg>
    <p aria-live="polite">{text(preview ? 'preview' : 'equipped')}</p>
    <fieldset disabled={disabled}><legend>{text('accessory')}</legend><div className="entertainment-options">
      {ACCESSORIES.map(value => <label key={value}><input type="radio" name={`${id}-accessory`} checked={arrangement.accessory === value} onChange={() => setPreview({ ...arrangement, accessory: value, hidden: false })} />{text(value)}</label>)}
    </div></fieldset>
    <fieldset disabled={disabled}><legend>{text('background')}</legend><div className="entertainment-options">
      {BACKGROUNDS.map(value => <label key={value}><input type="radio" name={`${id}-background`} checked={arrangement.background === value} onChange={() => setPreview({ ...arrangement, background: value, hidden: false })} />{text(value)}</label>)}
    </div></fieldset>
    <div className="entertainment-actions"><button type="button" disabled={disabled || !preview} onClick={async () => { if (await onSave(preview)) setPreview(null); }}>{text('equip')}</button>
      <button type="button" disabled={disabled || !preview} onClick={() => setPreview(null)}>{text('cancel')}</button></div>
  </div>;
}
