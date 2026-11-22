import { describe, expect, it } from '@jest/globals';
import { monthGrid, monthNameAr, relativeDayAr, weekKeys } from '@/utils/date';

describe('calendar helpers', () => {
  it('builds a Sunday-first week around any day', () => {
    // 2026-11-18 is a Wednesday
    expect(weekKeys('2026-11-18')).toEqual([
      '2026-11-15',
      '2026-11-16',
      '2026-11-17',
      '2026-11-18',
      '2026-11-19',
      '2026-11-20',
      '2026-11-21',
    ]);
  });

  it('builds a month grid with padding (Nov 2026 starts on Sunday)', () => {
    const g = monthGrid(2026, 10);
    expect(g[0][0]).toBe('2026-11-01');
    expect(g.flat().filter(Boolean)).toHaveLength(30);
    expect(g.every((row) => row.length === 7)).toBe(true);
    // Feb 2026 starts on Sunday too, Mar 2026 on Sunday; Jan 2026 starts Thursday → 4 empty cells
    expect(monthGrid(2026, 0)[0].slice(0, 4)).toEqual([null, null, null, null]);
  });

  it('names days and months in Arabic', () => {
    expect(monthNameAr(10)).toBe('نوفمبر');
    expect(relativeDayAr('2026-11-16', '2026-11-16')).toBe('اليوم');
    expect(relativeDayAr('2026-11-15', '2026-11-16')).toBe('أمس');
    expect(relativeDayAr('2026-11-10', '2026-11-16')).toContain('10/11/2026');
  });
});
