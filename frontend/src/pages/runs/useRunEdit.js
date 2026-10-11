import { isRunEdit } from '../../utils/runEdit';
import useRunResource from './useRunResource';

/**
 * Loads everything the edit drawer shows for one run in one answer: the title, the notes, the rating and whether it is used for
 * the effort score, the run type and tags, the shoe, and the limits the form checks against (see useRunResource for what the
 * status means). The drawer reads it once when it opens, so a run edited from another tab is not overwritten by a stale draft:
 * what the runner sees is what the server held a moment ago.
 */
export default function useRunEdit(runId) {
  return useRunResource(runId == null ? null : `/api/activities/${runId}/edit`, isRunEdit);
}
