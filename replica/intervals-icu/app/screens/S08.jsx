import exampleGpx from '../fixtures/original-example.gpx?raw';
import { ManualSession } from '../ui/ManualSession.jsx';
import { useState } from 'react';
import { Link } from 'react-router';
import { useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Field, Notice, Panel, TextField } from '../ui/components.jsx';
import { parseActivityFile } from '../data/model.mjs';
export default function Import() {
  const {
      api
    } = useWorkspace(),
    command = useCommand(),
    [files, setFiles] = useState([]),
    [outcomes, setOutcomes] = useState([]),
    [date, setDate] = useState('2026-10-15');
  async function importFiles() {
    const me = await api.getMe();
    if (files.reduce((n, f) => n + f.size, 0) > 20 * 1024 * 1024) throw Error('The total request must be at most 20 MiB.');
    const result = [];
    for (const file of files) {
      try {
        if(api.mode === 'http'){ result.push({name:file.name,...await api.importFile({file})});continue; }
        const text = await file.text(),
          payload = parseActivityFile(file.name, text, me.zone),
          digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)),
          fingerprint = Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, '0')).join('');
        result.push({
          name: file.name,
          ...(await api.importActivity({
            ...payload,
            fingerprint
          }))
        });
      } catch (error) {
        result.push({
          name: file.name,
          state: 'failed',
          error: error.message
        });
      }
    }
    setOutcomes(result);
  }
  return <><Panel title="Bring in a completed session" meta="Own account only · per-file outcomes"><div className="ds-stack"><Notice>{api.mode === 'http' ? 'Files are queued privately on the server and processed by the existing bounded importer. GPX, TCX, FIT and bounded archives depend on the canonical importer’s supported activity types. No remote provider is contacted.' : 'Local GPX and TCX parsing is available. FIT, ZIP, GZ, remote sync and durable import jobs need replica-backend. No provider is contacted.'}</Notice><Field label="Activity files">{p => <input {...p} className="tw-file" type="file" multiple accept=".gpx,.tcx,.fit,.zip,.gz" onChange={e => setFiles([...e.target.files])} />}</Field><Button variant="primary" busy={command.busy} disabled={!files.length} onClick={() => command.run(importFiles, 'Import finished. Review every file outcome.')}>Import selected files</Button><TextField label="Example session day" type="date" value={date} onChange={e => setDate(e.target.value)} /><Button onClick={() => command.run(async () => {
          if(api.mode === 'http'){const result=await api.importFile({file:new File([exampleGpx],'original-example.gpx',{type:'application/gpx+xml'})});setOutcomes([{name:'Original GPX example',...result}]);return;}
          const samples = Array.from({
            length: 41
          }, (_, i) => ({
            offset: i * 60,
            hr: 125 + i % 10 * 3,
            power: null
          }));
          const r = await api.importActivity({
            title: 'Morning progression example',
            name: 'example',
            date,
            sport: 'Running',
            minutes: 40,
            samples,
            fingerprint: `example-${date}`
          });
          setOutcomes([{
            name: 'Original generated example',
            ...r
          }]);
        }, 'Example import finished.')}>Import original example session</Button><Feedback command={command} /><ul className="tw-card-list">{outcomes.map((o, i) => <li className="tw-card" key={i}><strong>{o.name}</strong><span>{o.state}{o.error ? ` · ${o.error}` : ''}</span>{o.activityId && <Link to={`/activity?id=${o.activityId}`}>Inspect imported session</Link>}</li>)}</ul></div></Panel><ManualSession /></>;
}
