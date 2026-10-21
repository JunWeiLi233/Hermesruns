import { useCallback, useId, useRef, useState } from 'react';
import { Link } from './router.jsx';
import { Badge, Button, Field, Notice } from '../design/primitives.jsx';
export { Badge, Button, Field, Notice };
export const fmt = v => v == null ? '—' : Number.isFinite(+v) ? Math.round(+v * 10) / 10 : v;
export function Panel({
  title,
  children,
  meta
}) {
  return <section className="ds-panel tw-panel"><header><h2>{title}</h2>{meta && <span className="ds-muted ds-small">{meta}</span>}</header>{children}</section>;
}
export function Feedback({
  command: c
}) {
  return <><span className="ds-sr" role="status">{c.busy ? 'Saving…' : ''}</span>{c.error && <Notice tone="danger" alert>{c.error}</Notice>}{c.message && <p className="tw-saved" role="status">{c.message}</p>}</>;
}
export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  ...props
}) {
  return <Field label={label}>{p => <input {...p} {...props} name={name} type={type} value={value} onChange={onChange} />}</Field>;
}
export function SelectField({
  label,
  name,
  value,
  defaultValue,
  onChange,
  options
}) {
  return <Field label={label}>{p => <select {...p} name={name} value={value} defaultValue={defaultValue} onChange={onChange}>{options.map(o => <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>)}</select>}</Field>;
}
export function QueryGate({
  query: q,
  children
}) {
  if (q.loading) return <Skeleton />;
  if (q.error) return <Notice tone="danger" alert>{q.error.status === 404 ? 'This view is unavailable with your current data access.' : q.error.message} <Link to="/athletes">Review access</Link></Notice>;
  return children(q.data);
}
export function Skeleton() {
  return <div className="tw-skeleton" role="status" aria-label="Loading screen"><span /><span /><span /><span /><span className="ds-sr">Loading workspace</span></div>;
}
export function Empty({
  children = 'No entries in this view yet.',
  to = '/import',
  action = 'Import a session'
}) {
  return <div className="ds-state"><h2>{children}</h2><p className="ds-muted">Choose a period or create your first entry.</p><Link className="ds-button" to={to}>{action}</Link></div>;
}
export function DataTable({
  caption,
  columns,
  rows
}) {
  return <div className="ds-table-scroll" role="region" tabIndex={0} aria-label={`${caption}, scrollable table`}><table className="ds-table"><caption>{caption}</caption><thead><tr>{columns.map(c => <th scope="col" key={c.key}>{c.label}</th>)}</tr></thead><tbody>{rows.map((r, i) => <tr key={r.id ?? i}>{columns.map((c, j) => j === 0 ? <th scope="row" key={c.key}>{c.render ? c.render(r) : fmt(r[c.key])}</th> : <td key={c.key}>{c.render ? c.render(r) : fmt(r[c.key])}</td>)}</tr>)}</tbody></table>{!rows.length && <p>No matching records.</p>}</div>;
}
export function LineChart({
  series,
  title,
  units = ''
}) {
  const id = useId(),
    [index, setIndex] = useState(0),
    values = series.flatMap(s => s.values.filter(v => v != null)),
    max = Math.max(1, ...values),
    min = Math.min(0, ...values),
    count = Math.max(2, ...series.map(s => s.values.length));
  const chunks = s => {
    const pieces = [];
    let p = [];
    s.values.forEach((v, i) => {
      if (v == null) {
        if (p.length) pieces.push(p);
        p = [];
      } else p.push(`${30 + i / (count - 1) * 540},${190 - (v - min) / (max - min) * 160}`);
    });
    if (p.length) pieces.push(p);
    return pieces;
  };
  return <div className="ds-stack"><div className="tw-actions">{series.map((s, i) => <Badge key={`series-${i}`} tone={['success', 'info', 'warning', 'danger'][i % 4]}>{s.name}{s.dashed ? ' · dashed' : ''}</Badge>)}</div>{values.length ? <div className="ds-chart-container"><svg className="ds-chart" viewBox="0 0 600 230" role="img" aria-labelledby={id}><title id={id}>{title}. {units}. Gaps indicate missing data. Values are listed below.</title>{[30, 110, 190].map(y => <line key={y} x1="30" y1={y} x2="570" y2={y} className="ds-gridline" />)}{series.map((s, i) => chunks(s).map((p, n) => <polyline key={`${i}-${n}`} points={p.join(' ')} className={`tw-line tw-line-${i % 4}`} strokeDasharray={s.dashed ? '8 5' : undefined} />))}<text x="30" y="220">Start</text><text x="570" y="220" textAnchor="end">End · {units}</text></svg></div> : <Notice tone="warning">No usable stream. Missing samples remain unknown.</Notice>}<TextField label="Inspect data point" type="number" min="0" max={count - 1} value={index} onChange={e => setIndex(Math.max(0, Math.min(count - 1, +e.target.value)))} /><output className="ds-readout" aria-live="polite">Point {index + 1}: {series.map(s => `${s.name} ${s.values[index] == null ? 'unavailable' : fmt(s.values[index])}`).join(' · ')}</output><details><summary>Read chart values</summary><DataTable caption={title} columns={[{
        key: 'point',
        label: 'Point'
      }, ...series.map((s, n) => ({
        key: `series-${n}`,
        label: s.name
      }))]} rows={Array.from({
        length: count
      }, (_, i) => Object.fromEntries([['point', i + 1], ...series.map((s, n) => [`series-${n}`, s.values[i] ?? null])]))} /></details></div>;
}
export function Modal({
  trigger,
  title,
  onOpen,
  children
}) {
  const dialog = useRef(null),
    button = useRef(null),
    heading = useRef(null),
    id = useId();
  const close = useCallback(() => document.getElementById(`${id}-dialog`)?.close(), [id]);
  return <><Button ref={button} onClick={() => {
      onOpen?.();
      dialog.current.showModal();
      heading.current.focus();
    }}>{trigger}</Button><dialog id={`${id}-dialog`} className="ds-dialog" ref={dialog} aria-labelledby={id} onClose={() => button.current?.focus()} onKeyDown={e => {
      if (e.key !== 'Tab') return;
      const list = [...dialog.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')],
        first = list[0],
        last = list.at(-1);
      if (e.shiftKey && (document.activeElement === first || document.activeElement === heading.current)) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }}><h2 id={id} ref={heading} tabIndex={-1}>{title}</h2><div className="ds-stack">{children(close)}<Button onClick={close}>Close review</Button></div></dialog></>;
}
export function ActivityLinks({
  id
}) {
  return <nav className="tw-subnav" aria-label="Session views">{[['/activity', 'Timeline'], ['/intervals', 'Intervals'], ['/analysis', 'Zones'], ['/compare-activities', 'Compare']].map(([p, n]) => <Link key={p} to={`${p}?id=${id}`}>{n}</Link>)}</nav>;
}
