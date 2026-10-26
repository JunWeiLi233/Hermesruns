import { useState } from 'react';
import { useCommand, useWorkspace } from './workspace.jsx';
import { Button, DataTable, Feedback, Modal, Notice } from './components.jsx';
export function BulkReview({
  preview
}) {
  const {
      api
    } = useWorkspace(),
    c = useCommand(),
    [result, setResult] = useState(null);
  return <Modal trigger="Review application" title="Confirm the frozen target list">{close => <><Notice>Template content and target revisions are pinned. Each athlete is checked again at commit. Assigned sessions become athlete-owned snapshots; completed history is preserved.</Notice><DataTable caption="Eligibility at preview" columns={[{
        key: 'name',
        label: 'Athlete'
      }, {
        key: 'eligible',
        label: 'Eligible',
        render: r => r.eligible ? 'Yes' : 'No current coaching grant'
      }]} rows={preview.targets} /><p className="tw-muted">Preview expires after ten minutes. Start: {preview.date}.</p><Button variant="primary" busy={c.busy} onClick={() => c.run(async () => {
        const receipt = await api.commitBulk({
          operationId: preview.id,
          hash: preview.hash
        });
        setResult(receipt);
        return receipt;
      }, 'Application processed. Inspect per-athlete outcomes below.')}>Apply reviewed changes</Button><Feedback command={c} />{result && <DataTable caption="Per-athlete operation receipt" rows={result.outcomes} columns={[{
        key: 'name',
        label: 'Athlete'
      }, {
        key: 'state',
        label: 'Result'
      }]} />}<Button onClick={close}>Finish review</Button></>}</Modal>;
}
