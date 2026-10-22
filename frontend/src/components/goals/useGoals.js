import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';

/** Whether an answer has the parts the cards draw. Anything else is treated as a failed load, not drawn half. */
function isGoals(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.goals) && Array.isArray(data.periods) && Array.isArray(data.metrics));
}

/**
 * The runner's goals and how far along each is, with the three things the cards do to them: set one, change a target, delete
 * one. Every change answers with the whole list as it is afterwards, which replaces what is held here, so what is drawn is
 * always what the server says.
 *
 * - `runId`: a run of the runner's; each goal then says what that run adds to it. A change refetches with it, since the answer
 *   to a change does not carry it.
 * - `defer`: wait until the browser is idle before the first request, so a page's first paint is not slowed by a card that sits
 *   lower down.
 *
 * status: 'loading' (nothing yet) | 'ready' | 'error' (nothing to show). A change returns `{ ok: true }` or `{ ok: false,
 * status }` where status is the HTTP status (409 for a goal that exists already), 0 when the request never got an answer.
 */
export default function useGoals({ runId = null, defer = false } = {}) {
  const recommendationRevision = useRecommendationRevision();
  const [state, setState] = useState({ status: 'loading', data: null });
  const [attempt, setAttempt] = useState(0);
  const [idle, setIdle] = useState(!defer);
  const mounted = useRef(true);
  const url = runId == null ? '/api/goals' : `/api/goals?runId=${encodeURIComponent(runId)}`;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!defer) return undefined;
    const schedule = window.requestIdleCallback || ((callback) => window.setTimeout(callback, 240));
    const cancel = window.cancelIdleCallback || window.clearTimeout;
    const handle = schedule(() => setIdle(true));
    return () => cancel(handle);
  }, [defer]);

  useEffect(() => {
    if (!idle) return undefined;
    const controller = new AbortController();
    apiJson(url, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState((current) => (isGoals(data) ? { status: 'ready', data } : current.data ? current : { status: 'error', data: null }));
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setState((current) => (current.data ? current : { status: 'error', data: null }));
      });
    return () => controller.abort();
  }, [url, idle, attempt, recommendationRevision]);

  const reload = useCallback(() => {
    setState((current) => (current.data ? current : { status: 'loading', data: null }));
    setAttempt((count) => count + 1);
  }, []);

  const change = useCallback(async (path, options) => {
    try {
      const data = await apiJson(path, options);
      if (!isGoals(data)) return { ok: false, status: 0 };
      if (mounted.current) {
        setState({ status: 'ready', data });
        if (runId != null) setAttempt((count) => count + 1);
      }
      return { ok: true };
    } catch (error) {
      return { ok: false, status: Number(error?.status) || 0 };
    }
  }, [runId]);

  const create = useCallback((period, metric, target) => change('/api/goals', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ period, metric, target }),
  }), [change]);

  const changeTarget = useCallback((id, target) => change(`/api/goals/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target }),
  }), [change]);

  const remove = useCallback((id) => change(`/api/goals/${id}`, { method: 'DELETE' }), [change]);

  return { status: state.status, data: state.data, reload, create, changeTarget, remove };
}
