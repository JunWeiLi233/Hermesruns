import { Navigate, useLocation } from 'react-router';
import { teamSections } from './teamSections';

export default function LegacyCoachingRedirect({ children }) {
  const location = useLocation();
  const params = new URLSearchParams(location.search);
  const view = params.get('coaching');
  if (!teamSections.some(section => section.key === view)) return children;
  params.delete('coaching');
  params.set('view', view);
  return <Navigate replace to={`/profile/team?${params}${location.hash}`} />;
}
