import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heat-cell-qa-browser.json'}]],outputDir:'../../../validation/heat-cell-qa-artifacts'};
