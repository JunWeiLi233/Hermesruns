import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heat-layer-coverage-browser.json'}]],outputDir:'../../../validation/heat-layer-coverage-artifacts'};
