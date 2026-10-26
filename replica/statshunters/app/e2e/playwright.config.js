import { defineConfig, devices } from '@playwright/test';
const baseURL=process.env.EXPLORER_E2E_URL;
if(!baseURL||new URL(baseURL).hostname!=='127.0.0.1')throw new Error('E2E tests require the disposable loopback test server. Use test-product.ps1.');
export default defineConfig({
  testDir:'.',testMatch:'F*.spec.js',timeout:45000,expect:{timeout:12000},fullyParallel:false,workers:1,retries:0,
  outputDir:'../../output/playwright/results',
  reporter:[['list'],['json',{outputFile:'../../validation/product-e2e-results.json'}],['html',{outputFolder:'../../output/playwright/report',open:'never'}]],
  use:{baseURL,channel:'chrome',headless:true,trace:'retain-on-failure',screenshot:'only-on-failure',video:'off'},
  projects:[{name:'desktop',use:{viewport:{width:1440,height:900}}},{name:'mobile',use:{...devices['Pixel 7'],defaultBrowserType:'chromium',viewport:{width:390,height:844}}}],
});
