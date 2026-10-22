import React, { useId, useLayoutEffect } from 'react';
import { ArrowRight, Check, CircleAlert, Info, LoaderCircle } from 'lucide-react';
import Modal from '../../components/Modal.jsx';
import { usePlanCacheStatus } from '../../utils/trainingPlanCache';
export const cx = (...x: (string | undefined | false)[]) => x.filter(Boolean).join(' ');
export function Button({
  children,
  variant = 'primary',
  busy = false,
  className,
  onClick,
  offlineSafe = false,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  busy?: boolean;
  offlineSafe?: boolean;
}) {
  const offline = usePlanCacheStatus() !== 'online' && !offlineSafe;
  return <button {...props} disabled={props.disabled || offline} type={props.type || 'button'} className={cx('tp-button', 'tp-button--' + variant, className)} aria-busy={busy || undefined} aria-disabled={busy || props.disabled || offline || undefined} onClick={e => {
    if (busy) {
      e.preventDefault();
      return;
    }
    onClick?.(e);
  }}>{busy && <LoaderCircle className="tp-spinner" aria-hidden="true" />}{children}</button>;
}
export function Panel({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cx('tp-panel', className)}>{children}</section>;
}
export function Notice({
  children,
  tone = 'info',
  title
}: {
  children: React.ReactNode;
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: string;
}) {
  const Icon = tone === 'success' ? Check : tone === 'info' ? Info : CircleAlert;
  return <div className={'tp-notice tp-notice--' + tone} role={tone === 'danger' ? 'alert' : 'status'}><Icon aria-hidden="true" /><div>{title && <strong>{title}</strong>}<div>{children}</div></div></div>;
}
export function Field({
  label,
  hint,
  error,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
}) {
  const uid = useId();
  const id = props.id || uid;
  const described = [hint ? id + '-hint' : '', error ? id + '-error' : ''].filter(Boolean).join(' ');
  return <div className="tp-field"><label htmlFor={id}>{label}{props.required && <span aria-hidden="true"> *</span>}</label><input {...props} id={id} aria-invalid={!!error} aria-describedby={described || undefined} />{hint && <small id={id + '-hint'}>{hint}</small>}{error && <small className="tp-field-error" id={id + '-error'}>{error}</small>}</div>;
}
export function Select({
  label,
  hint,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  hint?: string;
}) {
  const uid = useId();
  const id = props.id || uid;
  return <div className="tp-field"><label htmlFor={id}>{label}</label><select {...props} id={id} aria-describedby={hint ? id + '-hint' : undefined}>{children}</select>{hint && <small id={id + '-hint'}>{hint}</small>}</div>;
}
export function ChoiceGroup({
  legend,
  options,
  value,
  onChange,
  name,
  hint
}: {
  legend: string;
  options: {
    value: string;
    title: string;
    description?: string;
    disabled?: boolean;
  }[];
  value: string;
  onChange: (v: string) => void;
  name?: string;
  hint?: string;
}) {
  const id = useId();
  return <fieldset className="tp-choice-group" aria-describedby={hint ? id + '-hint' : undefined}><legend>{legend}</legend>{hint && <p id={id + '-hint'} className="tp-muted">{hint}</p>}<div className="tp-choices">{options.map(o => <label key={o.value} className={cx('tp-choice', value === o.value && 'is-selected', o.disabled && 'is-disabled')}><input type="radio" name={name || id} value={o.value} checked={value === o.value} disabled={o.disabled} onChange={() => onChange(o.value)} /><span><strong>{o.title}</strong>{o.description && <small>{o.description}</small>}</span><span className="tp-radio-mark" aria-hidden="true">{value === o.value && <Check />}</span></label>)}</div></fieldset>;
}
export function Weekdays({
  days,
  labels,
  fullLabels,
  onChange,
  legend
}: {
  days: number[];
  labels: string[];
  fullLabels?: string[];
  onChange: (d: number[]) => void;
  legend: string;
}) {
  return <fieldset className="tp-choice-group"><legend>{legend}</legend><div className="tp-weekdays">{labels.map((label, i) => <label key={label} className={cx('tp-day', days.includes(i + 1) && 'is-selected')}><input type="checkbox" aria-label={fullLabels?.[i] || label} checked={days.includes(i + 1)} onChange={() => onChange(days.includes(i + 1) ? days.filter(d => d !== i + 1) : [...days, i + 1].sort())} /><span>{label}</span>{days.includes(i + 1) && <Check aria-hidden="true" />}</label>)}</div></fieldset>;
}
export function Badge({
  children,
  tone = 'neutral'
}: {
  children: React.ReactNode;
  tone?: 'neutral' | 'success' | 'warning' | 'accent' | 'info';
}) {
  return <span className={'tp-badge tp-badge--' + tone}>{children}</span>;
}
export function Stats({
  items
}: {
  items: {
    label: string;
    value: React.ReactNode;
    detail?: string;
  }[];
}) {
  return <dl className="tp-stats">{items.map(i => <div key={i.label}><dt>{i.label}</dt><dd>{i.value}</dd>{i.detail && <small>{i.detail}</small>}</div>)}</dl>;
}
export function Dialog({
  open,
  onClose,
  title,
  closeLabel,
  children
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  children: React.ReactNode;
}) {
  useLayoutEffect(() => {
    if (!open) return;
    const trigger = document.activeElement as HTMLElement | null;
    const regions = Array.from(document.querySelectorAll<HTMLElement>('[data-tp-background], .runner-shell-page, .mobile-runner-nav'));
    const previous = regions.map(el => el.inert);
    regions.forEach(el => {
      el.inert = true;
    });
    return () => {
      regions.forEach((el, i) => {
        el.inert = previous[i];
      });
      requestAnimationFrame(() => {
        if (trigger?.isConnected) trigger.focus();
      });
    };
  }, [open]);
  return <Modal isOpen={open} onClose={onClose} title={title} closeLabel={closeLabel} shellClassName="tp-ui tp-dialog-shell" cardClassName="tp-dialog" portalToBody><div role="region" aria-label={title} tabIndex={0}>{children}</div></Modal>;
}
export function Empty({
  title,
  children,
  action
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return <div className="tp-empty"><Info aria-hidden="true" /><h2>{title}</h2><p>{children}</p>{action}</div>;
}
export function Skeleton({
  label
}: {
  label: string;
}) {
  return <div aria-busy="true" role="status" className="tp-skeleton"><p>{label}</p>{[1, 2, 3].map(i => <div key={i} aria-hidden="true" />)}</div>;
}
export function WorkoutRow({
  day,
  title,
  target,
  status,
  onOpen,
  rest = false
}: {
  day: string;
  title: string;
  target: string;
  status?: string;
  onOpen: () => void;
  rest?: boolean;
}) {
  const contents = <><span className="tp-workout-date">{day}</span><span className="tp-workout-copy"><strong>{title}</strong><small>{target}</small></span>{status && <Badge tone={status === 'Completed' ? 'success' : 'neutral'}>{status}</Badge>}{!rest && <ArrowRight aria-hidden="true" />}</>;
  return rest ? <div className="tp-workout-row tp-workout-row--rest">{contents}</div> : <div><button className="tp-workout-row" onClick={onOpen}>{contents}</button></div>;
}
export function StepList({
  steps
}: {
  steps: {
    label: string;
    target: string;
    instruction: string;
  }[];
}) {
  return <ol className="tp-steps">{steps.map((s, i) => <li key={i}><span className="tp-step-number" aria-hidden="true">{String(i + 1).padStart(2, '0')}</span><div><strong>{s.label}</strong><p>{s.instruction}</p></div><strong className="tp-step-target">{s.target}</strong></li>)}</ol>;
}
