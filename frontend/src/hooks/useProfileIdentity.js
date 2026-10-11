import { useEffect, useState } from 'react';
import { cachedApiJson } from '../api/resourceCache';
import { useAuth } from '../contexts/AuthContext';
import { resolveProfileDisplayName, resolveProfileInitial } from '../utils/profileIdentity';

/**
 * The name and the initial in the circle at the top right, the way every page shows them: the profile's display name first,
 * then the start of the address. Until the profile arrives, or when it cannot be read, the address stands in.
 */
export default function useProfileIdentity(fallbackName = 'HermesRuns') {
  const { isAuthenticated, email } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!isAuthenticated) return undefined;
    let cancelled = false;
    cachedApiJson('/api/profile/me')
      .then((data) => {
        if (!cancelled) setProfile(data || null);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  return {
    profile,
    displayName: resolveProfileDisplayName(profile, fallbackName, email),
    initials: resolveProfileInitial(profile, fallbackName, email),
  };
}
