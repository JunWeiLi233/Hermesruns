import config from './playwright.config.mjs';
export default {...config,reporter:[['list'],['json',{outputFile:'../../../validation/heatmap-redesign-browser.json'}]],outputDir:'../../../validation/heatmap-redesign-artifacts'};
