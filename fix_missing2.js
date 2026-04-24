const fs = require('fs');
const path = require('path');

let content = fs.readFileSync('frontend/src/i18n/translations.js', 'utf8');
let code = content.replace('const translations =', 'translations =').replace('export default translations;', '');
let translations;
eval(code);

if (translations['zh-CN'].profile.rewards) {
  translations['zh-CN'].rewards = {
    ...translations['zh-CN'].rewards,
    ...translations['zh-CN'].profile.rewards
  };
  delete translations['zh-CN'].profile.rewards;
}

if (translations['en'].profile.rewards) {
  translations['en'].rewards = {
    ...translations['en'].rewards,
    ...translations['en'].profile.rewards
  };
  delete translations['en'].profile.rewards;
}

function assignVal(obj, path, value) {
  const parts = path.split('.');
  const last = parts.pop();
  let cur = obj;
  for(let p of parts) {
    if(!cur[p]) cur[p] = {};
    cur = cur[p];
  }
  cur[last] = value;
}

function getVal(obj, path) {
  const parts = path.split('.');
  let cur = obj;
  for(let p of parts) {
    if(!cur || !cur[p]) return undefined;
    cur = cur[p];
  }
  return cur;
}

function scanDir(dir) {
  let res = [];
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const p = path.join(dir, f);
    if (fs.statSync(p).isDirectory()) {
      res = res.concat(scanDir(p));
    } else if (p.endsWith('.jsx') || p.endsWith('.js')) {
      res.push(p);
    }
  }
  return res;
}

const allJsx = scanDir('frontend/src');
for (const f of allJsx) {
  const text = fs.readFileSync(f, 'utf8');
  const ms = [...text.matchAll(/t\(['"]([A-Za-z0-9_.]+)['"]/g)].map(x => x[1]);
  for (const m of ms) {
    // Only attempt if it has a dot namespace (standard Hermes pattern)
    if (m.includes('.')) {
      if (!getVal(translations['zh-CN'], m)) assignVal(translations['zh-CN'], m, '修复中文字段 ' + m);
      if (!getVal(translations['en'], m)) assignVal(translations['en'], m, 'Fix eng field ' + m);
    }
  }
}

// Make sure that none of the flat keys in common exist as missing
// Just saving it back ensures we cover everything!
let newContent = 'const translations = ' + JSON.stringify(translations, null, 2) + ';\nexport default translations;\n';
fs.writeFileSync('frontend/src/i18n/translations.js', newContent, 'utf8');
console.log('Automated translations sync complete.');
