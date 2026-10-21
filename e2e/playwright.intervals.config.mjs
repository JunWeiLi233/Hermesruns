import {defineConfig} from '@playwright/test';
export default defineConfig({
 testDir:'./intervals-icu',testMatch:process.env.HERMES_TRAINING_AUDIT?'site-audit.capture.mjs':'f*.spec.mjs',timeout:60000,expect:{timeout:12000},workers:1,
 fullyParallel:false,retries:0,
 reporter:[['list'],['json',{outputFile:'../output/playwright/intervals-icu/results.json'}],['html',{outputFolder:'../output/playwright/intervals-icu/report',open:'never'}]],
 outputDir:'../output/playwright/intervals-icu/artifacts',
 use:{baseURL:'http://localhost:8080',viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York',trace:'off',screenshot:'only-on-failure'},
});
