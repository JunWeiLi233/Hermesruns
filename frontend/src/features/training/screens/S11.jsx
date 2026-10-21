import { useActivity } from '../ui/workspace.jsx';
import { ActivityLinks, Empty, Notice, Panel, QueryGate, fmt } from '../ui/components.jsx';
import { derive } from '../data/model.mjs';
export default function Analysis() {
  const {
    detail,
    activity: a,
    id
  } = useActivity();
  return <QueryGate query={detail}>{() => a ? <><ActivityLinks id={id} /><Panel title="Heart-rate distribution" meta="Five default bands · anchor from athlete settings"><p>Known coverage {Math.round(a.coverage * 100)}%. Null samples are excluded rather than counted as zero effort.</p><div className="ds-zones">{derive(a, {
            maxHr: a.maxHr
          }).zones.map((minutes, i) => <div className="ds-zone" key={i}><span>Band {i + 1}</span><meter min="0" max={Math.max(1, a.minutes)} value={minutes} aria-label={`Band ${i + 1} minutes`} /><strong>{fmt(minutes)} min</strong></div>)}</div></Panel><Notice tone="warning">Power distributions, decoupling, maps and histograms require eligible streams and validated analytical adapters. A missing stream is not fabricated.</Notice></> : <Empty />}</QueryGate>;
}
