import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heat-layer-matched-browser.json'}]],outputDir:'../../../validation/heat-layer-matched-artifacts'};
