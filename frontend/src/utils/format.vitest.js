import { describe, expect, it } from 'vitest';
import { formatLongDate } from './format';

// The test machine's own zone must not decide the answer: a date built from parts is the same wall clock on any machine.
const at = (hour, minute) => new Date(2026, 9, 8, hour, minute);

describe('formatLongDate', () => {
  it('writes an hour before ten without a leading zero in English, as the Runs list does', () => {
    const text = formatLongDate(at(3, 30), 'en');

    expect(text).toContain('3:30');
    expect(text).not.toContain('03:30');
  });

  it('writes the evening hour as it is', () => {
    expect(formatLongDate(at(19, 5), 'en')).toContain('7:05');
  });

  it('keeps two digits for the minutes', () => {
    expect(formatLongDate(at(11, 0), 'en')).toContain('11:00');
  });

  it('is empty for no date and for a date that is not one', () => {
    expect(formatLongDate(null, 'en')).toBe('');
    expect(formatLongDate('not a date', 'en')).toBe('');
  });

  it('names the weekday and the month', () => {
    const text = formatLongDate(at(9, 15), 'en');

    expect(text).toContain('Thursday');
    expect(text).toContain('October');
  });
});
