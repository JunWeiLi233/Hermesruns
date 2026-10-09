import { describe, expect, it } from 'vitest';
import en from '../../../i18n/locales/en';
import zh from '../../../i18n/locales/zh-CN';

function lookup(dictionary, key) {
  return key.split('.').reduce((value, part) => value?.[part], dictionary);
}

const KEYS = [
  'subnav_pace', 'pace_title', 'pace_loading', 'pace_error', 'pace_retry', 'pace_no_stream', 'pace_view_group',
  'pace_view_splits', 'pace_view_smoothed', 'pace_gap_toggle', 'pace_gap_unavailable', 'pace_gap_note',
  'pace_basis_moving', 'pace_stopped', 'pace_chart_label', 'pace_legend_pace', 'pace_legend_elevation',
  'pace_marker_fastest', 'pace_marker_slowest', 'pace_marker_average', 'pace_marker_split', 'pace_hover_stopped',
  'pace_hover_elevation_change', 'pace_hover_partial', 'pace_zones_title', 'pace_zones_loading',
  'pace_zones_unavailable', 'pace_zones_error', 'pace_zones_basis', 'pace_zones_basis_pace', 'pace_zones_basis_gap',
  'pace_zone_recovery', 'pace_zone_easy', 'pace_zone_marathon', 'pace_zone_threshold', 'pace_zone_interval',
  'pace_zone_repetition', 'pace_zone_slower', 'pace_zone_faster', 'pace_zone_between', 'numbers_stale',
].map((key) => `run_detail.${key}`);

describe('pace analysis copy', () => {
  it.each(KEYS)('has %s in English and Chinese with the same placeholders', (key) => {
    const placeholders = (text) => (String(text).match(/\{[a-zA-Z]+\}/g) || []).sort();
    const english = lookup(en, key);
    const chinese = lookup(zh, key);

    expect(typeof english).toBe('string');
    expect(typeof chinese).toBe('string');
    expect(english.length).toBeGreaterThan(0);
    expect(chinese.length).toBeGreaterThan(0);
    expect(placeholders(chinese)).toEqual(placeholders(english));
  });

  it('keeps the pace zone names the Analysis page uses for the same Daniels paces', () => {
    expect(['easy', 'marathon', 'threshold', 'interval', 'repetition'].map((zone) => lookup(en, `run_detail.pace_zone_${zone}`)))
      .toEqual(['Easy', 'Marathon', 'Threshold', 'Interval', 'Repetition']);
  });
});
