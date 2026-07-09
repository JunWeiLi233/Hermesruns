import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./Signup.jsx', import.meta.url), 'utf8');

assert.match(
  source,
  /function loadRecaptchaScript\(siteKey\)/,
  'Signup should load the Google reCAPTCHA script when the backend reports a configured site key.',
);
assert.match(
  source,
  /async function getSignupCaptchaToken\(\{ required, siteKey \}\)/,
  'Signup should resolve a signup captcha token before POSTing to the backend.',
);
assert.match(
  source,
  /grecaptcha\.execute\(siteKey, \{ action: 'signup' \}\)/,
  'Signup should request a reCAPTCHA v3 token with the backend expected action.',
);
assert.match(
  source,
  /const captchaToken = await getSignupCaptchaToken\(\{[\s\S]*?required: recaptchaRequired,[\s\S]*?siteKey: recaptchaSiteKey,[\s\S]*?\}\);[\s\S]*?body: JSON\.stringify\(\{ email: email\.trim\(\), password, captchaToken \}\),/,
  'Signup should include captchaToken in the /api/auth/signup JSON payload.',
);
assert.match(
  source,
  /authProviders\?\.recaptchaRequired === true/,
  'Signup should read recaptchaRequired from /api/auth/providers.',
);
assert.match(
  source,
  /authProviders\?\.recaptchaSiteKey/,
  'Signup should read recaptchaSiteKey from /api/auth/providers.',
);

console.log('[PASS] Signup reCAPTCHA guardrails passed.');
