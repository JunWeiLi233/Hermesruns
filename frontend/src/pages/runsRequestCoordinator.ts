export type RoutePreviewRequestToken = Readonly<{
  generation: number;
  ownerId: number;
  ids: readonly number[];
}>;

export type RoutePreviewClaim = {
  ids: number[];
  token: RoutePreviewRequestToken;
};

function normalizeIds(ids: unknown): number[] {
  if (!Array.isArray(ids)) return [];

  const normalized: number[] = [];
  const seen = new Set<number>();
  for (const value of ids) {
    let id: number;
    try {
      id = Number(value);
    } catch {
      continue;
    }
    if (!Number.isFinite(id) || id <= 0 || seen.has(id)) continue;
    seen.add(id);
    normalized.push(id);
  }
  return normalized;
}

export function createRoutePreviewRequestCoordinator() {
  let generation = 0;
  let nextOwnerId = 0;
  const inFlight = new Map<number, RoutePreviewRequestToken>();
  const settled = new Set<number>();
  const waiters = new Set<() => void>();

  const notifyWaiters = () => {
    [...waiters].forEach((notify) => notify());
  };

  const claimWithToken = (ids: unknown): RoutePreviewClaim => {
    const claimed: number[] = [];
    const ownerId = ++nextOwnerId;
    const candidateIds = normalizeIds(ids);
    for (const id of candidateIds) {
      if (inFlight.has(id) || settled.has(id)) continue;
      claimed.push(id);
    }

    const token = Object.freeze({
      generation,
      ownerId,
      ids: Object.freeze([...claimed]),
    });
    claimed.forEach((id) => inFlight.set(id, token));
    return { ids: claimed, token };
  };

  const owns = (id: number, token?: RoutePreviewRequestToken) => (
    token ? inFlight.get(id) === token : inFlight.has(id)
  );

  const claim = (ids: unknown) => claimWithToken(ids).ids;

  const settle = (ids: unknown, token?: RoutePreviewRequestToken) => {
    let changed = false;
    for (const id of normalizeIds(ids)) {
      if (token) {
        if (!owns(id, token)) continue;
      } else if (!inFlight.has(id)) {
        settled.add(id);
        changed = true;
        continue;
      }
      inFlight.delete(id);
      settled.add(id);
      changed = true;
    }
    if (changed) notifyWaiters();
  };

  const release = (ids: unknown, token?: RoutePreviewRequestToken) => {
    let changed = false;
    for (const id of normalizeIds(ids)) {
      if (!owns(id, token)) continue;
      inFlight.delete(id);
      changed = true;
    }
    if (changed) notifyWaiters();
  };

  const isCurrent = (token: RoutePreviewRequestToken) => (
    Boolean(token)
      && token.generation === generation
      && token.ids.every((id) => owns(id, token))
  );

  const getGeneration = () => generation;

  const waitFor = (ids: unknown): Promise<number[]> => {
    const normalized = normalizeIds(ids);
    const retryableIds = () => normalized.filter((id) => !inFlight.has(id) && !settled.has(id));

    if (normalized.length === 0 || !normalized.some((id) => inFlight.has(id))) {
      return Promise.resolve(retryableIds());
    }

    return new Promise((resolve) => {
      const check = () => {
        if (normalized.some((id) => inFlight.has(id))) return;
        waiters.delete(check);
        resolve(retryableIds());
      };
      waiters.add(check);
      check();
    });
  };

  const reset = () => {
    generation += 1;
    inFlight.clear();
    settled.clear();
    notifyWaiters();
  };

  return {
    claim,
    claimWithToken,
    settle,
    release,
    isCurrent,
    getGeneration,
    waitFor,
    reset,
  };
}
