import { Navigate, useLocation } from 'react-router';

/** Preserve saved filter choices while moving old feature URLs into their existing owning pages. */
export default function AnalysisFeatureRedirect({ pathname, anchor }) {
  const { search } = useLocation();
  return <Navigate replace to={{ pathname, search, hash: `#${anchor}` }} />;
}
