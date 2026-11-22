import { describe, expect, it } from '@jest/globals';
import { estimateEnergy, mifflinStJeor } from '@/services/nutrition/calories';
import { computeMacros, computeTargets, macroCalories } from '@/services/nutrition/macros';
import { DEFAULT_PROFILE, type Profile } from '@/services/nutrition/types';
import type { HealthDay } from '@/services/health/types';
import { parseNumber } from '@/utils/number';
import { toDateKey } from '@/utils/date';

const profile: Profile = { ...DEFAULT_PROFILE, sex: 'male', birthYear: 1996, heightCm: 180, weightKg: 80 };
const now = new Date(2026, 10, 16, 12, 0, 0); // noon, local
const day = (over: Partial<HealthDay>): HealthDay => ({
  dateKey: toDateKey(now),
  steps: null,
  activeKcal: null,
  basalKcal: null,
  workouts: [],
  partial: true,
  ...over,
});

describe('Mifflin–St Jeor', () => {
  it('matches the published formula', () => {
    // 10*80 + 6.25*180 - 5*30 + 5 = 1780
    expect(mifflinStJeor('male', 80, 180, 30)).toBe(1780);
    // 10*60 + 6.25*165 - 5*25 - 161 = 1345.25
    expect(mifflinStJeor('female', 60, 165, 25)).toBeCloseTo(1345.25);
  });
});

describe('estimateEnergy', () => {
  it('falls back to the formula when Health has no data / permission denied', () => {
    const e = estimateEnergy({ profile, today: day({}), baseline: null, now });
    expect(e.source).toBe('formula');
    expect(e.projectedTdee).toBe(Math.round(e.bmr * 1.55));
  });

  it('projects to end of day instead of using burned-so-far', () => {
    const e = estimateEnergy({
      profile,
      today: day({ basalKcal: 900, activeKcal: 300 }),
      baseline: { basalDaily: 1800, activeDaily: 600, daysWithData: 14 },
      now,
    });
    expect(e.source).toBe('health');
    // basal: 900 + 1800*0.5 = 1800
    expect(e.projectedBasal).toBe(1800);
    // active: 300 + 600 * remaining waking fraction (23-12)/17
    expect(e.projectedActive).toBe(Math.round(300 + 600 * (11 / 17)));
    expect(e.projectedTdee).toBeGreaterThan(900 + 300);
  });

  it('never adds workout calories on top of active energy', () => {
    const base = { basalKcal: 900, activeKcal: 700 };
    const a = estimateEnergy({ profile, today: day(base), baseline: null, now });
    const b = estimateEnergy({
      profile,
      today: day({
        ...base,
        workouts: [{ id: '1', name: 'قوة', start: '', end: '', durationMin: 60, kcal: 400, source: 'Watch' }],
      }),
      baseline: null,
      now,
    });
    expect(b.projectedTdee).toBe(a.projectedTdee);
  });

  it('is mixed when only active energy is available', () => {
    const e = estimateEnergy({ profile, today: day({ activeKcal: 200 }), baseline: null, now });
    expect(e.source).toBe('mixed');
  });
});

describe('targets & macros', () => {
  const energy = estimateEnergy({ profile, today: null, baseline: null, now });

  it('applies goal adjustments', () => {
    const cut = computeTargets({ ...profile, goal: 'cut' }, energy);
    const keep = computeTargets({ ...profile, goal: 'maintain' }, energy);
    const bulk = computeTargets({ ...profile, goal: 'bulk' }, energy);
    expect(cut.calories).toBeLessThan(keep.calories);
    expect(bulk.calories).toBeGreaterThan(keep.calories);
  });

  it('macros add up to the calorie target (±rounding)', () => {
    const t = computeTargets({ ...profile, goal: 'cut' }, energy);
    expect(Math.abs(macroCalories(t.macros) - t.calories)).toBeLessThan(15);
    expect(t.macros.protein).toBe(Math.round(80 * 2.2));
  });

  it('respects manual overrides', () => {
    const t = computeTargets({ ...profile, manualCalories: 2100 }, energy);
    expect(t.calories).toBe(2100);
    const m = computeTargets({ ...profile, manualMacros: { protein: 180, carbs: 200, fat: 60 } }, energy);
    expect(m.calories).toBe(180 * 4 + 200 * 4 + 60 * 9);
    expect(m.isManualMacros).toBe(true);
  });

  it('never returns negative carbs', () => {
    const { macros } = computeMacros(1200, { ...profile, weightKg: 140 });
    expect(macros.carbs).toBeGreaterThanOrEqual(0);
  });
});

describe('parseNumber', () => {
  it('handles Arabic digits and separators', () => {
    expect(parseNumber('٧٥٫٥')).toBe(75.5);
    expect(parseNumber('80,2')).toBe(80.2);
    expect(parseNumber('')).toBeNull();
    expect(parseNumber('abc')).toBeNull();
  });
});
