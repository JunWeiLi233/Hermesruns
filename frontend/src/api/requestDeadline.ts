export const CRITICAL_READ_TIMEOUT_MS = 12000;

/** Bound a page's wait even if its transport ignores cancellation. Never retries. */
export function withRequestDeadline<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  signal?: AbortSignal,
): Promise<T> {
  if (signal?.aborted) return Promise.reject(signal.reason ?? new DOMException('Aborted', 'AbortError'));
  const controller = new AbortController();
  const cancel = () => controller.abort(signal?.reason);
  signal?.addEventListener('abort', cancel, { once: true });
  let onAbort: () => void;
  const timeout = window.setTimeout(() => {
    controller.abort(new DOMException('Request deadline exceeded', 'AbortError'));
  }, CRITICAL_READ_TIMEOUT_MS);
  const result = new Promise<T>((resolve, reject) => {
    onAbort = () => reject(controller.signal.reason ?? new DOMException('Aborted', 'AbortError'));
    controller.signal.addEventListener('abort', onAbort, { once: true });
    try { operation(controller.signal).then(resolve, reject); }
    catch (error) { reject(error); }
  });
  return result.finally(() => {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', cancel);
    controller.signal.removeEventListener('abort', onAbort);
  });
}
