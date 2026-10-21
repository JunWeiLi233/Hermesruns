import { useId } from 'react';
import { useI18n } from '../../../contexts/I18nContext';
import './coach-access.css';

export function AccessCard({ title, children, tools, className = '' }) {
  const id = useId();
  return <section className={`coach-access-card ${className}`} aria-labelledby={id}>
    <header className="coach-access-card-heading"><h3 id={id}>{title}</h3>{tools}</header>
    {children}
  </section>;
}

export function AccessSwitch({ label, help, checked, disabled, onChange, muted = false }) {
  const id = useId();
  return <label className={`coach-access-switch-row${muted ? ' coach-access-switch-muted' : ''}`}>
    <span className="coach-access-copy"><strong>{label}</strong><span id={id}>{help}</span></span>
    <span className="coach-access-switch">
      <input type="checkbox" role="switch" aria-label={label} aria-describedby={id} checked={checked} disabled={disabled} onChange={onChange} />
      <span aria-hidden="true" />
    </span>
  </label>;
}

export function AccessAvatar({ name = '', group = false }) {
  const words = name.trim().split(/\s+/u).filter(Boolean);
  const initials = group && words.length > 1 ? words.slice(0, 2).map(word => Array.from(word)[0]).join('') : words.length > 1 ? `${Array.from(words[0])[0]}${Array.from(words.at(-1))[0]}` : Array.from(words[0] || '').slice(0, 2).join('');
  return <span className={`coach-access-avatar${group ? ' coach-access-avatar-group' : ''}`} aria-hidden="true">{initials.toLocaleUpperCase()}</span>;
}

export function AccessFeedback({ command }) {
  const { t } = useI18n();
  return <>
    {command.busy && <span className="coach-access-feedback" role="status">{t('training_integration.coachAccess.saving')}</span>}
    {command.error && <p className="coach-access-error" role="alert">{command.error}</p>}
    {command.message && <p className="coach-access-feedback" role="status">{command.message}</p>}
  </>;
}
