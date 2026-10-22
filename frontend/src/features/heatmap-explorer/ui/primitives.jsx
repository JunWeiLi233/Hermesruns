import { useEffect, useId, useRef } from 'react';
import { AlertTriangle, Check, CheckCircle2, CircleHelp, Clock3, Info, LoaderCircle, LockKeyhole, RefreshCw, X } from 'lucide-react';

export function Button({ children, variant = 'secondary', size = 'md', busy = false, disabled = false, className = '', type = 'button', ...props }) {
  return <button {...props} type={type} className={`sh-button sh-button-${variant} sh-button-${size} ${className}`} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy && <LoaderCircle className="sh-spin" size={16} aria-hidden="true"/>}{children}
  </button>;
}
export function IconButton({ label, children, pressed, ...props }) {
  return <Button {...props} variant="ghost" className="sh-icon-button" aria-label={label} title={label} aria-pressed={pressed}>{children}</Button>;
}
export function Badge({ children, tone = 'neutral', icon: Icon }) {
  return <span className={`sh-badge sh-tone-${tone}`}>{Icon && <Icon size={13} aria-hidden="true"/>}{children}</span>;
}
export function Notice({ children, tone = 'info', title, live = false }) {
  const Icon = tone === 'danger' || tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return <div className={`sh-notice sh-tone-${tone}`} role={live ? tone === 'danger' ? 'alert' : 'status' : undefined}><Icon size={18} aria-hidden="true"/><div>{title && <strong>{title}</strong>}{children}</div></div>;
}
export function Field({ label, hint, error, children }) {
  const id = useId();
  return <div className="sh-field"><label htmlFor={id}>{label}</label>{children({ id, 'aria-describedby': hint || error ? `${id}-help` : undefined, 'aria-invalid': error ? true : undefined })}
    {(hint || error) && <span className={error ? 'sh-field-error' : 'sh-muted sh-small'} id={`${id}-help`}>{error || hint}</span>}
  </div>;
}
export function Checkbox({ children, hint, checked, onChange, disabled = false }) {
  const id = useId();
  return <div className="sh-checkbox"><input id={id} type="checkbox" checked={checked} onChange={onChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}/><div><label htmlFor={id}>{children}</label>{hint && <p id={`${id}-hint`} className="sh-muted sh-small">{hint}</p>}</div></div>;
}
export function Switch({ label, hint, checked, onChange, disabled = false }) {
  const id = useId();
  return <label className="sh-switch-row" htmlFor={id}><span><strong>{label}</strong>{hint && <small id={`${id}-hint`}>{hint}</small>}</span><input id={id} type="checkbox" role="switch" checked={checked} onChange={onChange} disabled={disabled} aria-describedby={hint ? `${id}-hint` : undefined}/></label>;
}
export function Segmented({ label, value, options, onChange }) {
  const id = useId();
  return <fieldset className="sh-segmented"><legend className="sh-sr">{label}</legend>{options.map(option => <label key={option.value} className={value === option.value ? 'sh-selected' : ''}><input type="radio" name={id} value={option.value} checked={value === option.value} onChange={() => onChange(option.value)} disabled={option.disabled}/><span>{option.label}</span></label>)}</fieldset>;
}
export function Accordion({ title, meta, children, defaultOpen = false }) {
  return <details className="sh-accordion" open={defaultOpen || undefined}><summary><span>{title}</span>{meta && <small>{meta}</small>}<span className="sh-chevron" aria-hidden="true">⌄</span></summary><div className="sh-accordion-content">{children}</div></details>;
}
export function Dialog({ open, onClose, title, description, children, footer, drawer = false, initialFocusRef }) {
  const ref = useRef(null); const heading = useRef(null); const titleId = useId(); const descriptionId = useId();
  useEffect(() => {
    const dialog = ref.current;
    if (open && !dialog.open) {
      dialog.showModal();
      (initialFocusRef?.current || heading.current)?.focus();
    } else if (!open && dialog.open) dialog.close();
    return () => { if (dialog.open) dialog.close(); };
  }, [open, initialFocusRef]);
  function containTab(event) {
    if(event.key!=='Tab')return;
    const controls=[...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href],summary,[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length>0&&getComputedStyle(element).visibility!=='hidden');
    if(!controls.length){event.preventDefault();heading.current.focus();return;}
    const first=controls[0],last=controls[controls.length-1];
    if(event.shiftKey&&(document.activeElement===first||document.activeElement===heading.current)){event.preventDefault();last.focus();}
    else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
  }
  return <dialog ref={ref} className={`sh-dialog ${drawer ? 'sh-drawer' : ''}`} aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}
    onKeyDown={containTab} onCancel={event => { event.preventDefault(); onClose(); }} onClose={() => { if (open && ref.current?.isConnected && !ref.current.open) onClose(); }}>
    <header className="sh-dialog-header"><div><h2 id={titleId} tabIndex={-1} ref={heading}>{title}</h2>{description && <p id={descriptionId} className="sh-muted">{description}</p>}</div><IconButton label={`Close ${title}`} onClick={onClose}><X size={20} aria-hidden="true"/></IconButton></header>
    <div className="sh-dialog-body">{children}</div>{footer && <footer className="sh-dialog-footer">{footer}</footer>}
  </dialog>;
}
const stateContent = {
  loading: [LoaderCircle, 'Preparing your activity view', 'The current selection stays in place while this view loads.'],
  empty: [CircleHelp, 'No activities yet', 'Add an activity file to start your personal map.'],
  noMatches: [CircleHelp, 'No activities match', 'Broaden the date range or clear a filter.'],
  error: [RefreshCw, 'This view could not load', 'Your saved history is unchanged. Try loading the view again.'],
  denied: [LockKeyhole, 'This view is unavailable', 'Sign in again or return to your private workspace.'],
  noGps: [Info, 'No track in this activity', 'Its distance and time still count toward your totals.'],
};
export function StatePanel({ state, onAction, heading, description, actionLabel }) {
  const [Icon, title, detail] = stateContent[state] || stateContent.error;
  return <section className="sh-state" aria-live="polite" aria-busy={state === 'loading'}><Icon className={state === 'loading' ? 'sh-spin' : ''} size={28} aria-hidden="true"/><h3>{heading||title}</h3><p>{description||detail}</p>{onAction && <Button onClick={onAction}>{actionLabel||(state === 'empty' ? 'Add activity files' : state === 'noMatches' ? 'Clear filters' : 'Try again')}</Button>}</section>;
}
const steps = ['File checked', 'Activity saved', 'Track prepared', 'Coverage updated'];
export function ProgressPanel({ state = 'coverage', onCancel, onRetry }) {
  const completed = state === 'complete' ? 4 : state === 'coverage' ? 3 : state === 'parsing' ? 1 : 0;
  const terminal = ['complete', 'failed', 'cancelled'].includes(state);
  const title = { queued: 'Waiting for a worker', parsing: 'Reading your activity', coverage: 'Preparing map coverage', complete: 'Your activity is ready', failed: 'The file needs another look', cancelled: 'Import cancelled' }[state];
  return <section className="sh-progress-panel"><div className="sh-row sh-between"><Badge tone={state === 'complete' ? 'success' : state === 'failed' ? 'danger' : 'neutral'} icon={terminal ? CheckCircle2 : Clock3}>{state}</Badge><span className="sh-small sh-muted">Example job</span></div><h3>{title}</h3>
    <p className="sh-muted">{state === 'failed' ? 'No valid track was found. Try another device export.' : state === 'cancelled' ? 'No further work will start for this request.' : state === 'queued' ? 'You can close this panel. Progress will remain available.' : 'An activity without GPS can still be saved with its metrics.'}</p>
    {!terminal && <progress aria-label="Import preparation" {...(state === 'queued' ? {} : {value:completed,max:4})}/>}
    <ol className="sh-job-steps">{steps.map((step,index) => <li key={step} className={index < completed ? 'sh-done' : ''}><span aria-hidden="true">{index < completed ? <Check size={14}/> : index+1}</span>{step}<small className="sh-muted">{index < completed ? 'Done' : terminal ? 'Not run' : 'Pending'}</small></li>)}</ol>
    {onCancel && !terminal && <Button onClick={onCancel}>Cancel request</Button>}{state === 'failed' && onRetry && <Button onClick={onRetry}>Choose another file</Button>}
  </section>;
}
export function Metric({ label, value, unit, note }) {
  return <div className="sh-metric"><span className="sh-muted sh-small">{label}</span><div><strong>{value}</strong>{unit && <span>{unit}</span>}</div>{note && <small className="sh-muted">{note}</small>}</div>;
}
