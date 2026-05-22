import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./Signup.jsx', import.meta.url), 'utf8');

const bannedCopy = [
  'Elevate your',
  'Unleash',
  'Next-Gen',
  'Seamless',
  'powerful solution',
];

for (const phrase of bannedCopy) {
  assert.equal(
    source.includes(phrase),
    false,
    `Signup copy should not contain generic phrase: ${phrase}`,
  );
}

const mojibakeFragments = [
  '杩',
  '鐧',
  '鎻',
  '姣忎',
  '琛ㄧ',
  '銆',
  '�',
];

for (const fragment of mojibakeFragments) {
  assert.equal(
    source.includes(fragment),
    false,
    `Signup zh-CN copy should not contain mojibake fragment: ${fragment}`,
  );
}

const requiredCopy = [
  "hero_line_one: 'Start with'",
  "hero_line_three: 'smart run.'",
  "hero_line_one: '从下一次'",
  "hero_line_three: '开始。'",
  "login_nav: '返回登录'",
  "strava_cta: '使用 Strava 继续'",
  "confirm_password_mismatch: '两次输入的密码不一致。'",
];

for (const snippet of requiredCopy) {
  assert.ok(source.includes(snippet), `Signup copy missing expected snippet: ${snippet}`);
}

const preservedWiring = [
  "apiJson('/api/auth/providers')",
  "fetchPasswordRules().then(setPwRules)",
  "window.location.href = `${baseUrl}/api/auth/${provider}/start?state=signup`",
  "apiFetch('/api/auth/signup'",
  '<FooterNavLinks className="signup-flow-footer-links" publicOnly={true} />',
];

for (const snippet of preservedWiring) {
  assert.ok(source.includes(snippet), `Signup auth/data wiring changed or missing: ${snippet}`);
}

console.log('signup customer copy smoke passed');
