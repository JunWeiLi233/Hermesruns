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

const helperStart = source.indexOf('function loadRecaptchaScript(siteKey)');
const helperEnd = source.indexOf('export default function Signup()');
assert.notEqual(helperStart, -1, 'Signup reCAPTCHA helpers should be present.');
assert.notEqual(helperEnd, -1, 'Signup component should follow the reCAPTCHA helpers.');

const createHelpers = new Function(
  `${source.slice(helperStart, helperEnd)}; return { getSignupCaptchaToken };`,
);

const originalWindow = globalThis.window;
const originalDocument = globalThis.document;

try {
  globalThis.window = {};
  globalThis.document = {
    getElementById: () => null,
    createElement: () => ({
      dataset: {},
      addEventListener: () => {},
    }),
    head: {
      appendChild(script) {
        setTimeout(() => {
          globalThis.window.grecaptcha = {
            ready(callback) {
              setTimeout(callback, 0);
            },
          };
          script.onload();
          setTimeout(() => {
            globalThis.window.grecaptcha.execute = async () => 'token-after-google-init';
          }, 20);
        }, 0);
        return script;
      },
    },
  };

  const { getSignupCaptchaToken } = createHelpers();
  let outcome;
  try {
    outcome = {
      token: await getSignupCaptchaToken({ required: true, siteKey: 'public-test-site-key' }),
    };
  } catch (error) {
    outcome = { error: error instanceof Error ? error.message : String(error) };
  }

  assert.deepEqual(
    outcome,
    { token: 'token-after-google-init' },
    'Signup should wait for grecaptcha.execute when Google finishes initialization just after script load.',
  );
} finally {
  globalThis.window = originalWindow;
  globalThis.document = originalDocument;
}

console.log('[PASS] Signup reCAPTCHA guardrails passed.');
