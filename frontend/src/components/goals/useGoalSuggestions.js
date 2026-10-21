import { useEffect, useState } from 'react';
import { apiJson } from '../../api';
import useRecommendationRevision from '../../hooks/useRecommendationRevision';
import { useAccountDate } from '../../hooks/useAccountDate';

/** Whether an answer has the parts the card draws. Anything else is no suggestions, not a half-drawn card. */
function isSuggestions(data) {
  return Boolean(data && typeof data === 'object' && Array.isArray(data.suggestions));
}

/**
 * Goals worth setting, worked out on the server from the runner's own recent running, each with the numbers it comes from.
 * It asks once `ready` (the card's own goals have arrived), and again when `goalsKey` changes (a goal was set, changed or
 * deleted), because a goal the runner has is not suggested. A failed request is no suggestions: they are an extra, and the
 * card does not say they could not be loaded.
 *
 * `status` is 'loading' until the first answer, so the card says nothing (in particular, not that there is too little running to
 * go on) before it knows; 'ready' once it has one; 'unavailable' when the request failed.
 */
export default function useGoalSuggestions({ ready, goalsKey, timeZone }) {
  const recommendationRevision = useRecommendationRevision();
  const todayKey = useAccountDate(timeZone);
  const [state, setState] = useState({ status: 'loading', enough: false, suggestions: [] });

  useEffect(() => {
    if (!ready) return undefined;
    const controller = new AbortController();
    apiJson('/api/goals/suggestions', { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState(isSuggestions(data)
          ? { status: 'ready', enough: data.enough === true, suggestions: data.suggestions, recommendation: data.recommendation }
          : { status: 'unavailable', enough: false, suggestions: [] });
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ status: 'unavailable', enough: false, suggestions: [] });
      });
    return () => controller.abort();
  }, [ready, goalsKey, recommendationRevision, todayKey]);

  return state;
}
