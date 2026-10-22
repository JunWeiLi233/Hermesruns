import { Link } from 'react-router';
import { Notice, Panel } from '../ui/components.jsx';
import { useWorkspace } from '../ui/workspace.jsx';
export default function Availability() {
  const {api}=useWorkspace();
  return <><Notice>Product pricing is undecided. This build offers no purchase, subscription or copied original-product pricing.</Notice><div className="tw-grid"><Panel title="Training workspace"><p>Activity import, analysis, calendar and reusable workouts are available for browser review.</p><Link className="ds-button" to="/calendar">Explore training</Link></Panel><Panel title="Coaching and team workspace"><p>{api.mode==='http'?'Consent, roster, role changes, conversations and plan application use your authenticated server account.':'Consent, roster, role changes, conversations and plan application are available as persistent local interactions.'}</p><Link className="ds-button" to="/athletes">Explore coaching</Link></Panel></div></>;
}
