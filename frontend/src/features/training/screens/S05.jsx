import { Link } from 'react-router';
import { Notice, Panel } from '../ui/components.jsx';
export default function Connections(){
  return <><Panel title="Connected activity services"><p>Manage your existing Hermes provider connections and synchronization in account settings. Imported activities use the same activity history throughout Hermes.</p><Link className="ds-button" to="/settings/import-data">Open Hermes import settings</Link></Panel><Panel title="Activity files"><p>Upload your own GPX, TCX, FIT or supported archives through the private import queue.</p><Link className="ds-button" to="/training/import">Import files</Link></Panel><Notice>Coached views enforce source restrictions. Team membership never grants access to training or wellness data without athlete consent.</Notice></>;
}
