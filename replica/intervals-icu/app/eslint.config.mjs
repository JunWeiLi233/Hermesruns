import { createRequire } from 'node:module';
const require = createRequire(new URL('../../../frontend/package.json', import.meta.url));
const js = require('@eslint/js'),
  globals = require('globals');
export default [{
  ignores: ['dist/**', 'node_modules/**']
}, {
  files: ['**/*.{mjs,jsx}'],
  languageOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    globals: {
      ...globals.browser,
      ...globals.node
    },
    parserOptions: {
      ecmaFeatures: {
        jsx: true
      }
    }
  },
  rules: {
    ...js.configs.recommended.rules,
    'no-unused-vars': ['error', {
      varsIgnorePattern: '^[A-Z_]',
      argsIgnorePattern: '^_'
    }]
  }
}];
