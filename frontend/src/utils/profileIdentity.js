export function resolveProfileDisplayName(profile, fallback = 'Hermes', emailFallback = '') {
  const raw = profile?.displayName?.trim()
    || profile?.name?.trim()
    || String(profile?.email || '').split('@')[0]?.trim()
    || String(emailFallback || '').split('@')[0]?.trim()
    || fallback;
  return raw.replace(/^./, (char) => char.toUpperCase());
}

export function resolveProfileInitial(profile, fallback = 'Hermes', emailFallback = '') {
  return resolveProfileDisplayName(profile, fallback, emailFallback).slice(0, 1).toUpperCase();
}
