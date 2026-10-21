import {defineConfig} from '@playwright/test';
import base from './playwright.config.mjs';
export default defineConfig({...base,testMatch:'**/*.capture.mjs',
  reporter:[['list'],['json',{outputFile:'../output/run-plan-parity/capture-results.json'}]],
  outputDir:'../output/run-plan-parity/artifacts'});
