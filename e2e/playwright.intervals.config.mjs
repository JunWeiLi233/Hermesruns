import {defineConfig} from '@playwright/test';
import {assertSafeBaseUrl} from './fixtures/safety.mjs';
const baseURL=assertSafeBaseUrl(process.env.E2E_BASE_URL||`http://127.0.0.1:${process.env.E2E_PORT||18080}`);
const executablePath=process.env.E2E_CHROMIUM_PATH;
export default defineConfig({
 testDir:'./intervals-icu',testMatch:process.env.E2E_ADMIN_COURSE_MAP==='true'?'admin-course-map.synthetic.spec.mjs':process.env.HERMES_TRAINING_AUDIT?'site-audit.capture.mjs':'f*.spec.mjs',timeout:60000,expect:{timeout:12000},workers:1,
 fullyParallel:false,retries:0,
 reporter:[['list'],['json',{outputFile:'../output/playwright/intervals-icu/results.json'}],['html',{outputFolder:'../output/playwright/intervals-icu/report',open:'never'}]],
 outputDir:'../output/playwright/intervals-icu/artifacts',
 use:{baseURL,viewport:{width:1440,height:1000},locale:'en-US',timezoneId:'America/New_York',launchOptions:{...(executablePath?{executablePath}:{})},trace:'off',screenshot:'only-on-failure'},
});
