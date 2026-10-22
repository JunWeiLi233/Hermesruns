import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heatmap-load-once-browser.json'}]],outputDir:'../../../validation/heatmap-load-once-artifacts'};
