import { describe, expect, it } from 'vitest';
import en from '../i18n/locales/en';
import zh from '../i18n/locales/zh-CN';
import { zoneName, zoneNumberLabel, zoneRangeLabel } from './heartRateZoneLabels';

function translator(dictionary) {
  return (key, params = {}) => {
    const copy = key.split('.').reduce((value, part) => value?.[part], dictionary);
    if (typeof copy !== 'string') return `MISSING:${key}`;
    return Object.entries(params).reduce((value, [name, replacement]) => value.replaceAll(`{${name}}`, String(replacement)), copy);
  };
}

const tEn = translator(en);
const tZh = translator(zh);

describe('zone labels', () => {
  it('names the five zones and numbers them in both languages', () => {
    expect([1, 2, 3, 4, 5].map((n) => zoneName(tEn, n))).toEqual(['Recovery', 'Easy', 'Steady', 'Hard', 'Maximum']);
    expect([1, 2, 3, 4, 5].map((n) => zoneName(tZh, n))).toEqual(['恢复', '轻松', '稳定', '高强度', '极限']);
    expect(zoneNumberLabel(tEn, 3)).toBe('Zone 3');
    expect(zoneNumberLabel(tZh, 3)).toBe('区间 3');
  });

  it('writes the range of a zone from the first and last bpm the server sends', () => {
    expect(zoneRangeLabel(tEn, { zone: 1, fromBpm: null, toBpm: 113 })).toBe('under 114 bpm');
    expect(zoneRangeLabel(tEn, { zone: 2, fromBpm: 114, toBpm: 132 })).toBe('114–132 bpm');
    expect(zoneRangeLabel(tEn, { zone: 5, fromBpm: 171, toBpm: null })).toBe('171 bpm and up');
    expect(zoneRangeLabel(tZh, { zone: 1, fromBpm: null, toBpm: 113 })).toBe('低于 114 bpm');
    expect(zoneRangeLabel(tZh, { zone: 5, fromBpm: 171, toBpm: null })).toBe('171 bpm 及以上');
  });

  it('writes nothing for a zone with no edges at all', () => {
    expect(zoneRangeLabel(tEn, { zone: 3, fromBpm: null, toBpm: null })).toBe('');
    expect(zoneRangeLabel(tEn, undefined)).toBe('');
  });
});

describe('effort and zone copy', () => {
  const keys = [
    'run_detail.subnav_effort', 'run_detail.training_loading', 'run_detail.training_error', 'run_detail.training_retry',
    'run_detail.effort_title', 'run_detail.effort_none', 'run_detail.effort_source_hr_zones', 'run_detail.effort_source_perceived',
    'run_detail.effort_source_hr_average', 'run_detail.effort_source_pace_model', 'run_detail.effort_source_pace_calibrated',
    'run_detail.effort_how_hr_zones', 'run_detail.effort_how_perceived', 'run_detail.effort_how_hr_average',
    'run_detail.effort_how_pace_model', 'run_detail.effort_how_pace_calibrated', 'run_detail.effort_how_none',
    'run_detail.effort_scale_note', 'run_detail.effort_scale_link', 'run_detail.rating_title', 'run_detail.rating_group',
    'run_detail.rating_option', 'run_detail.rating_low', 'run_detail.rating_high', 'run_detail.rating_clear',
    'run_detail.rating_hint_idle', 'run_detail.rating_hint_used', 'run_detail.rating_hint_unused', 'run_detail.rating_saving',
    'run_detail.rating_saved', 'run_detail.rating_cleared', 'run_detail.rating_failed', 'run_detail.zones_title',
    'run_detail.zones_edit', 'run_detail.zones_no_stream', 'run_detail.zones_basis_default', 'run_detail.zones_basis_profile',
    'run_detail.zones_basis_manual', 'run_detail.zones_coverage',
    'training_zones.zone_number', 'training_zones.zone_1', 'training_zones.zone_2', 'training_zones.zone_3',
    'training_zones.zone_4', 'training_zones.zone_5', 'training_zones.range_below', 'training_zones.range_above',
    'training_zones.range_between',
    'settings.training_tab', 'settings.training_zones_title', 'settings.training_loading', 'settings.training_load_error',
    'settings.training_retry', 'settings.training_max_title', 'settings.training_max_copy', 'settings.training_max_label',
    'settings.training_max_source_profile', 'settings.training_max_source_default', 'settings.training_max_save',
    'settings.training_max_clear', 'settings.training_max_invalid', 'settings.training_max_saved', 'settings.training_max_cleared',
    'settings.training_suggestion', 'settings.training_suggestion_use', 'settings.training_boundaries_title',
    'settings.training_boundaries_copy', 'settings.training_boundaries_auto', 'settings.training_boundaries_manual',
    'settings.training_boundary_label', 'settings.training_boundaries_save', 'settings.training_boundaries_reset',
    'settings.training_boundaries_incomplete', 'settings.training_boundaries_range', 'settings.training_boundaries_order',
    'settings.training_preview_title', 'settings.training_recalc_note', 'settings.training_saved_recompute',
    'settings.training_saved_same', 'settings.training_save_error',
  ];

  it.each(keys)('has %s in English and Chinese', (key) => {
    const placeholders = (text) => (text.match(/\{[a-zA-Z]+\}/g) || []).sort();
    const english = tEn(key);
    const chinese = tZh(key);
    expect(english).not.toMatch(/^MISSING:/);
    expect(chinese).not.toMatch(/^MISSING:/);
    expect(placeholders(chinese)).toEqual(placeholders(english));
  });
});
