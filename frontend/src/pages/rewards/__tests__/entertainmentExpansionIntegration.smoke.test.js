import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

test('Rewards adds optional expansion alongside the unchanged pocket stories and reward tracks', () => {
  const source = fs.readFileSync(new URL('../Rewards.jsx', import.meta.url), 'utf8');
  assert.match(source, /import EntertainmentExpansion from '\.\/EntertainmentExpansion'/);
  assert.match(source, /<PocketStories timeZone=\{profile\?\.timeZone\} \/>/);
  assert.match(source, /<EntertainmentExpansion \/>/);
  assert.match(source, /rewardTracks\.map/);
  for (const language of ['en', 'zh-CN']) {
    const barrel = fs.readFileSync(new URL(`../../../i18n/locales/${language}/index.js`, import.meta.url), 'utf8');
    assert.match(barrel, /import entertainmentExpansion from '\.\/entertainmentExpansion\.js'/);
    assert.match(barrel, /\.\.\.entertainmentExpansion/);
  }
});
