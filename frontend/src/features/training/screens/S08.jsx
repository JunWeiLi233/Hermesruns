import { useState } from 'react';
import { Link } from '../ui/router.jsx';
import { ManualSession } from '../ui/ManualSession.jsx';
import { useWorkspace, useCommand } from '../ui/workspace.jsx';
import { Button, Feedback, Field, Notice, Panel, TextField } from '../ui/components.jsx';

export default function ImportActivities(){
  const {api}=useWorkspace(),command=useCommand();
  const [files,setFiles]=useState([]),[outcomes,setOutcomes]=useState([]),[jobId,setJobId]=useState('');
  async function importFiles(){
    if(files.reduce((total,file)=>total+file.size,0)>20*1024*1024)throw Error('Choose files totaling at most 20 MiB.');
    const results=[];
    for(const file of files){try{results.push({name:file.name,...await api.importFile({file})});}catch(error){results.push({name:file.name,state:'failed',error:error.message});}}
    setOutcomes(results);
  }
  return <><Panel title="Import completed activities"><Notice>Files enter the private server queue and the Hermes activity importer. No remote provider is contacted.</Notice><Field label="Activity files">{props=><input {...props} className="tw-file" type="file" accept=".gpx,.tcx,.fit,.zip,.gz" multiple onChange={event=>setFiles([...event.target.files])}/>}</Field><div className="tw-actions"><Button variant="primary" busy={command.busy} disabled={!files.length} onClick={()=>command.run(importFiles,'Import requests finished. Review each outcome.')}>Import selected files</Button></div><Feedback command={command}/><ul className="tw-card-list">{outcomes.map((outcome,index)=><li className="tw-card" key={index}><strong>{outcome.name}</strong><span>{outcome.state}{outcome.error?` · ${outcome.error}`:''}</span>{outcome.jobId&&<span>Job: {outcome.jobId}</span>}{outcome.activityId&&<Link to={`/activity?id=${outcome.activityId}`}>Open imported activity</Link>}</li>)}</ul></Panel><Panel title="Check a queued import"><TextField label="Import job ID" value={jobId} onChange={event=>setJobId(event.target.value)}/><Button busy={command.busy} disabled={!jobId.trim()} onClick={()=>command.run(async()=>{const result=await api.getJob({jobId:jobId.trim()});setOutcomes([{...result,name:'Queued import',jobId:result.id}]);},'Import status refreshed.')}>Check status</Button></Panel><ManualSession/></>;
}
