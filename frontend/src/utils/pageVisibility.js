/**
 * Pause API poll loops while the tab is backgrounded so a slept Railway
 * backend is not stampede-woken by sync-status ticks the user cannot see.
 */
export function waitWhileDocumentHidden() {
  if (typeof document === 'undefined' || document.visibilityState !== 'hidden') {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    function onVisibilityChange() {
      if (document.visibilityState === 'hidden') return;
      document.removeEventListener('visibilitychange', onVisibilityChange);
      resolve();
    }
    document.addEventListener('visibilitychange', onVisibilityChange);
  });
}
