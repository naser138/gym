/**
 * Daily calorie target + macro split based on goal (cut / maintain / bulk).
 */
import { round } from '@/utils/number';
import type { DailyTargets, EnergyEstimate, Goal, Macros, Profile } from './types';

export const GOAL_LABELS_AR: Record<Goal, string> = {
  cut: 'تنشيف',
  maintain: 'تثبيت',
  bulk: 'تضخيم',
};

export const DEFAULT_PROTEIN_PER_KG: Record<Goal, number> = {
  cut: 2.2, // higher protein preserves lean mass in a deficit
  maintain: 1.8,
  bulk: 1.8,
};
export const DEFAULT_FAT_PER_KG = 0.8;
const MIN_FAT_PER_KG = 0.5;
const KCAL = { protein: 4, carbs: 4, fat: 9 } as const;

export function macroCalories(m: Macros): number {
  return m.protein * KCAL.protein + m.carbs * KCAL.carbs + m.fat * KCAL.fat;
}

/** Minimum sensible intake (kcal) without medical supervision. */
export function calorieFloor(p: Profile, bmr: number): number {
  return Math.max(p.sex === 'male' ? 1500 : 1200, Math.round(bmr * 0.95));
}

export function goalAdjustmentPercent(p: Profile): number {
  if (p.goal === 'cut') return -Math.abs(p.cutPercent);
  if (p.goal === 'bulk') return Math.abs(p.bulkPercent);
  return 0;
}

/** Splits calories into protein / fat / carbs (grams), body-weight based. */
export function computeMacros(calories: number, p: Profile): { macros: Macros; warnings: string[] } {
  const warnings: string[] = [];
  const w = p.weightKg;
  let protein = w * (p.proteinPerKg ?? DEFAULT_PROTEIN_PER_KG[p.goal]);
  let fat = Math.max(w * (p.fatPerKg ?? DEFAULT_FAT_PER_KG), (calories * 0.2) / KCAL.fat);
  let carbs = (calories - protein * KCAL.protein - fat * KCAL.fat) / KCAL.carbs;

  if (carbs < 0) {
    // Not enough room: lower fat to its minimum first, then protein.
    fat = Math.max(w * MIN_FAT_PER_KG, (calories * 0.15) / KCAL.fat);
    carbs = (calories - protein * KCAL.protein - fat * KCAL.fat) / KCAL.carbs;
    warnings.push('السعرات منخفضة نسبةً للوزن؛ تم تقليل الدهون إلى الحد الأدنى.');
    if (carbs < 0) {
      carbs = 0;
      protein = Math.max(0, (calories - fat * KCAL.fat) / KCAL.protein);
      warnings.push('تم تقليل البروتين لعدم كفاية السعرات.');
    }
  }

  return {
    macros: { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat) },
    warnings,
  };
}

export function computeTargets(p: Profile, energy: EnergyEstimate): DailyTargets {
  const warnings: string[] = [];
  const maintenance = p.calorieMode === 'average' ? energy.averageTdee : energy.projectedTdee;

  // Manual macros fully define the day.
  if (p.manualMacros) {
    const kcal = Math.round(macroCalories(p.manualMacros));
    if (p.manualCalories && Math.abs(p.manualCalories - kcal) > 50) {
      warnings.push(`الماكروز اليدوية تعادل ${kcal} سعرة وليس ${p.manualCalories}. تم اعتماد الماكروز.`);
    }
    return {
      calories: kcal,
      macros: { ...p.manualMacros },
      maintenance,
      adjustmentKcal: kcal - maintenance,
      isManualCalories: true,
      isManualMacros: true,
      warnings,
    };
  }

  let calories: number;
  let isManualCalories = false;
  if (p.manualCalories && p.manualCalories > 0) {
    calories = p.manualCalories;
    isManualCalories = true;
  } else {
    calories = maintenance * (1 + goalAdjustmentPercent(p) / 100);
    const floor = calorieFloor(p, energy.bmr);
    if (calories < floor) {
      warnings.push(`تم رفع الهدف إلى الحد الأدنى الآمن (${floor} سعرة).`);
      calories = floor;
    }
    calories = Math.round(calories / 10) * 10;
  }

  const { macros, warnings: mw } = computeMacros(calories, p);
  return {
    calories: round(calories),
    macros,
    maintenance,
    adjustmentKcal: round(calories - maintenance),
    isManualCalories,
    isManualMacros: false,
    warnings: [...warnings, ...mw],
  };
}
