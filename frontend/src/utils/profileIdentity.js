export function resolveProfileDisplayName(profile, fallback = 'HermesRuns', emailFallback = '') {
  const raw = profile?.displayName?.trim()
    || profile?.name?.trim()
    || String(profile?.email || '').split('@')[0]?.trim()
    || String(emailFallback || '').split('@')[0]?.trim()
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

export function resolveProfileInitial(profile, fallback = 'HermesRuns', emailFallback = '') {
  return resolveProfileDisplayName(profile, fallback, emailFallback).slice(0, 1).toUpperCase();
}
