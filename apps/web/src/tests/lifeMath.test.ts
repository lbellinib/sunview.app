import { describe, expect, it } from 'vitest';
import { getCurrentWeek, weekLabel } from '../lib/lifeMath';
import { DateTime } from 'luxon';

describe('lifeMath', () => {
  it('computes current week for known dob', () => {
    const now = DateTime.now();
    const dob = now.minus({ weeks: 104 }).toISODate();
    expect(getCurrentWeek(dob)).toBeGreaterThanOrEqual(103);
  });

  it('formats week label', () => {
    const dob = '2020-01-01';
    const label = weekLabel(dob, 0);
    expect(label).toContain('2020');
  });
});
