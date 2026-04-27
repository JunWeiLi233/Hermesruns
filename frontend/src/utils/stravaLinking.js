export function parseAuthBannerQuery(search, fallbackMessage) {
  const params = new URLSearchParams(search || '');
  const error = params.get('error');
  const details = params.get('details');

  if (error === 'STRAVA_LINK_CONFIRMATION_REQUIRED') {
    return {
      banner: 'strava_link_confirmation_required',
      autoOpen: true,
      errorMessage: details || fallbackMessage,
      shouldClear: true,
    };
  }

  if (error === 'STRAVA_NOT_CONFIGURED') {
    return {
      banner: 'strava_not_configured',
      autoOpen: true,
      errorMessage: null,
      shouldClear: true,
    };
  }

  if (error === 'GOOGLE_NOT_CONFIGURED') {
    return {
      banner: 'google_not_configured',
      autoOpen: true,
      errorMessage: null,
      shouldClear: true,
    };
  }

  if (error && error.startsWith('GOOGLE_')) {
    return {
      banner: 'google_failed',
      autoOpen: true,
      errorMessage: details || null,
      shouldClear: true,
    };
  }

  if (error && error.startsWith('STRAVA_')) {
    return {
      banner: 'strava_failed',
      autoOpen: true,
      errorMessage: details || null,
      shouldClear: true,
    };
  }

  return {
    banner: null,
    autoOpen: false,
    errorMessage: null,
    shouldClear: Boolean(error || details),
  };
}

export function parseLoginStatusQuery(search, messages) {
  const params = new URLSearchParams(search || '');

  if (params.get('verified') === '1') {
    return {
      banner: 'verified',
      autoOpen: true,
      errorMessage: null,
      shouldClear: true,
    };
  }

  const error = params.get('error');
  if (error === 'verify_invalid') {
    return {
      banner: 'invalid',
      autoOpen: true,
      errorMessage: messages.verifyInvalid,
      shouldClear: true,
    };
  }

  if (error === 'verify_expired') {
    return {
      banner: 'expired',
      autoOpen: true,
      errorMessage: messages.verifyExpired,
      shouldClear: true,
    };
  }

  return parseAuthBannerQuery(search, messages.stravaConfirmationFallback);
}

export function parseSignupStatusQuery(search, messages) {
  const params = new URLSearchParams(search || '');
  const prefillEmail = params.get('email');
  const authBanner = parseAuthBannerQuery(search, messages.stravaConfirmationFallback);

  return {
    ...authBanner,
    prefillEmail: prefillEmail ? prefillEmail.trim() : '',
    shouldClear: authBanner.shouldClear || Boolean(prefillEmail),
  };
}

export function parseCheckoutBannerQuery(search) {
  const params = new URLSearchParams(search || '');
  const checkout = params.get('checkout');
  if (checkout !== 'success' && checkout !== 'cancel') {
    return null;
  }
  return checkout;
}

export function parseProfileLinkingQuery(search, defaults) {
  const params = new URLSearchParams(search || '');
  const linkingState = params.get('linking');
  const linkingError = params.get('error');
  const details = params.get('details');

  if (!linkingState && !linkingError) {
    return null;
  }

  if (linkingState === 'linked') {
    return { tone: 'success', message: defaults.success };
  }

  if (linkingState === 'confirmation_required' || linkingError === 'STRAVA_LINK_CONFIRMATION_REQUIRED') {
    return { tone: 'warning', message: details || defaults.confirmationRequired };
  }

  if (linkingError === 'STRAVA_LINK_CONFLICT') {
    return { tone: 'error', message: details || defaults.conflict };
  }

  if (linkingError === 'STRAVA_LINK_SESSION_EXPIRED') {
    return { tone: 'warning', message: details || defaults.sessionExpired };
  }

  return null;
}
