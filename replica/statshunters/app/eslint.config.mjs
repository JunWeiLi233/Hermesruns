import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const js = require('@eslint/js'); const globals = require('globals');
export default [{ ignores: ['dist/**', '.vite/**', 'test-results/**'] }, {
  files: ['**/*.{js,jsx,mjs}'], languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: {...globals.browser, ...globals.node}, parserOptions: { ecmaFeatures: { jsx: true } } },
  rules: {...js.configs.recommended.rules, 'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]', argsIgnorePattern: '^_' }]},
}];
