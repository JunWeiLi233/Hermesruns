// Accept only this website flow on the current origin after re-authentication.
export function trainingPlanReturnPath(value, origin) {
  if (!value) return '/profile';
  try {
    const url = new URL(value, origin);
    return url.origin === origin && (['/schedule','/today-run','/runs','/analysis','/settings','/settings/import-data'].includes(url.pathname) || /^\/runs\/\d+$/.test(url.pathname) || /^\/analysis\/(load-balance|intensity|injury-risk|coach-insight)$/.test(url.pathname) || url.pathname === '/training-plan' || url.pathname.startsWith('/training-plan/') || url.pathname === '/training' || url.pathname.startsWith('/training/'))
      ? url.pathname + url.search : '/profile';
  } catch { return '/profile'; }
}
