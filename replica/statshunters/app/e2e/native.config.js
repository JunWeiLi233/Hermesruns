import base from './playwright.config.js';
export default {
  ...base,
  testMatch: 'native.spec.js',
  outputDir: '../../output/playwright/native-results',
  reporter: [['list'], ['json', {outputFile: '../../validation/native-e2e-results.json'}], ['html', {outputFolder: '../../output/playwright/native-report', open: 'never'}]],
};
