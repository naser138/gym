import { describe, expect, it } from '@jest/globals';
import { describeAmount, nutritionFor, per100FromServing, toBaseAmount, validatePer100 } from '@/services/food/foods';
import { COMMON_FOODS } from '@/services/food/commonFoods';

const egg = { kcal_100: 143, protein_100: 12.6, carbs_100: 0.7, fat_100: 9.5, serving_size: 50, serving_name: 'بيضة', per_unit: 'g' as const };
const milk = { kcal_100: 61, protein_100: 3.2, carbs_100: 4.8, fat_100: 3.3, serving_size: 250, serving_name: 'كوب', per_unit: 'ml' as const };

describe('amount units', () => {
  it('grams are used as-is', () => {
    expect(toBaseAmount(egg, 150, 'g')).toBe(150);
    expect(nutritionFor(egg, 150, 'g')).toEqual({ base: 150, calories: 215, protein: 18.9, carbs: 1, fat: 14.3 });
  });

  it('servings multiply by serving size', () => {
    expect(toBaseAmount(egg, 3, 'serving')).toBe(150);
    expect(nutritionFor(egg, 3, 'serving').calories).toBe(215);
    expect(nutritionFor(egg, 0.5, 'serving').base).toBe(25);
  });

  it('ml works the same way per 100 ml', () => {
    expect(nutritionFor(milk, 330, 'ml')).toEqual({ base: 330, calories: 201, protein: 10.6, carbs: 15.8, fat: 10.9 });
  });

  it('servings without a serving size give zero, not NaN', () => {
    expect(nutritionFor({ ...egg, serving_size: null }, 2, 'serving').calories).toBe(0);
    expect(nutritionFor(egg, -5, 'g').calories).toBe(0);
  });

  it('describes amounts in Arabic', () => {
    expect(describeAmount(egg, 150, 'g')).toBe('150 غ');
    expect(describeAmount(egg, 2, 'serving')).toBe('2 بيضة (100 غ)');
    expect(describeAmount(milk, 250, 'ml')).toBe('250 مل');
  });
});

describe('label conversion & validation', () => {
  it('converts per-serving label values to per 100', () => {
    // 30 g scoop: 120 kcal, 24 g protein
    expect(per100FromServing({ calories: 120, protein: 24, carbs: 3, fat: 1.5 }, 30)).toEqual({
      calories: 400,
      protein: 80,
      carbs: 10,
      fat: 5,
    });
  });

  it('rejects impossible per-100 values', () => {
    expect(validatePer100({ calories: 0, protein: 0, carbs: 0, fat: 0 })).not.toBeNull();
    expect(validatePer100({ calories: 950, protein: 0, carbs: 0, fat: 100 })).not.toBeNull();
    expect(validatePer100({ calories: 400, protein: 60, carbs: 40, fat: 10 })).not.toBeNull();
    expect(validatePer100({ calories: 165, protein: 31, carbs: 0, fat: 3.6 })).toBeNull();
  });

  it('all built-in foods are valid and roughly consistent (kcal ≈ 4P + 4C + 9F)', () => {
    for (const [name, kcal, p, c, f] of COMMON_FOODS) {
      expect({ name, err: validatePer100({ calories: kcal, protein: p, carbs: c, fat: f }) }).toEqual({ name, err: null });
      const est = p * 4 + c * 4 + f * 9;
      expect({ name, ok: Math.abs(est - kcal) <= Math.max(25, kcal * 0.15) }).toEqual({ name, ok: true });
    }
  });
});
