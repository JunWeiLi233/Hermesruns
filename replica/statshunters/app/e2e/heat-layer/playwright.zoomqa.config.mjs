import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heatmap-zoom-qa-browser.json'}]],outputDir:'../../../validation/heatmap-zoom-qa-artifacts'};
