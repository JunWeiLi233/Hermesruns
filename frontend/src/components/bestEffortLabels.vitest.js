import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import { distanceName, placeName, placeTone } from './bestEffortLabels';

const translator = (dictionary) => (key, params = {}) => {
  const copy = key.split('.').reduce((value, part) => value?.[part], dictionary) || key;
  return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
};
const tEn = translator(en);
const tZh = translator(zh);

// The keys the server sends, in order, as BestEffortDistances.ALL lists them.
const SERVER_KEYS = ['400m', 'half_mile', '1km', '1mile', '3km', '2mile', '5km', '10km', '15km', '10mile', '20km', 'half', '30km', 'marathon', '50km'];

describe('distanceName', () => {
  it('has a name, in both languages, for every distance the server sends', () => {
    for (const key of SERVER_KEYS) {
      expect(distanceName(tEn, key), key).not.toBe(`best_efforts.distance_${key}`);
      expect(distanceName(tZh, key), key).not.toBe(`best_efforts.distance_${key}`);
    }
  });

  it('names them the way runners do', () => {
    expect(SERVER_KEYS.map((key) => distanceName(tEn, key))).toEqual([
      '400 m', '½ mile', '1 km', '1 mile', '3 km', '2 miles', '5 km', '10 km', '15 km', '10 miles', '20 km', 'Half marathon', '30 km', 'Marathon', '50 km',
    ]);
    expect(distanceName(tZh, 'half')).toBe('半程马拉松');
    expect(distanceName(tZh, 'marathon')).toBe('全程马拉松');
  });
});

describe('placeName', () => {
  it('calls the first place PR (PB in Chinese) and numbers the rest', () => {
    expect([1, 2, 3, 4, 12].map((rank) => placeName(tEn, rank))).toEqual(['PR', '2nd', '3rd', '#4', '#12']);
    expect([1, 2, 3, 4].map((rank) => placeName(tZh, rank))).toEqual(['PB', '第 2 名', '第 3 名', '第 4 名']);
  });
});

describe('placeTone', () => {
  it('tells the first place, the podium and the rest apart', () => {
    expect(placeTone(1)).toBe('is-pr');
    expect(placeTone(2)).toBe('is-podium');
    expect(placeTone(3)).toBe('is-podium');
    expect(placeTone(4)).toBe('is-other');
    expect(placeTone(null)).toBe('is-other');
  });
});
