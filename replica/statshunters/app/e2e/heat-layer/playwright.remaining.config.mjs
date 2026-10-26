import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heat-layer-remaining-browser.json'}]],outputDir:'../../../validation/heat-layer-remaining-artifacts'};
