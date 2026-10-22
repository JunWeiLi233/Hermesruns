import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heat-cell-browser.json'}]],outputDir:'../../../validation/heat-cell-artifacts'};
