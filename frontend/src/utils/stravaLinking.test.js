import assert from 'node:assert/strict';
import {
  parseAuthBannerQuery,
  parseCheckoutBannerQuery,
  parseLoginStatusQuery,
  parseProfileLinkingQuery,
  parseSignupStatusQuery,
} from './stravaLinking.js';

assert.deepEqual(
  parseAuthBannerQuery(
    '?error=STRAVA_LINK_CONFIRMATION_REQUIRED&details=Manual%20confirmation%20needed',
    'fallback'
  ),
  {
    banner: 'strava_link_confirmation_required',
    autoOpen: true,
    errorMessage: 'Manual confirmation needed',
    shouldClear: true,
  }
);

assert.deepEqual(
  parseAuthBannerQuery('?error=STRAVA_OAUTH_FAILED', 'fallback'),
  {
    banner: 'strava_failed',
    autoOpen: true,
    errorMessage: null,
    shouldClear: true,
  }
);

assert.deepEqual(
  parseProfileLinkingQuery('?linking=linked', {
    success: 'Linked',
    confirmationRequired: 'Confirm',
    conflict: 'Conflict',
    sessionExpired: 'Expired',
  }),
  { tone: 'success', message: 'Linked' }
);

assert.deepEqual(
  parseProfileLinkingQuery('?error=STRAVA_LINK_CONFIRMATION_REQUIRED&details=Choose%20runner', {
    success: 'Linked',
    confirmationRequired: 'Confirm',
    conflict: 'Conflict',
    sessionExpired: 'Expired',
  }),
  { tone: 'warning', message: 'Choose runner' }
);

assert.deepEqual(
  parseProfileLinkingQuery('?error=STRAVA_LINK_CONFLICT', {
    success: 'Linked',
    confirmationRequired: 'Confirm',
    conflict: 'Conflict',
    sessionExpired: 'Expired',
  }),
  { tone: 'error', message: 'Conflict' }
);

assert.deepEqual(
  parseProfileLinkingQuery('?error=STRAVA_LINK_SESSION_EXPIRED', {
    success: 'Linked',
    confirmationRequired: 'Confirm',
    conflict: 'Conflict',
    sessionExpired: 'Expired',
  }),
  { tone: 'warning', message: 'Expired' }
);

assert.deepEqual(
  parseLoginStatusQuery('?verified=1', {
    verifyInvalid: 'invalid',
    verifyExpired: 'expired',
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'verified',
    autoOpen: true,
    errorMessage: null,
    shouldClear: true,
  }
);

assert.deepEqual(
  parseLoginStatusQuery('?error=verify_expired', {
    verifyInvalid: 'invalid',
    verifyExpired: 'expired',
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'expired',
    autoOpen: true,
    errorMessage: 'expired',
    shouldClear: true,
  }
);

assert.deepEqual(
  parseSignupStatusQuery('?email=runner%40hermes.com', {
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: null,
    autoOpen: false,
    errorMessage: null,
    shouldClear: true,
    prefillEmail: 'runner@hermes.com',
  }
);

assert.deepEqual(
  parseSignupStatusQuery('?error=STRAVA_NOT_CONFIGURED', {
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'strava_not_configured',
    autoOpen: true,
    errorMessage: null,
    shouldClear: true,
    prefillEmail: '',
  }
);

assert.deepEqual(
  parseSignupStatusQuery('?error=GOOGLE_NOT_CONFIGURED', {
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'google_not_configured',
    autoOpen: true,
    errorMessage: null,
    shouldClear: true,
    prefillEmail: '',
  }
);

assert.deepEqual(
  parseLoginStatusQuery('?error=GOOGLE_FAILED&details=Denied', {
    verifyInvalid: 'invalid',
    verifyExpired: 'expired',
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'google_failed',
    autoOpen: true,
    errorMessage: 'Denied',
    shouldClear: true,
  }
);

assert.deepEqual(
  parseSignupStatusQuery('?email=runner%40hermes.com&error=STRAVA_LINK_CONFIRMATION_REQUIRED&details=Choose%20runner', {
    stravaConfirmationFallback: 'fallback',
  }),
  {
    banner: 'strava_link_confirmation_required',
    autoOpen: true,
    errorMessage: 'Choose runner',
    shouldClear: true,
    prefillEmail: 'runner@hermes.com',
  }
);

assert.equal(parseCheckoutBannerQuery('?checkout=success'), 'success');
assert.equal(parseCheckoutBannerQuery('?checkout=cancel'), 'cancel');
assert.equal(parseCheckoutBannerQuery('?foo=bar'), null);
