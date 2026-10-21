import { useId } from 'react';
import { Info, LoaderCircle } from 'lucide-react';
export function Button({ children, variant = 'secondary', size = 'md', busy = false, disabled, ...props }) {
  return <button type="button" {...props} className={`ds-button ds-${variant} ds-${size}`} disabled={disabled || busy} aria-busy={busy || undefined}>
    {busy && <LoaderCircle className="ds-spin" aria-hidden="true" size={16} />}{children}
  </button>;
}
export function Badge({ children, tone = 'neutral' }) { return <span className={`ds-badge ds-tone-${tone}`}>{children}</span>; }
export function Notice({ children, tone = 'info', alert = false }) {
  return <div className={`ds-notice ds-tone-${tone}`} role={alert ? 'alert' : undefined}><Info size={16} aria-hidden="true"/><div>{children}</div></div>;
}
export function Field({ label, error, hint, children }) {
  const id = useId();
  return <div className="ds-field"><label htmlFor={id}>{label}</label>{children({ id, 'aria-invalid': !!error, 'aria-describedby': error || hint ? `${id}-help` : undefined })}
    {(error || hint) && <span id={`${id}-help`} className={error ? 'ds-error' : 'ds-muted'}>{error || hint}</span>}</div>;
}
