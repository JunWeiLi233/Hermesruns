# Strava Linking QA Checklist

Use this checklist whenever the Strava link banners or Profile connect flow changes.

## Login banner
- Open `/login?error=STRAVA_LINK_CONFIRMATION_REQUIRED&details=Manual%20confirmation%20needed`.
- Confirm the warning banner is visible.
- Confirm the banner copy explains that Hermes avoided creating a duplicate runner.
- Confirm the alternate sign-in panel is expanded automatically.

## Signup banner
- Open `/signup?error=STRAVA_LINK_CONFIRMATION_REQUIRED&details=Manual%20confirmation%20needed`.
- Confirm the warning banner is visible.
- Confirm the alternate register panel is expanded automatically.
- Confirm the page still shows the normal signup form below the warning.

## Profile warning states
- Open `/profile?linking=confirmation_required&details=Manual%20confirmation%20needed` while signed in.
- Confirm the Strava sync notice banner appears with warning styling.
- Open `/profile?error=STRAVA_LINK_CONFLICT`.
- Confirm the notice explains that the Strava account is already linked elsewhere.
- Open `/profile?error=STRAVA_LINK_SESSION_EXPIRED`.
- Confirm the notice asks the runner to start again from Profile.

## Profile connect action
- Sign in with an email/password Hermes account that is not linked to Strava.
- Click the `Connect Strava` button in Connected Services.
- Confirm the browser redirects into Strava OAuth instead of showing a dead-end warning.
- After a successful callback, confirm Profile shows the linked success notice.
