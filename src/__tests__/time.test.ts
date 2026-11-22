import { describe, expect, it } from '@jest/globals';
import { formatClock, formatDuration, parseSqlUtc, sessionDurationMs } from '@/utils/time';

describe('time helpers', () => {
  it('parses SQLite UTC timestamps', () => {
    expect(parseSqlUtc('2026-11-16 10:00:00')?.toISOString()).toBe('2026-11-16T10:00:00.000Z');
    expect(parseSqlUtc(null)).toBeNull();
  });
  it('formats durations and clocks', () => {
    expect(formatDuration(42 * 60000)).toBe('42 د');
    expect(formatDuration(65 * 60000)).toBe('1:05 س');
    expect(formatClock(90)).toBe('01:30');
    expect(formatClock(3725)).toBe('1:02:05');
  });
  it('computes session duration (finished or running)', () => {
    expect(sessionDurationMs('2026-11-16 10:00:00', '2026-11-16 11:15:00')).toBe(75 * 60000);
    expect(sessionDurationMs('2026-11-16 10:00:00', null, new Date('2026-11-16T10:30:00Z'))).toBe(30 * 60000);
  });
});
