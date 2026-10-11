import { useCallback, useEffect, useRef, useState } from 'react';
import { apiJson } from '../../api';
import { tagKey, withoutTag } from '../../utils/runLabels';

/**
 * A run's type and tags as the runner is changing them.
 *
 * Every change is saved at once, one request at a time and in the order it was made, and each request is worked out from
 * what the server last confirmed, so a quick second change is neither lost nor has to wait to be seen: what is shown is
 * the confirmed labels with the changes still waiting applied on top. Two changes of the type in a row (an arrow key held
 * on the radio buttons) are one: the later replaces the earlier if the earlier has not been sent. If a save fails, that
 * change and the ones behind it are dropped and the confirmed labels come back, with `failed` set.
 *
 * `data` is what the server last said (from useRunLabels); a fresh load replaces everything here.
 */
export default function useRunLabelEditor(runId, data) {
  const confirmed = useRef(null);
  const queue = useRef([]);
  const sending = useRef(null);
  const running = useRef(false);
  const generation = useRef(0);
  const [shown, setShown] = useState(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    generation.current += 1;
    confirmed.current = data ? { runType: data.runType ?? null, tags: data.tags } : null;
    queue.current = [];
    setShown(confirmed.current);
  }, [data]);

  const display = () => queue.current.reduce((state, change) => change.apply(state), confirmed.current);

  const pump = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    setSaving(true);
    setFailed(false);
    const mine = generation.current;
    try {
      while (queue.current.length > 0 && generation.current === mine) {
        const change = queue.current[0];
        sending.current = change;
        const before = confirmed.current;
        const body = change.request(before);
        if (body) {
          let answer;
          try {
            answer = await apiJson(`/api/activities/${runId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(body),
            });
          } catch {
            if (generation.current === mine) {
              queue.current = [];
              setFailed(true);
              setShown(confirmed.current);
            }
            return;
          }
          if (generation.current !== mine) return;
          confirmed.current = {
            runType: 'runType' in body ? (answer?.runType ?? null) : before.runType,
            tags: 'tags' in body ? (Array.isArray(answer?.tags) ? answer.tags : body.tags) : before.tags,
          };
          setAnnouncement(change.message);
        }
        queue.current.shift();
        setShown(display());
      }
    } finally {
      sending.current = null;
      running.current = false;
      setSaving(false);
    }
  }, [runId]);

  const enqueue = useCallback((change) => {
    if (!confirmed.current) return;
    setAnnouncement('');
    const last = queue.current[queue.current.length - 1];
    if (change.kind === 'type' && last && last.kind === 'type' && last !== sending.current) {
      queue.current[queue.current.length - 1] = change;
    } else {
      queue.current.push(change);
    }
    setShown(display());
    pump();
  }, [pump]);

  const setType = useCallback((next, message) => enqueue({
    kind: 'type',
    message,
    apply: (state) => ({ ...state, runType: next }),
    request: (state) => (state.runType === next ? null : { runType: next }),
  }), [enqueue]);

  const addTag = useCallback((label, message) => enqueue({
    kind: 'add',
    message,
    apply: (state) => ({ ...state, tags: [...state.tags, label] }),
    request: (state) => (state.tags.some((tag) => tagKey(tag) === tagKey(label)) ? null : { tags: [...state.tags, label] }),
  }), [enqueue]);

  const removeTag = useCallback((label, message) => enqueue({
    kind: 'remove',
    message,
    apply: (state) => ({ ...state, tags: withoutTag(state.tags, label) }),
    request: (state) => (state.tags.some((tag) => tagKey(tag) === tagKey(label)) ? { tags: withoutTag(state.tags, label) } : null),
  }), [enqueue]);

  // Until the first effect has run there is nothing here yet; the loaded labels are the labels.
  const labels = shown ?? (data ? { runType: data.runType ?? null, tags: data.tags } : null);
  return { labels, saving, failed, announcement, setType, addTag, removeTag };
}
