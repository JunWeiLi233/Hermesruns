import { useCallback, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router';

/** Keep an embedded view's anchor and the rest of its page when its filters change. */
export default function useSectionSearchParams() {
  const { pathname, search, hash } = useLocation();
  const navigate = useNavigate();
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const update = useCallback((value, options) => {
    const next = new URLSearchParams(typeof value === 'function' ? value(new URLSearchParams(search)) : value);
    const query = next.toString();
    navigate({ pathname, search: query ? `?${query}` : '', hash }, { preventScrollReset: true, ...options });
  }, [pathname, search, hash, navigate]);
  return [params, update];
}
